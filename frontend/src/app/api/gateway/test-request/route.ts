import { NextRequest, NextResponse } from "next/server";
import { gatewayFetch } from "@/lib/gateway-manager";

// POST: send a test chat completion request through the gateway
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await gatewayFetch("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: `Gateway unreachable: ${err.message}`, type: "gateway_error" } },
      { status: 502 }
    );
  }
}
