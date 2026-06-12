"""
LLM API Gateway – FastAPI application.

Exposes OpenAI-compatible endpoints with automatic provider failover.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from config import AppConfig, get_config, load_config, reload_config, set_config
from health import ProviderHealthTracker
from logger import get_logger, log_request, setup_logging
from proxy import close_client
from router import route_non_streaming, route_streaming


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    config = load_config()
    setup_logging(log_level=config.gateway.log_level, log_file=config.gateway.log_file)
    logger = get_logger()
    logger.info("LLM Gateway starting", extra={"struct_data": {"port": config.gateway.port}})

    health_tracker = ProviderHealthTracker(config)

    app = FastAPI(
        title="LLM API Gateway",
        version="1.0.0",
        description="Multi-provider LLM API Gateway with automatic failover",
    )

    # ---- Auth helper -------------------------------------------------------

    def _check_auth(authorization: Optional[str], require_admin: bool = False) -> None:
        if not authorization:
            raise HTTPException(status_code=401, detail="Missing Authorization header")
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid Authorization header format")
        token = authorization[7:]
        cfg = get_config()
        valid_keys = cfg.gateway.effective_admin_keys if require_admin else cfg.gateway.api_keys
        if token not in valid_keys:
            raise HTTPException(status_code=401, detail="Invalid API key")

    # ---- Middleware: request ID -------------------------------------------

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        request.state.request_id = request_id
        start = time.monotonic()
        response = await call_next(request)
        total_latency = time.monotonic() - start
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{total_latency:.4f}s"
        return response

    # ---- /v1/chat/completions ---------------------------------------------

    @app.post("/v1/chat/completions")
    async def chat_completions(request: Request, authorization: Optional[str] = Header(None)):
        _check_auth(authorization)
        body = await request.json()
        virtual_model = body.get("model", "")
        stream = body.get("stream", False)
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        cfg = get_config()

        start = time.monotonic()

        if stream:
            status, stream_iter, attempt_log = await route_streaming(
                "/chat/completions", body, virtual_model, health_tracker, cfg,
            )
            total_latency = time.monotonic() - start

            # Log
            served_by = attempt_log[-1]["provider_id"] if attempt_log else None
            log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)

            if 200 <= status < 300 and stream_iter is not None:
                return StreamingResponse(
                    stream_iter,
                    media_type="text/event-stream",
                    headers={
                        "X-Request-ID": request_id,
                        "X-Provider": served_by or "unknown",
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                    },
                )
            else:
                return JSONResponse(
                    status_code=status,
                    content=stream_iter if isinstance(stream_iter, dict) else {
                        "error": {"message": "All streaming providers failed", "type": "gateway_error"},
                    },
                )
        else:
            status, resp_body, attempt_log = await route_non_streaming(
                "/chat/completions", body, virtual_model, health_tracker, cfg,
            )
            total_latency = time.monotonic() - start

            served_by = attempt_log[-1]["provider_id"] if attempt_log else None
            log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)

            return JSONResponse(
                status_code=status,
                content=resp_body,
                headers={
                    "X-Request-ID": request_id,
                    "X-Provider": served_by or "unknown",
                },
            )

    # ---- /v1/completions (legacy) -----------------------------------------

    @app.post("/v1/completions")
    async def completions(request: Request, authorization: Optional[str] = Header(None)):
        _check_auth(authorization)
        body = await request.json()
        virtual_model = body.get("model", "")
        stream = body.get("stream", False)
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        cfg = get_config()

        start = time.monotonic()

        if stream:
            status, stream_iter, attempt_log = await route_streaming(
                "/completions", body, virtual_model, health_tracker, cfg,
            )
            total_latency = time.monotonic() - start
            served_by = attempt_log[-1]["provider_id"] if attempt_log else None
            log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)

            if 200 <= status < 300 and stream_iter is not None:
                return StreamingResponse(
                    stream_iter,
                    media_type="text/event-stream",
                    headers={"X-Request-ID": request_id, "X-Provider": served_by or "unknown"},
                )
            else:
                return JSONResponse(status_code=status, content={
                    "error": {"message": "All streaming providers failed", "type": "gateway_error"},
                })
        else:
            status, resp_body, attempt_log = await route_non_streaming(
                "/completions", body, virtual_model, health_tracker, cfg,
            )
            total_latency = time.monotonic() - start
            served_by = attempt_log[-1]["provider_id"] if attempt_log else None
            log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)

            return JSONResponse(
                status_code=status,
                content=resp_body,
                headers={"X-Request-ID": request_id, "X-Provider": served_by or "unknown"},
            )

    # ---- /v1/embeddings ---------------------------------------------------

    @app.post("/v1/embeddings")
    async def embeddings(request: Request, authorization: Optional[str] = Header(None)):
        _check_auth(authorization)
        body = await request.json()
        virtual_model = body.get("model", "")
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        cfg = get_config()

        start = time.monotonic()
        status, resp_body, attempt_log = await route_non_streaming(
            "/embeddings", body, virtual_model, health_tracker, cfg,
        )
        total_latency = time.monotonic() - start
        served_by = attempt_log[-1]["provider_id"] if attempt_log else None
        log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)

        return JSONResponse(
            status_code=status,
            content=resp_body,
            headers={"X-Request-ID": request_id, "X-Provider": served_by or "unknown"},
        )

    # ---- /v1/models -------------------------------------------------------

    @app.get("/v1/models")
    async def list_models(authorization: Optional[str] = Header(None)):
        _check_auth(authorization)
        cfg = get_config()
        # Collect the union of virtual model names across all enabled providers
        virtual_models: Dict[str, List[str]] = {}
        for p in cfg.providers:
            if not p.enabled:
                continue
            for vname in p.models:
                virtual_models.setdefault(vname, []).append(p.id)

        model_list = []
        for vname, provider_ids in sorted(virtual_models.items()):
            model_list.append({
                "id": vname,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "llm-gateway",
                "providers": provider_ids,
            })

        return JSONResponse(content={
            "object": "list",
            "data": model_list,
        })

    # ---- Admin endpoints ---------------------------------------------------

    @app.get("/admin/status")
    async def admin_status(authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        states = health_tracker.get_all_states()
        result = []
        for pid, state in states.items():
            result.append({
                "provider_id": state.provider_id,
                "status": state.status,
                "cooldown_until": state.cooldown_until,
                "consecutive_failures": state.consecutive_failures,
                "last_error": state.last_error,
                "last_success_at": state.last_success_at,
                "total_requests": state.total_requests,
                "total_successes": state.total_successes,
                "total_failures": state.total_failures,
            })
        return JSONResponse(content={
            "providers": result,
            "failover_count": health_tracker.failover_count,
        })

    @app.post("/admin/reload-config")
    async def admin_reload_config(authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        try:
            new_cfg = reload_config()
            health_tracker.sync_with_config(new_cfg)
            return JSONResponse(content={"status": "ok", "message": "Config reloaded"})
        except Exception as exc:
            return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})

    @app.post("/admin/providers/{provider_id}/enable")
    async def admin_enable_provider(provider_id: str, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        cfg = get_config()
        found = False
        for p in cfg.providers:
            if p.id == provider_id:
                p.enabled = True
                found = True
                break
        if not found:
            raise HTTPException(status_code=404, detail=f"Provider '{provider_id}' not found")
        health_tracker.reset_provider(provider_id)
        return JSONResponse(content={"status": "ok", "message": f"Provider '{provider_id}' enabled"})

    @app.post("/admin/providers/{provider_id}/disable")
    async def admin_disable_provider(provider_id: str, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        cfg = get_config()
        found = False
        for p in cfg.providers:
            if p.id == provider_id:
                p.enabled = False
                found = True
                break
        if not found:
            raise HTTPException(status_code=404, detail=f"Provider '{provider_id}' not found")
        return JSONResponse(content={"status": "ok", "message": f"Provider '{provider_id}' disabled"})

    # ---- Health check (no auth) -------------------------------------------

    @app.get("/health")
    async def health_check():
        return JSONResponse(content={"status": "ok"})

    # ---- Shutdown ----------------------------------------------------------

    @app.on_event("shutdown")
    async def shutdown_event():
        await close_client()

    return app


# Create the app instance that uvicorn will import
app = create_app()
