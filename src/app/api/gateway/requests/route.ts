import { NextResponse } from "next/server";

// Simulated request history — in production this would come from a log aggregation service
export async function GET() {
  const models = ["gpt-4o", "gpt-4o-mini", "text-embedding-3-small"];
  const providers = ["openai-primary", "groq-backup", "together-backup"];
  const statuses: Array<"success" | "failover" | "failed"> = [
    "success", "success", "success", "success", "success",
    "failover", "success", "failed",
  ];
  const entries = [];

  for (let i = 0; i < 50; i++) {
    const minsAgo = Math.random() * 120;
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    entries.push({
      id: `req-${(1000 + i).toString()}`,
      timestamp: new Date(Date.now() - minsAgo * 60000).toISOString(),
      model: models[Math.floor(Math.random() * models.length)],
      provider: providers[Math.floor(Math.random() * providers.length)],
      status,
      latency_ms:
        status === "failover"
          ? 800 + Math.random() * 1200
          : 100 + Math.random() * 500,
      tokens_used: status !== "failed" ? Math.floor(50 + Math.random() * 950) : undefined,
    });
  }

  entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json(entries);
}
