-- Supabase Initialization for LLM Gateway
-- This script sets up the database tables for provider configs,
-- request history, and settings.

-- Enable the UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Providers table
CREATE TABLE IF NOT EXISTS providers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    api_key TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    priority INT NOT NULL DEFAULT 1,
    models JSONB NOT NULL DEFAULT '[]'::jsonb,
    cooldown_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Request history table
CREATE TABLE IF NOT EXISTS request_history (
    id BIGSERIAL PRIMARY KEY,
    req_id TEXT NOT NULL UNIQUE,
    timestamp TIMESTAMP DEFAULT NOW(),
    virtual_model TEXT NOT NULL,
    provider_id BIGINT REFERENCES providers(id) ON DELETE SET NULL,
    status TEXT NOT NULL, -- 'success', 'failover', 'failed'
    status_code INT,
    latency_ms REAL,
    tokens_used INT,
    error TEXT,
    attempt_count INT DEFAULT 0,
    attempts JSONB DEFAULT '[]'::jsonb,
    api_key TEXT
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    key TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'client', -- 'client' or 'admin'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_request_history_timestamp ON request_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_request_history_provider ON request_history(provider_id);

-- Insert default settings
INSERT INTO settings (key, value) VALUES ('gateway', '{"port": 4000, "default_cooldown_seconds": 60, "request_history_size": 1000}'::jsonb)
ON CONFLICT (key) DO NOTHING;
