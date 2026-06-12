"""
In-memory request history store.

Keeps a rolling buffer of the last N proxied requests with their
outcomes, so the admin dashboard can display a live request log.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class RequestRecord:
    id: str
    timestamp: float
    virtual_model: str
    provider_id: Optional[str]
    status: str  # "success" | "failover" | "failed"
    status_code: int
    latency_ms: float
    tokens_used: Optional[int] = None
    error: Optional[str] = None
    attempts: List[Dict[str, Any]] = field(default_factory=list)
    api_key: Optional[str] = None


class RequestHistory:
    """Thread-safe rolling buffer of request records."""

    def __init__(self, max_size: int = 1000) -> None:
        self._records: deque[RequestRecord] = deque(maxlen=max_size)
        self._counter: int = 0

    def add(
        self,
        virtual_model: str,
        provider_id: Optional[str],
        attempt_log: List[Dict[str, Any]],
        final_status: int,
        total_latency: float,
        api_key: Optional[str] = None,
    ) -> RequestRecord:
        self._counter += 1
        req_id = f"req-{self._counter:06d}"

        # Determine outcome
        if 200 <= final_status < 300:
            status = "success"
            # Check if failover happened (more than 1 attempt, first one failed)
            if len(attempt_log) > 1:
                first = attempt_log[0]
                if first.get("error") or (first.get("status_code") and first["status_code"] != final_status):
                    status = "failover"
        else:
            status = "failed"

        record = RequestRecord(
            id=req_id,
            timestamp=time.time(),
            virtual_model=virtual_model,
            provider_id=provider_id,
            status=status,
            status_code=final_status,
            latency_ms=total_latency * 1000,  # convert to ms
            attempts=attempt_log,
            api_key=api_key,
        )
        self._records.append(record)
        return record

    def get_recent(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Return the most recent records as dicts (newest first)."""
        records = list(self._records)
        records.reverse()
        result = []
        for r in records[:limit]:
            result.append({
                "id": r.id,
                "timestamp": r.timestamp,
                "virtual_model": r.virtual_model,
                "provider_id": r.provider_id,
                "status": r.status,
                "status_code": r.status_code,
                "latency_ms": round(r.latency_ms, 2),
                "tokens_used": r.tokens_used,
                "error": r.error,
                "attempt_count": len(r.attempts),
                "api_key": r.api_key,
            })
        return result

    @property
    def total_count(self) -> int:
        return len(self._records)


# Global instance
request_history = RequestHistory()
