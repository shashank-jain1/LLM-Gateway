import { NextRequest, NextResponse } from "next/server";
import { gatewayFetch } from "@/lib/gateway-manager";

// GET: fetch full gateway config
export async function GET() {
  try {
    const res = await gatewayFetch("/admin/config");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Gateway unreachable", detail: err.message },
      { status: 502 }
    );
  }
}

// PUT: update gateway settings (cooldowns, timeout, log level, api_keys, etc.)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await gatewayFetch("/admin/config", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: "Gateway unreachable" },
      { status: 502 }
    );
  }
}
