/**
 * Gateway configuration — reads from environment or falls back to defaults.
 * The Python gateway can run alongside this Next.js server.
 */

// The Python LLM Gateway host/port
export const GATEWAY_BASE_URL = process.env.LLM_GATEWAY_URL || "http://127.0.0.1:8001";

// Gateway API key for admin endpoints
export const GATEWAY_ADMIN_KEY = process.env.LLM_GATEWAY_ADMIN_KEY || "sk-gateway-mysecretkey123";

export function gatewayHeaders() {
  return {
    Authorization: `Bearer ${GATEWAY_ADMIN_KEY}`,
    "Content-Type": "application/json",
  };
}
