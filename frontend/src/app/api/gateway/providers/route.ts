import { NextRequest, NextResponse } from "next/server";
import { gatewayFetch } from "@/lib/gateway-manager";

// GET: list request history
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

// POST: add a new provider
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await gatewayFetch("/admin/providers", {
      method: "POST",
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

// DELETE: remove a provider
export async function DELETE(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get("provider_id");
  if (!providerId) {
    return NextResponse.json(
      { status: "error", message: "Missing provider_id" },
      { status: 400 }
    );
  }
  try {
    const res = await gatewayFetch(`/admin/providers/${encodeURIComponent(providerId)}`, {
      method: "DELETE",
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

// PUT: update a provider
export async function PUT(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get("provider_id");
  if (!providerId) {
    return NextResponse.json(
      { status: "error", message: "Missing provider_id" },
      { status: 400 }
    );
  }
  try {
    const body = await req.json();
    const res = await gatewayFetch(`/admin/providers/${encodeURIComponent(providerId)}`, {
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
