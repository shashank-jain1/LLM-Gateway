"""
HTTP proxy / forwarding logic.

Handles rewriting request bodies (model-name substitution) and forwarding
requests to backend providers.  Supports both non-streaming and streaming
(SSE) responses.
"""

from __future__ import annotations

import json
import time
from typing import Any, AsyncIterator, Dict, Optional, Tuple

import httpx

from config import ProviderConfig, get_config
from health import ProviderHealthTracker


# Shared httpx client (connection-pooled)
_client: Optional[httpx.AsyncClient] = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        cfg = get_config()
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(cfg.gateway.request_timeout_seconds, connect=10.0),
            follow_redirects=True,
        )
    return _client


async def close_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


def _rewrite_body(
    body: Dict[str, Any],
    virtual_model: str,
    provider_model: str,
) -> Dict[str, Any]:
    """Return a copy of *body* with the model field replaced."""
    rewritten = dict(body)
    rewritten["model"] = provider_model
    return rewritten


def _build_upstream_url(provider: ProviderConfig, path: str) -> str:
    """Construct the full upstream URL for a given API path."""
    return f"{provider.base_url}{path}"


def _build_headers(provider: ProviderConfig) -> Dict[str, str]:
    """Build the headers dict for an upstream request."""
    headers = {
        "Authorization": f"Bearer {provider.api_key}",
        "Content-Type": "application/json",
    }
    if provider.extra_headers:
        headers.update(provider.extra_headers)
    return headers


# ---------------------------------------------------------------------------
# Non-streaming proxy
# ---------------------------------------------------------------------------

async def forward_non_streaming(
    provider: ProviderConfig,
    path: str,
    body: Dict[str, Any],
    virtual_model: str,
    health_tracker: ProviderHealthTracker,
) -> Tuple[int, Any, float]:
    """Forward a non-streaming request.

    Returns
    -------
    (status_code, response_body_or_error_string, latency_seconds)
    """
    provider_model = provider.models.get(virtual_model, virtual_model)
    rewritten = _rewrite_body(body, virtual_model, provider_model)
    url = _build_upstream_url(provider, path)
    headers = _build_headers(provider)

    client = await _get_client()
    start = time.monotonic()
    try:
        resp = await client.post(url, json=rewritten, headers=headers)
        latency = time.monotonic() - start
    except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as exc:
        latency = time.monotonic() - start
        return 0, str(exc), latency

    if 200 <= resp.status_code < 300:
        health_tracker.record_success(provider.id)
        try:
            return resp.status_code, resp.json(), latency
        except Exception:
            return resp.status_code, resp.text, latency
    else:
        # Parse retry-after if present
        retry_after: Optional[float] = None
        ra_header = resp.headers.get("retry-after")
        if ra_header:
            try:
                retry_after = float(ra_header)
            except ValueError:
                pass

        error_body = None
        try:
            error_body = resp.json()
        except Exception:
            error_body = resp.text

        error_msg = f"HTTP {resp.status_code}: {error_body}"
        health_tracker.record_failure(provider.id, error_msg, retry_after=retry_after)
        return resp.status_code, error_body, latency


# ---------------------------------------------------------------------------
# Streaming proxy (SSE passthrough)
# ---------------------------------------------------------------------------

async def forward_streaming(
    provider: ProviderConfig,
    path: str,
    body: Dict[str, Any],
    virtual_model: str,
    health_tracker: ProviderHealthTracker,
) -> Tuple[int, AsyncIterator[bytes], float]:
    """Forward a streaming request.  Returns the status code, an async iterator
    of raw SSE bytes, and the time-to-first-byte latency.

    The caller is responsible for iterating the stream and sending chunks to
    the downstream client.
    """
    provider_model = provider.models.get(virtual_model, virtual_model)
    rewritten = _rewrite_body(body, virtual_model, provider_model)
    url = _build_upstream_url(provider, path)
    headers = _build_headers(provider)
    # Tell httpx we want to stream the response
    headers["Accept"] = "text/event-stream"

    client = await _get_client()
    start = time.monotonic()

    try:
        req = client.build_request("POST", url, json=rewritten, headers=headers)
        resp = await client.send(req, stream=True)
        ttfb = time.monotonic() - start
    except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as exc:
        ttfb = time.monotonic() - start
        return 0, _error_iterator(str(exc)), ttfb

    if 200 <= resp.status_code < 300:
        health_tracker.record_success(provider.id)
        return resp.status_code, _sse_iterator(resp), ttfb
    else:
        # Error before first data chunk – safe to failover
        retry_after: Optional[float] = None
        ra_header = resp.headers.get("retry-after")
        if ra_header:
            try:
                retry_after = float(ra_header)
            except ValueError:
                pass

        error_body = await resp.aread()
        error_text = error_body.decode(errors="replace")
        error_msg = f"HTTP {resp.status_code}: {error_text}"
        health_tracker.record_failure(provider.id, error_msg, retry_after=retry_after)
        await resp.aclose()
        return resp.status_code, _error_iterator(error_text), ttfb


async def _sse_iterator(resp: httpx.Response) -> AsyncIterator[bytes]:
    """Yield raw SSE bytes from an httpx streaming response."""
    try:
        async for chunk in resp.aiter_bytes():
            yield chunk
    finally:
        await resp.aclose()


async def _error_iterator(msg: str) -> AsyncIterator[bytes]:
    """Yield a single error message as an SSE event (used for early failures)."""
    yield msg.encode(errors="replace")
