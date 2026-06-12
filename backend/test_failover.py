"""
Integration test for the LLM Gateway failover logic.

Starts the gateway with mock upstream providers (using a lightweight
FastAPI server) and verifies that:
  (a) Normal requests succeed via the primary provider
  (b) When the primary returns 429, the gateway automatically fails over
      to the secondary provider and returns a successful response

Usage:
    python test_failover.py

No external API keys needed — everything runs locally.
"""

from __future__ import annotations

import asyncio
import sys
import time
import threading
import httpx
import json
import yaml
from pathlib import Path

# ---------------------------------------------------------------------------
# Mock upstream provider
# ---------------------------------------------------------------------------

def _create_mock_provider(port: int, model_name: str, fail_with_429: bool = False):
    """Create a minimal FastAPI app that mimics an OpenAI-compatible provider."""
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse, StreamingResponse
    import uvicorn

    app = FastAPI()

    @app.post("/v1/chat/completions")
    async def chat_completions(request: Request):
        if fail_with_429:
            return JSONResponse(
                status_code=429,
                content={"error": {"message": "Rate limit exceeded", "type": "rate_limit_error"}},
                headers={"retry-after": "5"},
            )

        body = await request.json()
        return JSONResponse(content={
            "id": "chatcmpl-mock",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": body.get("model", model_name),
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": f"Mock response from port {port}"},
                "finish_reason": "stop",
            }],
            "usage": {"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18},
        })

    @app.post("/v1/embeddings")
    async def embeddings(request: Request):
        body = await request.json()
        return JSONResponse(content={
            "object": "list",
            "data": [{"object": "embedding", "embedding": [0.1, 0.2, 0.3], "index": 0}],
            "model": body.get("model", model_name),
            "usage": {"prompt_tokens": 5, "total_tokens": 5},
        })

    @app.get("/v1/models")
    async def models():
        return JSONResponse(content={
            "object": "list",
            "data": [{"id": model_name, "object": "model", "created": 0, "owned_by": "mock"}],
        })

    return app


def _run_server(app, port: int):
    """Run a uvicorn server in a daemon thread."""
    import uvicorn
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    return server, thread


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

GATEWAY_PORT = 8900
MOCK_PRIMARY_PORT = 8901
MOCK_SECONDARY_PORT = 8902
GATEWAY_API_KEY = "sk-gateway-testkey"


def _write_test_config(fail_primary: bool = False):
    """Write a temporary config.yaml pointing at the mock providers."""
    cfg = {
        "gateway": {
            "api_keys": [GATEWAY_API_KEY],
            "port": GATEWAY_PORT,
            "host": "127.0.0.1",
            "default_cooldown_seconds": 5,
            "max_cooldown_seconds": 60,
            "request_timeout_seconds": 10,
            "log_level": "warning",
        },
        "providers": [
            {
                "id": "mock-primary",
                "enabled": True,
                "priority": 1,
                "base_url": f"http://127.0.0.1:{MOCK_PRIMARY_PORT}/v1",
                "api_key": "sk-mock-primary",
                "models": {"gpt-4o": "gpt-4o"},
            },
            {
                "id": "mock-secondary",
                "enabled": True,
                "priority": 2,
                "base_url": f"http://127.0.0.1:{MOCK_SECONDARY_PORT}/v1",
                "api_key": "sk-mock-secondary",
                "models": {"gpt-4o": "gpt-4o"},
            },
        ],
    }
    config_path = Path(__file__).parent / "config.yaml"
    with open(config_path, "w") as f:
        yaml.dump(cfg, f)
    return config_path


async def _wait_for_server(host: str, port: int, timeout: float = 5.0):
    """Poll until a server is accepting connections."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"http://{host}:{port}/health", timeout=1.0)
                if resp.status_code == 200:
                    return True
        except Exception:
            await asyncio.sleep(0.1)
    return False


async def run_tests():
    print("=" * 60)
    print("LLM Gateway – Failover Integration Test")
    print("=" * 60)

    # --- Setup mock providers ---
    print("\n[1/4] Starting mock secondary provider (always healthy)...")
    secondary_app = _create_mock_provider(MOCK_SECONDARY_PORT, "gpt-4o", fail_with_429=False)
    _run_server(secondary_app, MOCK_SECONDARY_PORT)

    print("[1/4] Starting mock primary provider (healthy)...")
    primary_app = _create_mock_provider(MOCK_PRIMARY_PORT, "gpt-4o", fail_with_429=False)
    primary_server, primary_thread = _run_server(primary_app, MOCK_PRIMARY_PORT)

    # Wait for mock providers to be ready
    for port in [MOCK_PRIMARY_PORT, MOCK_SECONDARY_PORT]:
        ok = await _wait_for_server("127.0.0.1", port)
        if not ok:
            print(f"  ERROR: Mock provider on port {port} did not start!")
            sys.exit(1)

    # --- Test (a): Normal request via primary ---
    print("\n[2/4] Writing config and starting gateway...")
    config_path = _write_test_config()

    # Start the gateway
    from main import app as gateway_app
    gateway_server, gateway_thread = _run_server(gateway_app, GATEWAY_PORT)

    ok = await _wait_for_server("127.0.0.1", GATEWAY_PORT)
    if not ok:
        print("  ERROR: Gateway did not start!")
        sys.exit(1)

    print("\n[3/4] TEST (a): Normal request should succeed via primary provider...")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"http://127.0.0.1:{GATEWAY_PORT}/v1/chat/completions",
            headers={"Authorization": f"Bearer {GATEWAY_API_KEY}"},
            json={"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello!"}]},
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        print(f"  Response: {content}")
        assert f"port {MOCK_PRIMARY_PORT}" in content, "Expected primary provider response"
        print("  PASSED: Primary provider served the request.")

    # --- Reconfigure: make primary return 429 ---
    print("\n[4/4] TEST (b): Primary returns 429 → automatic failover to secondary...")

    # Stop the primary and restart it in fail mode
    # (In a real test we'd modify the mock, but for simplicity we'll restart)
    # Instead, let's just restart the mock on the same port with 429 mode
    primary_failing_app = _create_mock_provider(MOCK_PRIMARY_PORT, "gpt-4o", fail_with_429=True)
    _run_server(primary_failing_app, MOCK_PRIMARY_PORT)

    # Wait a moment for the new server to start
    await asyncio.sleep(0.5)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"http://127.0.0.1:{GATEWAY_PORT}/v1/chat/completions",
            headers={"Authorization": f"Bearer {GATEWAY_API_KEY}"},
            json={"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello after failover!"}]},
        )
        assert resp.status_code == 200, f"Expected 200 after failover, got {resp.status_code}: {resp.text}"
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        provider_header = resp.headers.get("x-provider", "unknown")
        print(f"  Response: {content}")
        print(f"  Served by provider: {provider_header}")
        assert f"port {MOCK_SECONDARY_PORT}" in content or "mock-secondary" in provider_header, \
            f"Expected secondary provider response, got: {content} from {provider_header}"
        print("  PASSED: Failover to secondary provider succeeded!")

    # --- Cleanup ---
    print("\n" + "=" * 60)
    print("All tests PASSED!")
    print("=" * 60)

    # Remove temp config
    config_path = Path(__file__).parent / "config.yaml"
    if config_path.exists():
        config_path.unlink()


if __name__ == "__main__":
    asyncio.run(run_tests())
