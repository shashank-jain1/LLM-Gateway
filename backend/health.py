"""
Provider health / cooldown tracker.

Maintains in-memory state per provider: healthy vs. cooldown, consecutive
failure counts, and exponential-backoff cooldown durations.  Structured so
that the state could later be moved to Redis with minimal changes.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from backend.config import AppConfig, ProviderConfig, get_config


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class ProviderState:
    provider_id: str
    status: str = "healthy"  # "healthy" | "cooldown"
    cooldown_until: Optional[float] = None
    consecutive_failures: int = 0
    last_error: Optional[str] = None
    last_success_at: Optional[float] = None

    # Counters
    total_requests: int = 0
    total_failures: int = 0
    total_successes: int = 0

    def is_in_cooldown(self, now: Optional[float] = None) -> bool:
        if self.status != "cooldown" or self.cooldown_until is None:
            return False
        now = now or time.monotonic()
        if now >= self.cooldown_until:
            # Cooldown expired – auto-recover
            self.status = "healthy"
            self.cooldown_until = None
            return False
        return True


# ---------------------------------------------------------------------------
# Tracker
# ---------------------------------------------------------------------------

class ProviderHealthTracker:
    """Thread-safe (asyncio-safe) health tracker for all providers."""

    def __init__(self, config: Optional[AppConfig] = None) -> None:
        self._lock = asyncio.Lock()
        self._states: Dict[str, ProviderState] = {}
        self._failover_count: int = 0
        if config:
            self._init_from_config(config)

    # -- initialisation -----------------------------------------------------

    def _init_from_config(self, config: AppConfig) -> None:
        for p in config.providers:
            self._states.setdefault(p.id, ProviderState(provider_id=p.id))

    def sync_with_config(self, config: AppConfig) -> None:
        """Add states for new providers, remove deleted ones, leave existing ones untouched."""
        current_ids = {p.id for p in config.providers}
        # Remove deleted providers from health tracker
        for pid in list(self._states.keys()):
            if pid not in current_ids:
                self._states.pop(pid, None)
        # Add new providers
        for p in config.providers:
            self._states.setdefault(p.id, ProviderState(provider_id=p.id))

    # -- queries ------------------------------------------------------------

    def get_state(self, provider_id: str) -> ProviderState:
        return self._states.setdefault(provider_id, ProviderState(provider_id=provider_id))

    def get_all_states(self) -> Dict[str, ProviderState]:
        return dict(self._states)

    def is_available(self, provider_id: str, now: Optional[float] = None) -> bool:
        """Return True if the provider is healthy (not in cooldown)."""
        state = self.get_state(provider_id)
        return not state.is_in_cooldown(now)

    # -- mutations ----------------------------------------------------------

    def record_success(self, provider_id: str) -> None:
        state = self.get_state(provider_id)
        state.status = "healthy"
        state.cooldown_until = None
        state.consecutive_failures = 0
        state.last_error = None
        state.last_success_at = time.monotonic()
        state.total_requests += 1
        state.total_successes += 1

    def record_failure(
        self,
        provider_id: str,
        error: str,
        retry_after: Optional[float] = None,
    ) -> None:
        config = get_config()
        gw = config.gateway

        state = self.get_state(provider_id)
        state.consecutive_failures += 1
        state.last_error = error
        state.total_requests += 1
        state.total_failures += 1

        # Determine cooldown duration
        if retry_after is not None:
            cooldown = min(retry_after, gw.max_cooldown_seconds)
        else:
            cooldown = min(
                gw.default_cooldown_seconds * (2 ** (state.consecutive_failures - 1)),
                gw.max_cooldown_seconds,
            )

        state.status = "cooldown"
        state.cooldown_until = time.monotonic() + cooldown

    def increment_failover(self) -> None:
        self._failover_count += 1

    @property
    def failover_count(self) -> int:
        return self._failover_count

    # -- admin helpers ------------------------------------------------------

    def reset_provider(self, provider_id: str) -> None:
        """Manually reset a provider to healthy (admin action)."""
        state = self.get_state(provider_id)
        state.status = "healthy"
        state.cooldown_until = None
        state.consecutive_failures = 0
        state.last_error = None
