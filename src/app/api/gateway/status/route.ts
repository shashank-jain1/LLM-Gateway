import { NextResponse } from "next/server";
import { gatewayFetch } from "@/lib/gateway-manager";

export async function GET() {
  try {
    const res = await gatewayFetch("/admin/status");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Gateway unreachable", detail: err.message },
      { status: 502 }
    );
  }
}
