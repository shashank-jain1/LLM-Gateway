# Master Prompt: Multi-Provider LLM API Gateway with Automatic Failover

## Project Goal

Build a self-hosted **LLM API Gateway** that exposes a single OpenAI-compatible
endpoint (e.g. `/v1/chat/completions`, `/v1/completions`, `/v1/models`).
Internally, it routes requests to one of several configured backend
providers (each OpenAI-compatible, with their own base URL, API key, and
model names). If the active backend returns an error (HTTP 429, 5xx,
timeout, connection error, or invalid response), the gateway automatically
retries the **same request** against the next healthy backend, transparent
to the caller. The caller never sees the error — they just get a successful
response (unless ALL configured backends fail).

The end result: I configure N providers once, point all my apps at this one
gateway with one API key, and the gateway handles rate limits / outages /
provider downtime by silently switching providers.

---

## Tech Stack

- **Language/Framework:** Python 3.11+ with FastAPI + Uvicorn
- **HTTP client:** `httpx` (async, supports streaming)
- **Config storage:** YAML file (`config.yaml`) for provider definitions,
  hot-reloadable without restart if possible
- **Persistence for health/cooldown state:** in-memory is fine for v1
  (single-process deployment), but structure the code so it could later move
  to Redis
- **Auth for the gateway itself:** simple bearer token(s) defined in config
- **Logging:** structured logging (JSON lines) to stdout + optional log file

---

## Functional Requirements

### 1. Provider Configuration

Store a list of providers in `config.yaml`, each with:

```yaml
gateway:
  api_keys:
    - "sk-gateway-mysecretkey123"   # keys clients use to call THIS gateway
  port: 8000
  default_cooldown_seconds: 30       # cooldown after a provider errors
  max_cooldown_seconds: 600          # cap for exponential backoff
  request_timeout_seconds: 60
  log_level: "info"

providers:
  - id: "openai-primary"
    enabled: true
    priority: 1                      # lower number = tried first
    base_url: "https://api.openai.com/v1"
    api_key: "sk-xxxxxxxx"
    models:
      "gpt-4o": "gpt-4o"              # virtual_model_name: provider_model_name
      "gpt-4o-mini": "gpt-4o-mini"

  - id: "groq-backup"
    enabled: true
    priority: 2
    base_url: "https://api.groq.com/openai/v1"
    api_key: "gsk-xxxxxxxx"
    models:
      "gpt-4o": "llama-3.3-70b-versatile"   # maps virtual name -> groq's model

  - id: "together-backup"
    enabled: true
    priority: 3
    base_url: "https://api.together.xyz/v1"
    api_key: "together-xxxxxxxx"
    models:
      "gpt-4o": "meta-llama/Llama-3.3-70B-Instruct-Turbo"
```

Key points:
- The client sends a **virtual model name** (e.g. `"gpt-4o"`).
- Each provider maps that virtual name to whatever model string it actually
  needs. This lets you fail over even between providers with completely
  different model catalogs.
- `priority` defines the default try-order. Providers with the same priority
  can be load-balanced round-robin.

### 2. Gateway Endpoints

Implement OpenAI-compatible routes:

- `POST /v1/chat/completions` — supports both streaming (`stream: true`,
  SSE) and non-streaming
- `POST /v1/completions` (legacy, optional but nice to have)
- `POST /v1/embeddings`
- `GET /v1/models` — returns the union of virtual model names across all
  enabled providers

All routes require `Authorization: Bearer <gateway_api_key>` matching one of
`gateway.api_keys`. Return `401` if missing/invalid.

### 3. Routing & Failover Logic

For each incoming request:

1. Resolve the requested virtual model name. Build an ordered list of
   candidate providers that (a) are `enabled`, (b) support this virtual
   model, (c) are not currently in cooldown, sorted by `priority` (and
   round-robin among equal priorities).
2. If the candidate list is empty (all providers down/cooling), either:
   - Try providers that are in cooldown anyway as a last resort (better to
     attempt than to hard-fail), **or**
   - Return a `503` with a clear error body.
   (Implement the "try anyway as last resort" behavior — prefer availability
   over strict cooldown enforcement.)
3. Try the first candidate:
   - Rewrite the request body: substitute the provider's actual model name
     for the virtual one.
   - Forward to `{provider.base_url}/chat/completions` (or relevant path)
     with the provider's own API key, preserving headers as needed.
   - **Non-streaming:** if response status is 429 or >=500, or the request
     times out / connection fails, mark provider as failed (see cooldown
     logic below) and move to the next candidate. If status is 2xx, return
     the response to the client as-is.
   - **Streaming:** Only failover if the error occurs *before* the first
     chunk is sent to the client (i.e. check the initial response status
     before starting to stream). Once streaming has begun, do not failover —
     just propagate any mid-stream error or close gracefully.
4. If all candidates fail, return a `502`/`503` with a JSON body summarizing
   which providers were tried and their errors.

### 4. Cooldown / Health Tracking

Maintain in-memory state per provider:

```python
{
  "provider_id": "groq-backup",
  "status": "healthy" | "cooldown",
  "cooldown_until": <timestamp or None>,
  "consecutive_failures": 0,
  "last_error": None,
  "last_success_at": <timestamp>,
}
```

- On error (429/5xx/timeout): increment `consecutive_failures`, set
  `cooldown_until = now + cooldown`, where `cooldown` is:
  - If the provider returns a `Retry-After` header, honor that value
    (capped at `max_cooldown_seconds`).
  - Otherwise use exponential backoff starting at
    `default_cooldown_seconds`, doubling each consecutive failure, capped at
    `max_cooldown_seconds`.
- On success: reset `consecutive_failures = 0`, clear `cooldown_until`,
  update `last_success_at`.
- A provider in cooldown is skipped in routing unless it's the only option
  (see step 2 above).

### 5. Admin / Observability Endpoints

Add a small set of endpoints (protected by the same gateway API key, or a
separate admin key):

- `GET /admin/status` — returns current health/cooldown state of every
  provider, plus basic counters (requests routed, failovers triggered, per
  provider).
- `POST /admin/reload-config` — reload `config.yaml` without restarting the
  process.
- `POST /admin/providers/{id}/enable` and `/disable` — toggle a provider at
  runtime.

### 6. Logging

For every request, log (as structured JSON):
- timestamp, request id, virtual model requested
- ordered list of providers attempted
- for each attempt: provider id, status code / error, latency
- final outcome (success / which provider served it / total failure)

This is essential for debugging which provider is flaky.

---

## Non-Functional Requirements

- Should run as a single Python process (`uvicorn main:app`), easy to deploy
  with Docker.
- Provide a `Dockerfile` and `docker-compose.yml` for easy self-hosting.
- Config changes via `config.yaml` shouldn't require code changes to add a
  new provider — just add an entry.
- Code should be modular: separate files/modules for `config.py`,
  `router.py` (failover logic), `health.py` (cooldown tracking), `proxy.py`
  (HTTP forwarding), `main.py` (FastAPI app + routes).
- Include a `.env.example` or config example with placeholder keys (never
  commit real keys).
- Include a `README.md` explaining setup, configuration format, and how to
  add/remove providers.

---

## Deliverables

1. Full project source code per the module breakdown above.
2. `config.yaml.example` with at least 3 example providers (OpenAI, Groq,
   Together/OpenRouter style) showing the model-mapping pattern.
3. `Dockerfile` + `docker-compose.yml`.
4. `README.md` covering: setup, running locally, running via Docker,
   configuration reference, adding a new provider, and how failover/cooldown
   behaves.
5. A short test script (e.g. `test_failover.py` or curl examples) that
   demonstrates: (a) normal request succeeds via primary provider, (b)
   simulating a 429 from primary causes automatic failover to the secondary
   provider with a successful response returned to the caller.

---

## Build Order (suggested)

1. Scaffold FastAPI app + config loader (YAML parsing, validation with
   Pydantic models for `Provider` and `GatewayConfig`).
2. Implement the provider health/cooldown tracker as its own class
   (`ProviderHealthTracker`), independently testable.
3. Implement the proxy/forwarding logic for non-streaming
   `/v1/chat/completions`, including model-name remapping.
4. Wire in the failover loop using the health tracker + ordered candidate
   list.
5. Add streaming support (SSE passthrough) with the "fail over only before
   first byte" rule.
6. Add `/v1/models` and `/v1/embeddings`.
7. Add admin endpoints.
8. Add structured logging.
9. Write Dockerfile, docker-compose, README, and test script.
