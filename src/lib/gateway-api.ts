/**
 * Gateway API client — calls Next.js API routes which proxy to the
 * Python LLM Gateway backend.  Falls back to simulated data when
 * the gateway is unreachable.
 */

export interface ProviderState {
  provider_id: string;
  status: "healthy" | "cooldown";
  cooldown_until: number | null;
  consecutive_failures: number;
  last_error: string | null;
  last_success_at: number | null;
  total_requests: number;
  total_successes: number;
  total_failures: number;
}

export interface GatewayStatus {
  providers: ProviderState[];
  failover_count: number;
}

export interface VirtualModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  providers: string[];
}

export interface ModelsResponse {
  object: string;
  data: VirtualModel[];
}

export interface RequestHistoryEntry {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  status: "success" | "failover" | "failed";
  latency_ms: number;
  tokens_used?: number;
}

// ---- Data access functions (all call Next.js API routes) ----

export async function getGatewayStatus(): Promise<GatewayStatus> {
  const res = await fetch("/api/gateway/status");
  if (!res.ok) throw new Error("Failed to fetch gateway status");
  return res.json();
}

export async function getModels(): Promise<ModelsResponse> {
  const res = await fetch("/api/gateway/models");
  if (!res.ok) throw new Error("Failed to fetch models");
  return res.json();
}

export async function getRequestHistory(): Promise<RequestHistoryEntry[]> {
  const res = await fetch("/api/gateway/requests");
  if (!res.ok) throw new Error("Failed to fetch request history");
  return res.json();
}

export async function toggleProvider(
  providerId: string,
  action: "enable" | "disable"
): Promise<{ status: string; message: string }> {
  const res = await fetch(
    `/api/gateway/providers?action=${action}&provider_id=${encodeURIComponent(providerId)}`,
    { method: "POST" }
  );
  return res.json();
}

export async function reloadConfig(): Promise<{ status: string; message: string }> {
  const res = await fetch("/api/gateway/reload", { method: "POST" });
  return res.json();
}

// ---- Chart data generators (client-side) ----

export const generateLatencyTimeline = () => {
  const points = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(Date.now() - i * 3600000);
    points.push({
      time: `${hour.getHours().toString().padStart(2, "0")}:00`,
      openai: 150 + Math.random() * 200,
      groq: 50 + Math.random() * 100,
      together: 200 + Math.random() * 300,
    });
  }
  return points;
};

export const generateRequestVolume = () => {
  const points = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(Date.now() - i * 3600000);
    points.push({
      time: `${hour.getHours().toString().padStart(2, "0")}:00`,
      requests: Math.floor(40 + Math.random() * 160),
      failovers: Math.floor(Math.random() * 15),
      failures: Math.floor(Math.random() * 5),
    });
  }
  return points;
};

export const generateErrorDistribution = () => [
  { name: "429 Rate Limit", value: 42, fill: "var(--color-chart-1)" },
  { name: "502 Bad Gateway", value: 18, fill: "var(--color-chart-2)" },
  { name: "503 Unavailable", value: 12, fill: "var(--color-chart-3)" },
  { name: "Timeout", value: 24, fill: "var(--color-chart-4)" },
  { name: "Connection Error", value: 8, fill: "var(--color-chart-5)" },
];
