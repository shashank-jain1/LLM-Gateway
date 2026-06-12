import { NextResponse } from "next/server";
import { gatewayFetch } from "@/lib/gateway-manager";

export async function POST() {
  try {
    const res = await gatewayFetch("/admin/reload-config", { method: "POST" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: "Gateway unreachable" },
      { status: 502 }
    );
  }
}
