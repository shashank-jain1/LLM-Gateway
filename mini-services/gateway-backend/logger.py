"""
Structured JSON logging for the LLM Gateway.

Provides a `structlog`-style logger that emits one JSON line per event.
Every proxied request is logged with a full audit trail: which providers
were tried, latencies, and the final outcome.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# JSON formatter
# ---------------------------------------------------------------------------

class JSONFormatter(logging.Formatter):
    """Emit one JSON object per log record."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Merge any extra fields passed via `extra={...}`
        if hasattr(record, "struct_data") and isinstance(record.struct_data, dict):
            log_entry.update(record.struct_data)

        # Include exception info if present
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

_logger: Optional[logging.Logger] = None


def setup_logging(log_level: str = "info", log_file: Optional[str] = None) -> logging.Logger:
    """Configure and return the gateway logger."""
    global _logger
    logger = logging.getLogger("llm_gateway")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Remove existing handlers
    logger.handlers.clear()

    formatter = JSONFormatter(datefmt="%Y-%m-%dT%H:%M:%S")

    # Stdout handler
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(formatter)
    logger.addHandler(sh)

    # Optional file handler
    if log_file:
        fh = logging.FileHandler(log_file)
        fh.setFormatter(formatter)
        logger.addHandler(fh)

    _logger = logger
    return logger


def get_logger() -> logging.Logger:
    """Return the gateway logger, initialising if needed."""
    global _logger
    if _logger is None:
        _logger = setup_logging()
    return _logger


# ---------------------------------------------------------------------------
# Structured helpers
# ---------------------------------------------------------------------------

def log_request(
    request_id: str,
    virtual_model: str,
    attempt_log: List[Dict[str, Any]],
    final_status: int,
    provider_id: Optional[str] = None,
    total_latency: Optional[float] = None,
) -> None:
    """Emit a structured log line for a completed proxied request."""
    outcome = "success" if 200 <= final_status < 300 else "failure"
    struct_data = {
        "request_id": request_id,
        "virtual_model": virtual_model,
        "outcome": outcome,
        "final_status": final_status,
        "provider_id": provider_id,
        "attempts": attempt_log,
        "total_latency": round(total_latency, 4) if total_latency else None,
    }
    get_logger().info(
        f"request {outcome} model={virtual_model} provider={provider_id}",
        extra={"struct_data": struct_data},
    )
