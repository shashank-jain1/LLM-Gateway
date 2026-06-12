# LLM Gateway

A self-hosted **multi-provider LLM API Gateway** with automatic failover and a beautiful admin dashboard.

## Project Structure

```
LLM Gateway/
├── frontend/              # Next.js admin dashboard
│   ├── src/              # React components, API routes, lib
│   ├── public/           # Static assets
│   ├── prisma/           # Database schema
│   └── package.json      # Frontend dependencies
│
├── backend/              # Python FastAPI gateway
│   ├── main.py          # FastAPI app + routes
│   ├── config.py        # Configuration management
│   ├── health.py        # Provider health tracking
│   ├── router.py        # Failover routing logic
│   ├── proxy.py         # HTTP forwarding
│   ├── logger.py        # Structured logging
│   ├── history.py       # Request history
│   ├── db/              # SQLite database
│   └── config.yaml.example
│
├── docker/              # Docker configurations
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── Caddyfile
│
└── docs/                # Documentation
    ├── GATEWAY_README.md
    ├── worklog.md
    └── examples/
```

## Features

### Backend (Python Gateway)
- **OpenAI-compatible API** — drop-in replacement
- **Automatic failover** — seamless provider switching
- **Streaming support** — SSE passthrough
- **Model name mapping** — virtual model names
- **Priority-based routing** — configurable provider order
- **Exponential backoff cooldown** — auto-recovery
- **Hot-reloadable config** — no restart needed
- **Admin API** — full control at runtime

### Frontend (Next.js Dashboard)
- **Real-time monitoring** — live provider status
- **Provider management** — CRUD operations
- **Request history** — detailed logs and analytics
- **Performance charts** — latency, volume, errors
- **Model mapping** — visual model configuration
- **Settings management** — edit gateway config
- **Dark mode** — beautiful UI with Tailwind + shadcn/ui

## Quick Start

### Backend (Python Gateway)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create config
cp config.yaml.example config.yaml
# Edit config.yaml with your API keys

# Run
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend (Next.js Dashboard)

```bash
cd frontend

# Install dependencies
npm install
# or
bun install

# Run development server
npm run dev
# or
bun dev

# Open http://localhost:3000
```

### Docker

```bash
cd docker

# Edit config
cp ../backend/config.yaml.example config.yaml
# Add your API keys

# Build and run
docker-compose up -d
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

### Admin Dashboard

1. Start the backend gateway: `cd backend && python main.py`
2. Start the frontend: `cd frontend && npm run dev`
3. Open http://localhost:3000
4. Manage providers, view logs, monitor performance

## Configuration

See `backend/config.yaml.example` for full configuration options.

Key settings:
- `gateway.api_keys` - Authentication tokens
- `gateway.admin_api_keys` - Admin endpoint tokens
- `providers` - List of LLM providers with priorities

## Documentation

- [Gateway Documentation](docs/GATEWAY_README.md) - Detailed backend docs
- [Work Log](docs/worklog.md) - Development history
- [Examples](docs/examples/) - Code examples

## License

MIT
