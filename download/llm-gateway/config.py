"""
Configuration loader and Pydantic models for the LLM Gateway.

Reads config.yaml, validates with Pydantic, and supports hot-reload.
"""

from __future__ import annotations

import os
import yaml
from pathlib import Path
from typing import Dict, List, Optional

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
    """Load and validate the YAML config file.

    Parameters
    ----------
    path:
        Explicit path to the config file. If *None*, uses the
        ``LLM_GATEWAY_CONFIG`` env var or falls back to ``config.yaml``.
    """
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
