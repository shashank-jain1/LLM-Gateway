"""
Configuration loader and Pydantic models for the LLM Gateway.

Reads config.yaml, validates with Pydantic, and supports hot-reload.
Also supports writing config back to disk (for admin add/edit provider).
"""

from __future__ import annotations

import os
import yaml
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class GatewaySettings(BaseModel):
    """Top-level gateway settings (the `gateway` key in config.yaml)."""

    api_keys: List[str] = Field(..., description="Bearer tokens accepted by the gateway")
    admin_api_keys: Optional[List[str]] = Field(
        default=None,
        description="Optional separate keys for admin endpoints. Falls back to api_keys if unset.",
    )
    port: int = 8000
    host: str = "0.0.0.0"
    default_cooldown_seconds: float = 30.0
    max_cooldown_seconds: float = 600.0
    request_timeout_seconds: float = 60.0
    log_level: str = "info"
    log_file: Optional[str] = None

    @property
    def effective_admin_keys(self) -> List[str]:
        if self.admin_api_keys:
            return self.admin_api_keys
        return self.api_keys


class ProviderConfig(BaseModel):
    """A single backend provider definition."""

    id: str = Field(..., description="Unique identifier for this provider")
    enabled: bool = True
    priority: int = 1
    base_url: str = Field(..., description="Provider API base URL (e.g. https://api.openai.com/v1)")
    api_key: str = Field(..., description="API key for this provider")
    models: Dict[str, str] = Field(
        default_factory=dict,
        description="Mapping of virtual_model_name -> provider_model_name",
    )
    extra_headers: Optional[Dict[str, str]] = None

    @model_validator(mode="after")
    def strip_trailing_slash(self) -> "ProviderConfig":
        self.base_url = self.base_url.rstrip("/")
        return self


class AppConfig(BaseModel):
    """Full application configuration."""

    gateway: GatewaySettings
    providers: List[ProviderConfig] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Loader helpers
# ---------------------------------------------------------------------------

_CONFIG_PATH_ENV = "LLM_GATEWAY_CONFIG"
_DEFAULT_CONFIG_PATH = "config.yaml"

_config_instance: Optional[AppConfig] = None
_config_path: Optional[str] = None


def _resolve_path() -> Path:
    global _config_path
    if _config_path:
        return Path(_config_path)
    env_val = os.environ.get(_CONFIG_PATH_ENV)
    if env_val:
        return Path(env_val)
    return Path(_DEFAULT_CONFIG_PATH)


def load_config(path: Optional[str] = None) -> AppConfig:
    """Load and validate the YAML config file."""
    global _config_instance, _config_path
    if path:
        _config_path = path
    p = _resolve_path()
    with open(p, "r") as fh:
        raw = yaml.safe_load(fh)
    cfg = AppConfig(**raw)
    _config_instance = cfg
    return cfg


def reload_config() -> AppConfig:
    """Re-read the config file from disk (hot-reload)."""
    return load_config()


def get_config() -> AppConfig:
    """Return the last-loaded config. Loads on first call if needed."""
    global _config_instance
    if _config_instance is None:
        _config_instance = load_config()
    return _config_instance


def set_config(cfg: AppConfig) -> None:
    """Replace the in-memory config (used by admin reload)."""
    global _config_instance
    _config_instance = cfg


def save_config() -> None:
    """Write the current in-memory config back to the YAML file on disk."""
    cfg = get_config()
    p = _resolve_path()

    # Convert to a clean dict for YAML serialization
    data: Dict[str, Any] = {
        "gateway": cfg.gateway.model_dump(exclude_none=True),
        "providers": [p.model_dump(exclude_none=True) for p in cfg.providers],
    }

    with open(p, "w") as fh:
        yaml.dump(data, fh, default_flow_style=False, sort_keys=False)


def add_provider_to_config(provider: ProviderConfig) -> None:
    """Add a new provider to the in-memory config and save to disk."""
    cfg = get_config()
    # Check for duplicate ID
    for existing in cfg.providers:
        if existing.id == provider.id:
            raise ValueError(f"Provider with id '{provider.id}' already exists")
    cfg.providers.append(provider)
    set_config(cfg)
    save_config()


def update_provider_in_config(provider_id: str, updates: Dict[str, Any]) -> None:
    """Update an existing provider's fields in the in-memory config and save to disk."""
    cfg = get_config()
    for i, p in enumerate(cfg.providers):
        if p.id == provider_id:
            updated_data = p.model_dump()
            updated_data.update(updates)
            if "id" in updates and updates["id"] != provider_id:
                raise ValueError("Cannot change provider id")
            cfg.providers[i] = ProviderConfig(**updated_data)
            set_config(cfg)
            save_config()
            return
    raise ValueError(f"Provider '{provider_id}' not found")


def delete_provider_from_config(provider_id: str) -> None:
    """Remove a provider from the in-memory config and save to disk."""
    cfg = get_config()
    original_len = len(cfg.providers)
    cfg.providers = [p for p in cfg.providers if p.id != provider_id]
    if len(cfg.providers) == original_len:
        raise ValueError(f"Provider '{provider_id}' not found")
    set_config(cfg)
    save_config()
