import { NextRequest, NextResponse } from "next/server";
import { gatewayFetch } from "@/lib/gateway-manager";

// POST: enable or disable a provider
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("provider_id");
  const action = searchParams.get("action"); // "enable" or "disable"

  if (!providerId || !action || !["enable", "disable"].includes(action)) {
    return NextResponse.json(
      { error: "Missing or invalid provider_id / action" },
      { status: 400 }
    );
  }

  try {
    const res = await gatewayFetch(
      `/admin/providers/${encodeURIComponent(providerId)}/${action}`,
      { method: "POST" }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: "Gateway unreachable" },
      { status: 502 }
    );
  }
}
