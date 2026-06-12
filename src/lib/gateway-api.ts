/**
 * Gateway API client — all calls go through Next.js API routes
 * which proxy to the Python LLM Gateway backend.
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

export interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  request_id?: string;
  virtual_model?: string;
  outcome?: string;
  final_status?: number;
  provider_id?: string;
  attempts?: Array<{
    provider_id: string;
    status_code: number;
    latency: number;
    error: string | null;
  }>;
  total_latency?: number;
}

// Simulated data for demo (in production, this comes from the real gateway)
const SIMULATED_PROVIDERS: ProviderState[] = [
  {
    provider_id: "openai-primary",
    status: "healthy",
    cooldown_until: null,
    consecutive_failures: 0,
    last_error: null,
    last_success_at: Date.now() / 1000 - 12,
    total_requests: 1847,
    total_successes: 1792,
    total_failures: 55,
  },
  {
    provider_id: "groq-backup",
    status: "healthy",
    cooldown_until: null,
    consecutive_failures: 0,
    last_error: null,
    last_success_at: Date.now() / 1000 - 45,
    total_requests: 312,
    total_successes: 298,
    total_failures: 14,
  },
  {
    provider_id: "together-backup",
    status: "cooldown",
    cooldown_until: Date.now() / 1000 + 18,
    consecutive_failures: 3,
    last_error: "HTTP 429: Rate limit exceeded",
    last_success_at: Date.now() / 1000 - 3600,
    total_requests: 156,
    total_successes: 134,
    total_failures: 22,
  },
];

const SIMULATED_MODELS: VirtualModel[] = [
  { id: "gpt-4o", object: "model", created: 1700000000, owned_by: "llm-gateway", providers: ["openai-primary", "groq-backup", "together-backup"] },
  { id: "gpt-4o-mini", object: "model", created: 1700000000, owned_by: "llm-gateway", providers: ["openai-primary", "groq-backup", "together-backup"] },
  { id: "text-embedding-3-small", object: "model", created: 1700000000, owned_by: "llm-gateway", providers: ["openai-primary", "together-backup"] },
];

// Request history for demo
export interface RequestHistoryEntry {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  status: "success" | "failover" | "failed";
  latency_ms: number;
  tokens_used?: number;
}

const generateRequestHistory = (): RequestHistoryEntry[] => {
  const models = ["gpt-4o", "gpt-4o-mini", "text-embedding-3-small"];
  const providers = ["openai-primary", "groq-backup", "together-backup"];
  const statuses: Array<"success" | "failover" | "failed"> = ["success", "success", "success", "success", "success", "failover", "success", "failed"];
  const entries: RequestHistoryEntry[] = [];

  for (let i = 0; i < 50; i++) {
    const minsAgo = Math.random() * 120;
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    entries.push({
      id: `req-${(1000 + i).toString()}`,
      timestamp: new Date(Date.now() - minsAgo * 60000).toISOString(),
      model: models[Math.floor(Math.random() * models.length)],
      provider: providers[Math.floor(Math.random() * providers.length)],
      status,
      latency_ms: status === "failover" ? 800 + Math.random() * 1200 : 100 + Math.random() * 500,
      tokens_used: status !== "failed" ? Math.floor(50 + Math.random() * 950) : undefined,
    });
  }

  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// Chart data generators
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

// ---- Data access functions ----

export async function getGatewayStatus(): Promise<GatewayStatus> {
  return { providers: SIMULATED_PROVIDERS, failover_count: 69 };
}

export async function getModels(): Promise<ModelsResponse> {
  return { object: "list", data: SIMULATED_MODELS };
}

export async function getRequestHistory(): Promise<RequestHistoryEntry[]> {
  return generateRequestHistory();
}

export async function toggleProvider(providerId: string, enabled: boolean): Promise<void> {
  // Simulate API call
  const provider = SIMULATED_PROVIDERS.find(p => p.provider_id === providerId);
  if (provider) {
    // In production, this would hit POST /admin/providers/{id}/enable|disable
  }
}

export async function reloadConfig(): Promise<{ status: string; message: string }> {
  // Simulate API call
  return { status: "ok", message: "Config reloaded successfully" };
}
