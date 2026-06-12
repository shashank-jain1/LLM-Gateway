import { NextRequest, NextResponse } from "next/server";
import { gatewayFetch } from "@/lib/gateway-manager";

// GET: fetch real request history from the Python gateway backend
export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get("limit") || "100";
  try {
    const res = await gatewayFetch(`/admin/requests?limit=${limit}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Gateway unreachable", detail: err.message },
      { status: 502 }
    );
  }
}
