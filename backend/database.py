"""
Database connection and utilities for Supabase / Postgres.
"""

from __future__ import annotations

import os
import json
import logging
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def get_connection() -> psycopg2.extensions.connection:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return psycopg2.connect(dsn, cursor_factory=RealDictCursor)


def execute_query(
    query: str,
    params: Optional[tuple] = None,
    fetch: bool = False,
    commit: bool = False,
) -> List[Dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(query, params)
        if commit:
            conn.commit()
        if fetch:
            return list(cur.fetchall())
        return []
    except Exception as exc:
        conn.rollback()
        logger.error(f"Database query failed: {exc}\nQuery: {query}\nParams: {params}")
        raise
    finally:
        cur.close()
        conn.close()

# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------

def get_providers(enabled_only: bool = False) -> List[Dict[str, Any]]:
    query = "SELECT * FROM providers"
    params: tuple = ()
    if enabled_only:
        query += " WHERE enabled = %s"
        params = (True,)
    query += " ORDER BY priority DESC, name"
    return execute_query(query, params, fetch=True)


def get_provider_by_name(name: str) -> Optional[Dict[str, Any]]:
    rows = execute_query("SELECT * FROM providers WHERE name = %s", (name,), fetch=True)
    return rows[0] if rows else None


def update_provider_priority(name: str, priority: int) -> None:
    execute_query(
        "UPDATE providers SET priority = %s WHERE name = %s",
        (priority, name),
        commit=True,
    )


def toggle_provider(name: str, enabled: bool) -> None:
    execute_query(
        "UPDATE providers SET enabled = %s WHERE name = %s",
        (enabled, name),
        commit=True,
    )


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

def get_settings() -> Dict[str, Any]:
    rows = execute_query("SELECT * FROM settings", fetch=True)
    if not rows:
        return {}
    # Return a flat dict of key -> value
    settings: Dict[str, Any] = {}
    for row in rows:
        settings[row["key"]] = row["value"]
    return settings


def update_setting(key: str, value: Any) -> None:
    execute_query(
        "INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        (key, json.dumps(value) if not isinstance(value, str) else value),
        commit=True,
    )


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------

def get_api_keys() -> List[Dict[str, Any]]:
    return execute_query("SELECT * FROM api_keys", fetch=True)


def get_api_key_by_key(key: str) -> Optional[Dict[str, Any]]:
    rows = execute_query("SELECT * FROM api_keys WHERE key = %s", (key,), fetch=True)
    return rows[0] if rows else None


def create_api_key(name: str, key: str, is_admin: bool = False) -> None:
    execute_query(
        "INSERT INTO api_keys (name, key, is_admin) VALUES (%s, %s, %s) ON CONFLICT (key) DO NOTHING",
        (name, key, is_admin),
        commit=True,
    )


# ---------------------------------------------------------------------------
# Request history
# ---------------------------------------------------------------------------

def add_request_record(
    req_id: str,
    virtual_model: str,
    provider_name: Optional[str],
    status: str,
    status_code: int,
    latency_ms: float,
    attempts: List[Dict[str, Any]],
    api_key: Optional[str] = None,
) -> None:
    provider = get_provider_by_name(provider_name) if provider_name else None
    provider_id = provider["id"] if provider else None
    query = """
        INSERT INTO request_history
        (req_id, virtual_model, provider_id, status, status_code, latency_ms, attempts, api_key, attempt_count)
        VALUES (%s, %s, %s, %s, %s, %s, %