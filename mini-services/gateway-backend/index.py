#!/usr/bin/env python3
"""Start the LLM Gateway as a persistent service."""
import os
import sys

os.environ["LLM_GATEWAY_CONFIG"] = os.path.join(os.path.dirname(__file__), "config.yaml")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, log_level="error")
