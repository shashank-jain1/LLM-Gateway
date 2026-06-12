"""
Failover routing logic.

For each incoming request, resolves the virtual model name, builds an ordered
list of candidate providers, and tries them one by one until one succeeds.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from config import AppConfig, ProviderConfig, get_config
from health import ProviderHealthTracker, ProviderState
from proxy import forward_non_streaming, forward_streaming


# ---------------------------------------------------------------------------
# Candidate resolution
# ---------------------------------------------------------------------------

def _resolve_candidates(
    virtual_model: str,
    config: AppConfig,
    health_tracker: ProviderHealthTracker,
    now: Optional[float] = None,
) -> List[ProviderConfig]:
    """Return an ordered list of candidate providers for *virtual_model*.

    Candidates are filtered by: enabled, support the virtual model.
    They are sorted by priority (ascending), and among equal-priority
    providers round-robin is applied via the health tracker state.

    Providers in cooldown are deprioritised but still included as
    last-resort candidates.
    """
    now = now or time.monotonic()

    healthy: List[Tuple[int, ProviderConfig]] = []
    cooling: List[Tuple[int, ProviderConfig]] = []

    for p in config.providers:
        if not p.enabled:
            continue
        if virtual_model not in p.models:
            continue
        if health_tracker.is_available(p.id, now):
            healthy.append((p.priority, p))
        else:
            cooling.append((p.priority, p))

    # Sort by priority; stable sort preserves insertion order for equal priorities
    healthy.sort(key=lambda t: t[0])
    cooling.sort(key=lambda t: t[0])

    ordered = [p for _, p in healthy] + [p for _, p in cooling]
    return ordered


# ---------------------------------------------------------------------------
# Non-streaming failover loop
# ---------------------------------------------------------------------------

async def route_non_streaming(
    path: str,
    body: Dict[str, Any],
    virtual_model: str,
    health_tracker: ProviderHealthTracker,
    config: Optional[AppConfig] = None,
) -> Tuple[int, Any, List[Dict[str, Any]]]:
    """Route a non-streaming request with automatic failover.

    Returns
    -------
    (final_status, response_body, attempt_log)
    """
    config = config or get_config()
    candidates = _resolve_candidates(virtual_model, config, health_tracker)

    if not candidates:
        return 503, {
            "error": {
                "message": f"No enabled provider supports model '{virtual_model}'",
                "type": "gateway_error",
            }
        }, []

    attempt_log: List[Dict[str, Any]] = []

    for provider in candidates:
        status, resp_body, latency = await forward_non_streaming(
            provider, path, body, virtual_model, health_tracker,
        )
        attempt_log.append({
            "provider_id": provider.id,
            "status_code": status,
            "latency": round(latency, 4),
            "error": None if (200 <= status < 300) else str(resp_body)[:500],
        })

        # Success?
        if 200 <= status < 300:
            return status, resp_body, attempt_log

        # Failover – mark and try next
        health_tracker.increment_failover()

    # All candidates failed
    return 502, {
        "error": {
            "message": "All providers failed for the request",
            "type": "gateway_error",
            "attempts": attempt_log,
        }
    }, attempt_log


# ---------------------------------------------------------------------------
# Streaming failover loop
# ---------------------------------------------------------------------------

async def route_streaming(
    path: str,
    body: Dict[str, Any],
    virtual_model: str,
    health_tracker: ProviderHealthTracker,
    config: Optional[AppConfig] = None,
) -> Tuple[int, Any, List[Dict[str, Any]]]:
    """Route a streaming request with automatic failover.

    Failover only happens if the error occurs *before* the first chunk
    is sent to the client (i.e. the upstream returns a non-2xx status
    immediately).  Once streaming starts, errors propagate as-is.

    Returns
    -------
    (final_status, stream_iterator, attempt_log)
    """
    config = config or get_config()
    candidates = _resolve_candidates(virtual_model, config, health_tracker)

    if not candidates:
        return 503, None, []

    attempt_log: List[Dict[str, Any]] = []

    for provider in candidates:
        status, stream_iter, latency = await forward_streaming(
            provider, path, body, virtual_model, health_tracker,
        )
        attempt_log.append({
            "provider_id": provider.id,
            "status_code": status,
            "latency": round(latency, 4),
            "error": None if (200 <= status < 300) else "upstream error before stream",
        })

        if 200 <= status < 300:
            return status, stream_iter, attempt_log

        # If we get a connection error (status 0), or 429/5xx, try next provider
        if status == 0 or status == 429 or status >= 500:
            health_tracker.increment_failover()
            continue

        # Other client errors (4xx) – don't failover, return as-is
        return status, stream_iter, attempt_log

    # All candidates failed
    return 502, None, attempt_log
