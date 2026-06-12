/**
 * Gateway API client — calls Next.js API routes which proxy to the
 * Python LLM Gateway backend. All data is LIVE from the real gateway.
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
  enabled: boolean;
  priority: number;
  base_url: string;
  models: Record<string, string>;
}

export interface GatewayStatus {
  providers: ProviderState[];
  failover_count: number;
  total_requests: number;
  gateway: {
    port: number;
    host: string;
    default_cooldown_seconds: number;
    max_cooldown_seconds: number;
    request_timeout_seconds: number;
    log_level: string;
  };
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
  timestamp: number;
  virtual_model: string;
  provider_id: string | null;
  status: "success" | "failover" | "failed";
  status_code: number;
  latency_ms: number;
  tokens_used: number | null;
  error: string | null;
  attempt_count: number;
}

export interface GatewayConfig {
  gateway: {
    api_keys: string[];
    port: number;
    host: string;
    default_cooldown_seconds: number;
    max_cooldown_seconds: number;
    request_timeout_seconds: number;
    log_level: string;
  };
  providers: Array<{
    id: string;
    enabled: boolean;
    priority: number;
    base_url: string;
    api_key: string;
    models: Record<string, string>;
    extra_headers?: Record<string, string>;
  }>;
}

// ---- Data access functions (all call Next.js API routes → live gateway) ----

export async function getGatewayStatus(): Promise<GatewayStatus> {
  const res = await fetch("/api/gateway/status");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Failed to fetch gateway status");
  }
  return res.json();
}

export async function getModels(): Promise<ModelsResponse> {
  const res = await fetch("/api/gateway/models");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Failed to fetch models");
  }
  return res.json();
}

export async function getRequestHistory(limit = 100): Promise<RequestHistoryEntry[]> {
  const res = await fetch(`/api/gateway/requests?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Failed to fetch request history");
  }
  return res.json();
}

export async function getGatewayConfig(): Promise<GatewayConfig> {
  const res = await fetch("/api/gateway/config");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Failed to fetch config");
  }
  return res.json();
}

export async function toggleProvider(
  providerId: string,
  action: "enable" | "disable"
): Promise<{ status: string; message: string }> {
  const res = await fetch(
    `/api/gateway/toggle?provider_id=${encodeURIComponent(providerId)}&action=${action}`,
    { method: "POST" }
  );
  return res.json();
}

export async function addProvider(provider: {
  id: string;
  enabled: boolean;
  priority: number;
  base_url: string;
  api_key: string;
  models: Record<string, string>;
}): Promise<{ status: string; message: string; provider: any }> {
  const res = await fetch("/api/gateway/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(provider),
  });
  return res.json();
}

export async function deleteProvider(
  providerId: string
): Promise<{ status: string; message: string }> {
  const res = await fetch(
    `/api/gateway/providers?provider_id=${encodeURIComponent(providerId)}`,
    { method: "DELETE" }
  );
  return res.json();
}

export async function updateProvider(
  providerId: string,
  updates: Record<string, any>
): Promise<{ status: string; message: string }> {
  const res = await fetch(
    `/api/gateway/providers?provider_id=${encodeURIComponent(providerId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }
  );
  return res.json();
}

export async function saveGatewayConfig(config: Partial<GatewayConfig>): Promise<{ status: string; message: string }> {
  const res = await fetch("/api/gateway/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function reloadConfig(): Promise<{ status: string; message: string }> {
  const res = await fetch("/api/gateway/reload", { method: "POST" });
  return res.json();
}

export async function sendTestRequest(body: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
}): Promise<any> {
  const res = await fetch("/api/gateway/test-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ---- Chart data generators (from live status snapshots) ----

export function buildLatencyDataFromHistory(history: RequestHistoryEntry[]) {
  // Group requests by hour and provider, compute avg latency
  const buckets: Record<string, Record<string, { sum: number; count: number }>> = {};

  for (const req of history) {
    const date = new Date(req.timestamp * 1000);
    const hourKey = `${date.getHours().toString().padStart(2, "0")}:00`;
    const provider = req.provider_id || "unknown";

    if (!buckets[hourKey]) buckets[hourKey] = {};
    if (!buckets[hourKey][provider]) buckets[hourKey][provider] = { sum: 0, count: 0 };

    buckets[hourKey][provider].sum += req.latency_ms;
    buckets[hourKey][provider].count += 1;
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, providers]) => {
      const entry: Record<string, any> = { time };
      for (const [provider, data] of Object.entries(providers)) {
        // Shorten provider names for display
        const shortName = provider.split("-")[0];
        entry[shortName] = Math.round(data.sum / data.count);
      }
      return entry;
    });
}

export function buildVolumeDataFromHistory(history: RequestHistoryEntry[]) {
  const buckets: Record<string, { requests: number; failovers: number; failures: number }> = {};

  for (const req of history) {
    const date = new Date(req.timestamp * 1000);
    const hourKey = `${date.getHours().toString().padStart(2, "0")}:00`;

    if (!buckets[hourKey]) buckets[hourKey] = { requests: 0, failovers: 0, failures: 0 };
    buckets[hourKey].requests += 1;
    if (req.status === "failover") buckets[hourKey].failovers += 1;
    if (req.status === "failed") buckets[hourKey].failures += 1;
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, data]) => ({ time, ...data }));
}

export function buildErrorDataFromHistory(history: RequestHistoryEntry[]) {
  const errorMap: Record<string, number> = {};
  for (const req of history) {
    if (req.status === "failed" && req.error) {
      // Categorize error
      let category = "Other";
      if (req.error.includes("429")) category = "429 Rate Limit";
      else if (req.error.includes("502")) category = "502 Bad Gateway";
      else if (req.error.includes("503")) category = "503 Unavailable";
      else if (req.error.includes("Timeout") || req.error.includes("timeout")) category = "Timeout";
      else if (req.error.includes("Connection") || req.error.includes("connect")) category = "Connection Error";
      errorMap[category] = (errorMap[category] || 0) + 1;
    }
  }

  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];
  return Object.entries(errorMap).map(([name, value], i) => ({
    name,
    value,
    fill: colors[i % colors.length],
  }));
}
