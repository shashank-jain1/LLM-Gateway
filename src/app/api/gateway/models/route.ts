import { NextResponse } from "next/server";
import { GATEWAY_BASE_URL, gatewayHeaders, USE_SIMULATED_DATA } from "@/lib/gateway-config";

export async function GET() {
  if (USE_SIMULATED_DATA) {
    return NextResponse.json(getSimulatedModels());
  }

  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/v1/models`, {
      headers: gatewayHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(getSimulatedModels());
  }
}

function getSimulatedModels() {
  return {
    object: "list",
    data: [
      {
        id: "gpt-4o",
        object: "model",
        created: 1700000000,
        owned_by: "llm-gateway",
        providers: ["openai-primary", "groq-backup", "together-backup"],
      },
      {
        id: "gpt-4o-mini",
        object: "model",
        created: 1700000000,
        owned_by: "llm-gateway",
        providers: ["openai-primary", "groq-backup", "together-backup"],
      },
      {
        id: "text-embedding-3-small",
        object: "model",
        created: 1700000000,
        owned_by: "llm-gateway",
        providers: ["openai-primary", "together-backup"],
      },
    ],
  };
}
