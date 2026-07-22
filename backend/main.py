"""
LLM API Gateway – FastAPI application.

Exposes OpenAI-compatible endpoints with automatic provider failover.
Includes full admin API for provider management, request history, and config.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.config import (
    AppConfig,
    ProviderConfig,
    add_provider_to_config,
    delete_provider_from_config,
    get_config,
    load_config,
    reload_config,
    set_config,
    update_provider_in_config,
)
from backend.health import ProviderHealthTracker
from backend.history import request_history
from backend.logger import get_logger, log_request, setup_logging
from backend.proxy import close_client
from backend.router import route_non_streaming, route_streaming
from backend.anthropic_compat import translate_request, translate_response, translate_stream


# ---------------------------------------------------------------------------
# Auto-fetch models from active providers
# ---------------------------------------------------------------------------

import httpx

_fetched_provider_models: Dict[str, List[str]] = {}

def get_fetched_models_for_provider(provider_id: str) -> List[str]:
    return _fetched_provider_models.get(provider_id, [])

async def fetch_models_for_provider(provider: ProviderConfig) -> List[str]:
    """Fetch the list of models from the provider's /models endpoint."""
    url = f"{provider.base_url.rstrip('/')}/models"
    headers = {}
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"
    if provider.extra_headers:
        headers.update(provider.extra_headers)
        
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                model_ids = []
                # OpenAI / models compatible lists return a 'data' array
                if isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                    for m in data["data"]:
                        if isinstance(m, dict) and "id" in m:
                            model_ids.append(m["id"])
                elif isinstance(data, list):
                    for m in data:
                        if isinstance(m, str):
                            model_ids.append(m)
                        elif isinstance(m, dict) and "id" in m:
                            model_ids.append(m["id"])
                            
                if model_ids:
                    _fetched_provider_models[provider.id] = model_ids
                    get_logger().info(f"Auto-fetched {len(model_ids)} models for provider '{provider.id}'")
                    return model_ids
    except Exception as exc:
        get_logger().error(f"Failed to auto-fetch models for provider '{provider.id}': {str(exc)}")
        
    return []

async def fetch_all_provider_models():
    """Fetch models from all active providers."""
    cfg = get_config()
    tasks = []
    for provider in cfg.providers:
        if provider.enabled:
            tasks.append(fetch_models_for_provider(provider))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

async def probe_provider_model_latency(provider: ProviderConfig, virtual_model: str, health_tracker: ProviderHealthTracker):
    actual_model = provider.models.get(virtual_model, virtual_model)
    
    # Check if embedding model
    if "embed" in virtual_model.lower() or "similarity" in virtual_model.lower():
        path = "/embeddings"
        payload = {
            "model": actual_model,
            "input": "ping"
        }
    else:
        path = "/chat/completions"
        payload = {
            "model": actual_model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1
        }
        
    url = f"{provider.base_url.rstrip('/')}{path}"
    headers = {
        "Content-Type": "application/json"
    }
    if provider.api_key:
        headers["Authorization"] = f"Bearer {provider.api_key}"
    if provider.extra_headers:
        headers.update(provider.extra_headers)
        
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            start = time.monotonic()
            response = await client.post(url, json=payload, headers=headers)
            latency = time.monotonic() - start
            if 200 <= response.status_code < 300:
                health_tracker.record_success(provider.id, virtual_model=virtual_model, latency=latency)
            else:
                state = health_tracker.get_state(provider.id)
                state.latencies[virtual_model] = 999.0
    except Exception as exc:
        state = health_tracker.get_state(provider.id)
        state.latencies[virtual_model] = 999.0

async def probe_all_latencies(health_tracker: ProviderHealthTracker):
    cfg = get_config()
    tasks = []
    for provider in cfg.providers:
        if not provider.enabled:
            continue
        for virtual_model in provider.models:
            tasks.append(probe_provider_model_latency(provider, virtual_model, health_tracker))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

async def start_latency_probing(health_tracker: ProviderHealthTracker):
    # Wait a few seconds for startup to settle
    await asyncio.sleep(5.0)
    logger = get_logger()
    logger.info("Background latency probing started")
    while True:
        try:
            await probe_all_latencies(health_tracker)
        except Exception as exc:
            logger.error(f"Error in background latency probing: {str(exc)}")
        await asyncio.sleep(30.0)


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

    # ---- CORS (allow the dashboard frontend) --------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---- Auth helper -------------------------------------------------------

    def _check_auth(authorization: Optional[str], request: Optional[Request] = None, require_admin: bool = False) -> None:
        token = None
        if authorization:
            if authorization.startswith("Bearer "):
                token = authorization[7:]
            else:
                token = authorization
        
        if not token and request:
            token = request.headers.get("x-api-key")

        if not token:
            raise HTTPException(status_code=401, detail="Missing Authorization or x-api-key header")
        cfg = get_config()
        valid_keys = cfg.gateway.effective_admin_keys if require_admin else cfg.gateway.api_keys
        if token not in valid_keys:
            raise HTTPException(status_code=401, detail="Invalid API key")
        if request:
            request.state.api_key = token

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
        _check_auth(authorization, request=request)
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
            served_by = attempt_log[-1]["provider_id"] if attempt_log else None
            log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)
            request_history.add(virtual_model, served_by, attempt_log, status, total_latency, api_key=getattr(request.state, "api_key", None))

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
            rec = request_history.add(virtual_model, served_by, attempt_log, status, total_latency, api_key=getattr(request.state, "api_key", None))
            # Enrich the response with gateway metadata
            if isinstance(resp_body, dict):
                resp_body["_gateway"] = {
                    "request_id": rec.id,
                    "provider": served_by,
                    "attempts": len(attempt_log),
                    "latency_ms": round(total_latency * 1000, 2),
                }

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
        _check_auth(authorization, request=request)
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
            request_history.add(virtual_model, served_by, attempt_log, status, total_latency, api_key=getattr(request.state, "api_key", None))

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
            request_history.add(virtual_model, served_by, attempt_log, status, total_latency, api_key=getattr(request.state, "api_key", None))

            return JSONResponse(
                status_code=status,
                content=resp_body,
                headers={"X-Request-ID": request_id, "X-Provider": served_by or "unknown"},
            )

    # ---- /v1/embeddings ---------------------------------------------------

    @app.post("/v1/embeddings")
    async def embeddings(request: Request, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, request=request)
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
        request_history.add(virtual_model, served_by, attempt_log, status, total_latency, api_key=getattr(request.state, "api_key", None))

        return JSONResponse(
            status_code=status,
            content=resp_body,
            headers={"X-Request-ID": request_id, "X-Provider": served_by or "unknown"},
        )

    # ---- /v1/messages (Anthropic Compatibility) -----------------------------

    @app.post("/v1/messages")
    @app.post("/v1/v1/messages")
    async def messages(request: Request, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, request=request)
        body = await request.json()
        virtual_model = body.get("model", "")
        stream = body.get("stream", False)
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        cfg = get_config()

        # Check if the primary provider candidate for this virtual model is Anthropic
        from backend.router import _resolve_candidates
        candidates = _resolve_candidates(virtual_model, cfg, health_tracker)
        
        is_anthropic_provider = False
        if candidates:
            top_provider = candidates[0]
            if "anthropic.com" in top_provider.base_url or top_provider.id.lower() == "anthropic":
                is_anthropic_provider = True

        start = time.monotonic()

        if is_anthropic_provider:
            # 1. Direct Passthrough to Anthropic Messages endpoint
            if stream:
                status, stream_iter, attempt_log = await route_streaming(
                    "/messages", body, virtual_model, health_tracker, cfg,
                )
                total_latency = time.monotonic() - start
                served_by = attempt_log[-1]["provider_id"] if attempt_log else None
                log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)
                request_history.add(virtual_model, served_by, attempt_log, status, total_latency, api_key=getattr(request.state, "api_key", None))

                if 200 <= status < 300 and stream_iter is not None:
                    headers = {
                        "X-Request-ID": request_id,
                        "X-Provider": served_by or "unknown",
                        "Content-Type": "text/event-stream",
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                    }
                    return StreamingResponse(stream_iter, media_type="text/event-stream", headers=headers)
                else:
                    return JSONResponse(
                        status_code=status,
                        content=stream_iter if isinstance(stream_iter, dict) else {
                            "error": {"message": "All streaming providers failed", "type": "gateway_error"},
                        },
                    )
            else:
                status, resp_body, attempt_log = await route_non_streaming(
                    "/messages", body, virtual_model, health_tracker, cfg,
                )
                total_latency = time.monotonic() - start
                served_by = attempt_log[-1]["provider_id"] if attempt_log else None
                log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)
                request_history.add(virtual_model, served_by, attempt_log, status, total_latency, api_key=getattr(request.state, "api_key", None))

                return JSONResponse(
                    status_code=status,
                    content=resp_body,
                    headers={
                        "X-Request-ID": request_id,
                        "X-Provider": served_by or "unknown",
                    },
                )
        else:
            # 2. Translate Anthropic Messages format to OpenAI Chat Completions format
            openai_body = translate_request(body)
            
            if stream:
                status, stream_iter, attempt_log = await route_streaming(
                    "/chat/completions", openai_body, virtual_model, health_tracker, cfg,
                )
                total_latency = time.monotonic() - start
                served_by = attempt_log[-1]["provider_id"] if attempt_log else None
                log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)
                request_history.add(virtual_model, served_by, attempt_log, status, total_latency, api_key=getattr(request.state, "api_key", None))

                if 200 <= status < 300 and stream_iter is not None:
                    anthropic_stream = translate_stream(stream_iter)
                    headers = {
                        "X-Request-ID": request_id,
                        "X-Provider": served_by or "unknown",
                        "Content-Type": "text/event-stream",
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                    }
                    return StreamingResponse(anthropic_stream, media_type="text/event-stream", headers=headers)
                else:
                    return JSONResponse(
                        status_code=status,
                        content=stream_iter if isinstance(stream_iter, dict) else {
                            "error": {"message": "All streaming providers failed", "type": "gateway_error"},
                        },
                    )
            else:
                status, resp_body, attempt_log = await route_non_streaming(
                    "/chat/completions", openai_body, virtual_model, health_tracker, cfg,
                )
                total_latency = time.monotonic() - start
                served_by = attempt_log[-1]["provider_id"] if attempt_log else None
                log_request(request_id, virtual_model, attempt_log, status, served_by, total_latency)
                request_history.add(virtual_model, served_by, attempt_log, status, total_latency, api_key=getattr(request.state, "api_key", None))

                if 200 <= status < 300 and isinstance(resp_body, dict):
                    anthropic_resp = translate_response(resp_body)
                    return JSONResponse(
                        status_code=status,
                        content=anthropic_resp,
                        headers={
                            "X-Request-ID": request_id,
                            "X-Provider": served_by or "unknown",
                        },
                    )
                else:
                    return JSONResponse(
                        status_code=status,
                        content=resp_body,
                        headers={
                            "X-Request-ID": request_id,
                            "X-Provider": served_by or "unknown",
                        },
                    )

    # ---- /v1/models -------------------------------------------------------

    @app.get("/v1/models")
    @app.get("/v1/v1/models")
    async def list_models(request: Request, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, request=request)
        cfg = get_config()
        virtual_models: Dict[str, List[str]] = {}
        for p in cfg.providers:
            if not p.enabled:
                continue
            for vname in p.models:
                virtual_models.setdefault(vname, []).append(p.id)
            for fname in get_fetched_models_for_provider(p.id):
                virtual_models.setdefault(fname, []).append(p.id)

        # Detect Anthropic client
        is_anthropic = bool(
            request.headers.get("x-api-key") or 
            "anthropic" in request.headers.get("user-agent", "").lower() or
            "claude" in request.headers.get("user-agent", "").lower()
        )

        model_list = []
        for vname, provider_ids in sorted(virtual_models.items()):
            if is_anthropic:
                model_list.append({
                    "type": "model",
                    "id": vname,
                    "display_name": vname,
                    "created_at": "2024-01-01T00:00:00Z"
                })
            else:
                model_list.append({
                    "id": vname,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "llm-gateway",
                    "providers": provider_ids,
                })

        if is_anthropic:
            return JSONResponse(content={
                "data": model_list,
                "has_more": False,
                "first_id": model_list[0]["id"] if model_list else None,
                "last_id": model_list[-1]["id"] if model_list else None
            })
        else:
            return JSONResponse(content={
                "object": "list",
                "data": model_list,
            })

    # ---- Admin: status ----------------------------------------------------

    @app.get("/admin/status")
    async def admin_status(authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        cfg = get_config()
        states = health_tracker.get_all_states()
        result = []
        for pid, state in states.items():
            # Find provider config to get extra info
            p_cfg = next((p for p in cfg.providers if p.id == pid), None)
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
                "enabled": p_cfg.enabled if p_cfg else True,
                "priority": p_cfg.priority if p_cfg else 99,
                "base_url": p_cfg.base_url if p_cfg else "",
                "models": p_cfg.models if p_cfg else {},
                "fetched_models": get_fetched_models_for_provider(state.provider_id),
                "latencies": state.latencies,
            })
        return JSONResponse(content={
            "providers": result,
            "failover_count": health_tracker.failover_count,
            "total_requests": request_history.total_count,
            "gateway": {
                "port": cfg.gateway.port,
                "host": cfg.gateway.host,
                "default_cooldown_seconds": cfg.gateway.default_cooldown_seconds,
                "max_cooldown_seconds": cfg.gateway.max_cooldown_seconds,
                "request_timeout_seconds": cfg.gateway.request_timeout_seconds,
                "log_level": cfg.gateway.log_level,
                "routing_strategy": cfg.gateway.routing_strategy,
            },
        })

    # ---- Admin: config ----------------------------------------------------

    @app.get("/admin/config")
    async def admin_get_config(authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        cfg = get_config()
        return JSONResponse(content={
            "gateway": cfg.gateway.model_dump(exclude_none=True),
            "providers": [p.model_dump(exclude_none=True) for p in cfg.providers],
        })

    @app.put("/admin/config")
    async def admin_update_config(request: Request, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        body = await request.json()
        cfg = get_config()
        
        # Update gateway settings
        if "gateway" in body:
            gateway_data = body["gateway"]
            for k, v in gateway_data.items():
                if hasattr(cfg.gateway, k):
                    setattr(cfg.gateway, k, v)
                    
        # Update providers if present in payload
        if "providers" in body:
            try:
                providers = [ProviderConfig(**p) for p in body["providers"]]
                cfg.providers = providers
            except Exception as e:
                return JSONResponse(status_code=400, content={"status": "error", "message": f"Invalid providers config: {str(e)}"})
                
        # Save to disk and sync
        try:
            from backend.config import save_config
            save_config()
            health_tracker.sync_with_config(cfg)
            return JSONResponse(content={"status": "ok", "message": "Config updated and saved"})
        except Exception as exc:
            return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})

    @app.post("/admin/reload-config")
    async def admin_reload_config(authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        try:
            new_cfg = reload_config()
            health_tracker.sync_with_config(new_cfg)
            asyncio.create_task(fetch_all_provider_models())
            return JSONResponse(content={"status": "ok", "message": "Config reloaded"})
        except Exception as exc:
            return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})

    # ---- Admin: provider CRUD ---------------------------------------------

    @app.post("/admin/providers")
    async def admin_add_provider(request: Request, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        body = await request.json()
        try:
            provider = ProviderConfig(**body)
            add_provider_to_config(provider)
            health_tracker.sync_with_config(get_config())
            if provider.enabled:
                asyncio.create_task(fetch_models_for_provider(provider))
            logger = get_logger()
            logger.info(f"Provider added: {provider.id}")
            return JSONResponse(content={
                "status": "ok",
                "message": f"Provider '{provider.id}' added",
                "provider": provider.model_dump(exclude_none=True),
            })
        except ValueError as exc:
            return JSONResponse(status_code=400, content={"status": "error", "message": str(exc)})
        except Exception as exc:
            return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})

    @app.put("/admin/providers/{provider_id}")
    async def admin_update_provider(provider_id: str, request: Request, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        body = await request.json()
        try:
            update_provider_in_config(provider_id, body)
            cfg = get_config()
            provider = next((p for p in cfg.providers if p.id == provider_id), None)
            if provider and provider.enabled:
                asyncio.create_task(fetch_models_for_provider(provider))
            else:
                _fetched_provider_models.pop(provider_id, None)
            health_tracker.sync_with_config(cfg)
            return JSONResponse(content={
                "status": "ok",
                "message": f"Provider '{provider_id}' updated",
            })
        except ValueError as exc:
            return JSONResponse(status_code=400, content={"status": "error", "message": str(exc)})
        except Exception as exc:
            return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})

    @app.delete("/admin/providers/{provider_id}")
    async def admin_delete_provider(provider_id: str, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        try:
            delete_provider_from_config(provider_id)
            _fetched_provider_models.pop(provider_id, None)
            health_tracker.sync_with_config(get_config())
            logger = get_logger()
            logger.info(f"Provider deleted: {provider_id}")
            return JSONResponse(content={
                "status": "ok",
                "message": f"Provider '{provider_id}' deleted",
            })
        except ValueError as exc:
            return JSONResponse(status_code=404, content={"status": "error", "message": str(exc)})
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
                asyncio.create_task(fetch_models_for_provider(p))
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
                _fetched_provider_models.pop(provider_id, None)
                found = True
                break
        if not found:
            raise HTTPException(status_code=404, detail=f"Provider '{provider_id}' not found")
        return JSONResponse(content={"status": "ok", "message": f"Provider '{provider_id}' disabled"})

    # ---- Admin: request history -------------------------------------------

    @app.get("/admin/requests")
    async def admin_requests(
        authorization: Optional[str] = Header(None),
        limit: int = 100,
    ):
        _check_auth(authorization, require_admin=True)
        records = request_history.get_recent(limit=limit)
        return JSONResponse(content=records)

    @app.post("/admin/providers/{provider_id}/test")
    async def admin_test_provider(provider_id: str, authorization: Optional[str] = Header(None)):
        _check_auth(authorization, require_admin=True)
        cfg = get_config()
        provider = None
        for p in cfg.providers:
            if p.id == provider_id:
                provider = p
                break
        if not provider:
            raise HTTPException(status_code=404, detail=f"Provider '{provider_id}' not found")
        
        if not provider.models:
            return JSONResponse(status_code=400, content={
                "status": "error",
                "message": "No model mappings configured for this provider. Cannot test."
            })
        
        actual_model = list(provider.models.values())[0]
        test_url = f"{provider.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Content-Type": "application/json"
        }
        if provider.api_key:
            headers["Authorization"] = f"Bearer {provider.api_key}"
            
        payload = {
            "model": actual_model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5
        }
        
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(test_url, json=payload, headers=headers)
                if response.status_code == 200:
                    try:
                        res_data = response.json()
                        content = res_data.get("choices", [{}])[0].get("message", {}).get("content", "OK")
                    except Exception:
                        content = response.text[:200]
                    return JSONResponse(content={
                        "status": "ok",
                        "message": f"Successfully reached {provider_id} using model '{actual_model}'",
                        "response": content
                    })
                else:
                    return JSONResponse(status_code=response.status_code, content={
                        "status": "error",
                        "message": f"Provider returned status {response.status_code}",
                        "details": response.text[:500]
                    })
        except Exception as exc:
            return JSONResponse(status_code=502, content={
                "status": "error",
                "message": f"Failed to connect to provider: {str(exc)}"
            })

    # ---- Health check (no auth) -------------------------------------------

    @app.get("/health")
    async def health_check():
        cfg = get_config()
        return JSONResponse(content={
            "status": "ok",
            "providers": len(cfg.providers),
            "uptime": time.time(),
        })

    # ---- Startup & Shutdown ------------------------------------------------
    
    @app.on_event("startup")
    async def startup_event():
        asyncio.create_task(fetch_all_provider_models())
        asyncio.create_task(start_latency_probing(health_tracker))

    @app.on_event("shutdown")
    async def shutdown_event():
        await close_client()

    return app


# Create the app instance that uvicorn will import
app = create_app()
