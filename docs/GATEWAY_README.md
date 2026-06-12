# LLM API Gateway

A self-hosted **multi-provider LLM API Gateway** with automatic failover. It exposes a single OpenAI-compatible endpoint and transparently routes requests to multiple backend providers (OpenAI, Groq, Together, OpenRouter, etc.). If the active provider fails, the gateway automatically retries against the next healthy provider — the caller never sees the error unless *all* providers fail.

## Features

- **OpenAI-compatible API** — drop-in replacement, just change the base URL and API key
- **Automatic failover** — on 429/5xx/timeout, silently retries the next provider
- **Streaming support** — SSE passthrough with failover before first byte
- **Model name mapping** — virtual model names (e.g. `gpt-4o`) map to provider-specific models
- **Priority-based routing** — lower priority numbers tried first; equal priorities round-robin
- **Exponential backoff cooldown** — failed providers auto-recover after cooldown
- **Hot-reloadable config** — add/remove providers without restarting
- **Admin API** — health status, config reload, enable/disable providers at runtime
- **Structured JSON logging** — full audit trail per request

## Quick Start

### Local (Python)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Create your config
cp config.yaml.example config.yaml
# Edit config.yaml with your real API keys

# 3. Run
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Docker

```bash
# 1. Create your config
cp config.yaml.example config.yaml
# Edit config.yaml with your real API keys

# 2. Build and run
docker-compose up -d

# 3. Check health
curl http://localhost:8000/health
```

## Usage

### Chat Completions

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer sk-gateway-mysecretkey123" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

### Streaming

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer sk-gateway-mysecretkey123" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

### List Models

```bash
curl http://localhost:8000/v1/models \
  -H "Authorization: Bearer sk-gateway-mysecretkey123"
```

### Embeddings

```bash
curl -X POST http://localhost:8000/v1/embeddings \
  -H "Authorization: Bearer sk-gateway-mysecretkey123" \
  -H "Content-Type: application/json" \
  -d '{"model": "text-embedding-3-small", "input": "Hello world"}'
```

## Configuration Reference

The gateway reads `config.yaml` (or the path in the `LLM_GATEWAY_CONFIG` env var).

### Gateway Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `gateway.api_keys` | list | required | Bearer tokens accepted by the gateway |
| `gateway.admin_api_keys` | list | none | Optional separate keys for admin endpoints |
| `gateway.port` | int | 8000 | Server port |
| `gateway.host` | str | 0.0.0.0 | Server bind address |
| `gateway.default_cooldown_seconds` | float | 30 | Initial cooldown after a provider error |
| `gateway.max_cooldown_seconds` | float | 600 | Maximum cooldown (caps exponential backoff) |
| `gateway.request_timeout_seconds` | float | 60 | HTTP timeout for upstream requests |
| `gateway.log_level` | str | info | Logging level (debug/info/warning/error) |
| `gateway.log_file` | str | none | Optional path to write JSON log lines to |

### Provider Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `id` | str | required | Unique identifier for this provider |
| `enabled` | bool | true | Whether this provider is active |
| `priority` | int | 1 | Routing priority (lower = tried first) |
| `base_url` | str | required | Provider API base URL |
| `api_key` | str | required | API key for this provider |
| `models` | dict | {} | Mapping of `virtual_model_name: provider_model_name` |
| `extra_headers` | dict | none | Additional headers to send with each request |

## Adding a New Provider

1. Add a new entry under `providers:` in `config.yaml`:

```yaml
  - id: "openrouter-backup"
    enabled: true
    priority: 4
    base_url: "https://openrouter.ai/api/v1"
    api_key: "sk-or-REPLACE-WITH-YOUR-KEY"
    models:
      "gpt-4o": "openai/gpt-4o"
      "gpt-4o-mini": "openai/gpt-4o-mini"
```

2. **Hot-reload** without restart:

```bash
curl -X POST http://localhost:8000/admin/reload-config \
  -H "Authorization: Bearer sk-gateway-mysecretkey123"
```

   Or restart the server.

## How Failover & Cooldown Works

### Routing

For each request, the gateway:

1. Resolves the requested virtual model name
2. Builds an ordered list of candidate providers that are (a) enabled, (b) support this model, (c) not in cooldown
3. Tries providers in priority order (lower number first)
4. If the active provider returns an error (429, 5xx, timeout, connection failure), marks it as failed and moves to the next candidate
5. If all healthy candidates are exhausted, tries providers in cooldown as a last resort
6. If absolutely all providers fail, returns 502/503 with a summary

### Cooldown

When a provider fails:

- **`Retry-After` header**: If the provider returns this header, its value is used as the cooldown duration (capped at `max_cooldown_seconds`)
- **Exponential backoff**: Otherwise, cooldown starts at `default_cooldown_seconds` and doubles with each consecutive failure, up to `max_cooldown_seconds`
- **Auto-recovery**: When the cooldown period expires, the provider is automatically considered healthy again
- **Success resets**: A successful request resets `consecutive_failures` to 0 and clears cooldown

### Streaming

For streaming requests, failover only happens if the error occurs **before** the first chunk is sent to the client. Once streaming has begun, mid-stream errors propagate as-is — the gateway does not attempt to restart the stream on another provider.

## Admin Endpoints

All admin endpoints require a valid admin API key (or a gateway API key if no separate admin keys are configured).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/status` | Health/cooldown state and counters for every provider |
| POST | `/admin/reload-config` | Reload `config.yaml` without restarting |
| POST | `/admin/providers/{id}/enable` | Enable a provider at runtime |
| POST | `/admin/providers/{id}/disable` | Disable a provider at runtime |
| GET | `/health` | Simple health check (no auth required) |

### Example: Check Provider Status

```bash
curl http://localhost:8000/admin/status \
  -H "Authorization: Bearer sk-gateway-mysecretkey123"
```

### Example: Disable a Provider

```bash
curl -X POST http://localhost:8000/admin/providers/groq-backup/disable \
  -H "Authorization: Bearer sk-gateway-mysecretkey123"
```

## Project Structure

```
llm-gateway/
├── main.py                 # FastAPI app + route definitions
├── config.py               # YAML loader + Pydantic config models
├── health.py               # ProviderHealthTracker (cooldown state)
├── router.py               # Failover routing logic
├── proxy.py                # HTTP forwarding (streaming + non-streaming)
├── logger.py               # Structured JSON logging
├── requirements.txt        # Python dependencies
├── config.yaml.example     # Example configuration
├── Dockerfile              # Container build
├── docker-compose.yml      # Docker Compose setup
├── test_failover.py        # Failover integration test
└── README.md               # This file
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_GATEWAY_CONFIG` | `config.yaml` | Path to the config file |

## License

MIT
