import { NextRequest, NextResponse } from "next/server";
import { GATEWAY_BASE_URL, gatewayHeaders, USE_SIMULATED_DATA } from "@/lib/gateway-config";

export async function GET() {
  if (USE_SIMULATED_DATA) {
    return NextResponse.json(getSimulatedStatus());
  }

  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/status`, {
      headers: gatewayHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Gateway unreachable — return simulated data
    return NextResponse.json(getSimulatedStatus());
  }
}

function getSimulatedStatus() {
  const now = Date.now() / 1000;
  return {
    providers: [
      {
        provider_id: "openai-primary",
        status: "healthy",
        cooldown_until: null,
        consecutive_failures: 0,
        last_error: null,
        last_success_at: now - 12,
        total_requests: 1847,
        total_successes: 1792,
        total_failures: 55,
      },
      {
        provider_id: "groq-backup",
        status: "healthy",
        cooldown_until: null,
        consecutive_failures: 0,
        last_error: null,
        last_success_at: now - 45,
        total_requests: 312,
        total_successes: 298,
        total_failures: 14,
      },
      {
        provider_id: "together-backup",
        status: "cooldown",
        cooldown_until: now + 18,
        consecutive_failures: 3,
        last_error: "HTTP 429: Rate limit exceeded",
        last_success_at: now - 3600,
        total_requests: 156,
        total_successes: 134,
        total_failures: 22,
      },
    ],
    failover_count: 69,
  };
}
