import { NextResponse } from "next/server";
import { GATEWAY_BASE_URL, gatewayHeaders, USE_SIMULATED_DATA } from "@/lib/gateway-config";

export async function POST() {
  if (USE_SIMULATED_DATA) {
    return NextResponse.json({ status: "ok", message: "Config reloaded successfully" });
  }

  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/admin/reload-config`, {
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
