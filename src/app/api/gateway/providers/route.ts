import { NextRequest, NextResponse } from "next/server";
import { GATEWAY_BASE_URL, gatewayHeaders, USE_SIMULATED_DATA } from "@/lib/gateway-config";

// POST /api/gateway/providers?action=enable|disable&provider_id=xxx
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action"); // "enable" or "disable"
  const providerId = searchParams.get("provider_id");

  if (!action || !providerId) {
    return NextResponse.json({ error: "Missing action or provider_id" }, { status: 400 });
  }

  if (!["enable", "disable"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (USE_SIMULATED_DATA) {
    return NextResponse.json({
      status: "ok",
      message: `Provider '${providerId}' ${action}d`,
    });
  }

  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/providers/${providerId}/${action}`, {
      method: "POST",
      headers: gatewayHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Gateway unreachable" },
      { status: 502 }
    );
  }
}
