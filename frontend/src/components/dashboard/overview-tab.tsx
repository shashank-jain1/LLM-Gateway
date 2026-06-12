"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import { motion } from "framer-motion";
import {
  Server,
  Activity,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  BarChart3,
  Globe,
  Hash,
} from "lucide-react";

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  color,
  delay = 0,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color: string;
  delay?: number;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      glow: "shadow-emerald-500/5",
    },
    cyan: {
      bg: "bg-cyan-500/10",
      text: "text-cyan-400",
      border: "border-cyan-500/20",
      glow: "shadow-cyan-500/5",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      glow: "shadow-amber-500/5",
    },
    rose: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/20",
      glow: "shadow-rose-500/5",
    },
  };

  const c = colorMap[color] || colorMap.emerald;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className={`rounded-xl bg-[#11111a] border border-white/[0.06] p-5 shadow-lg ${c.glow} hover:border-white/[0.12] transition-colors duration-300`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">{title}</p>
          <p className="text-2xl font-bold mt-2 text-white">{value}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {trend && (
              <span className={`flex items-center text-xs font-medium ${trendUp ? "text-emerald-400" : "text-rose-400"}`}>
                {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trend}
              </span>
            )}
            <span className="text-xs text-zinc-600">{subtitle}</span>
          </div>
        </div>
        <div className={`p-2.5 rounded-lg ${c.bg} ${c.border} border`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
      </div>
    </motion.div>
  );
}

export function OverviewTab() {
  const { status, requestHistory } = useGatewayStore();

  const totalRequests = status?.total_requests ?? 0;
  const totalSuccesses = status?.providers.reduce((sum, p) => sum + p.total_successes, 0) ?? 0;
  const totalFailures = status?.providers.reduce((sum, p) => sum + p.total_failures, 0) ?? 0;
  const successRate = totalRequests > 0 ? ((totalSuccesses / totalRequests) * 100).toFixed(1) : "0";
  const enabledProviders = status?.providers.filter((p) => p.enabled).length ?? 0;
  const totalProviders = status?.providers.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Requests"
          value={totalRequests.toLocaleString()}
          subtitle="gateway total"
          icon={Activity}
          color="emerald"
          delay={0}
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          subtitle="across all providers"
          icon={TrendingUp}
          color="cyan"
          delay={0.05}
        />
        <StatCard
          title="Failovers"
          value={status?.failover_count?.toString() ?? "0"}
          subtitle="automatic retries"
          icon={Zap}
          color="amber"
          delay={0.1}
        />
        <StatCard
          title="Enabled Providers"
          value={`${enabledProviders}/${totalProviders}`}
          subtitle={`${totalProviders - enabledProviders} disabled`}
          icon={Server}
          color={enabledProviders === totalProviders && totalProviders > 0 ? "emerald" : "rose"}
          delay={0.15}
        />
      </div>

      {/* Gateway Config */}
      {status?.gateway && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
        >
          <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Gateway Configuration
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Host</p>
              <p className="text-sm font-semibold text-white font-mono">{status.gateway.host}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Port</p>
              <p className="text-sm font-semibold text-white font-mono">{status.gateway.port}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Log Level</p>
              <p className="text-sm font-semibold text-cyan-400 font-mono">{status.gateway.log_level}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Default Cooldown</p>
              <p className="text-sm font-semibold text-white">{status.gateway.default_cooldown_seconds}s</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Max Cooldown</p>
              <p className="text-sm font-semibold text-white">{status.gateway.max_cooldown_seconds}s</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Request Timeout</p>
              <p className="text-sm font-semibold text-white">{status.gateway.request_timeout_seconds}s</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Provider Health Cards */}
      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">Provider Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {status?.providers.map((provider, i) => (
            <motion.div
              key={provider.provider_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05, duration: 0.4 }}
              className={`rounded-xl bg-[#11111a] border p-5 hover:border-white/[0.12] transition-colors duration-300 ${
                provider.enabled
                  ? provider.status === "healthy"
                    ? "border-emerald-500/20"
                    : "border-amber-500/30"
                  : "border-zinc-700/30 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      !provider.enabled
                        ? "bg-zinc-600"
                        : provider.status === "healthy"
                        ? "bg-emerald-500"
                        : "bg-amber-500 animate-pulse"
                    }`}
                  />
                  <span className="text-sm font-medium text-white">{provider.provider_id}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                    <Hash className="w-2.5 h-2.5" />
                    P{provider.priority}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                      !provider.enabled
                        ? "bg-zinc-500/10 text-zinc-500"
                        : provider.status === "healthy"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {!provider.enabled ? "disabled" : provider.status}
                  </span>
                </div>
              </div>

              {/* Base URL */}
              <div className="flex items-center gap-1.5 mb-3 text-[11px] text-zinc-500 truncate">
                <Globe className="w-3 h-3 shrink-0" />
                <span className="font-mono truncate">{provider.base_url}</span>
              </div>

              {/* Models */}
              {provider.models && Object.keys(provider.models).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.entries(provider.models).map(([virtual, actual]) => (
                    <span
                      key={virtual}
                      className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/10 font-mono"
                    >
                      {virtual}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase">Requests</p>
                  <p className="text-sm font-semibold text-white">{provider.total_requests.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase">Success</p>
                  <p className="text-sm font-semibold text-emerald-400">{provider.total_successes.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase">Failures</p>
                  <p className="text-sm font-semibold text-rose-400">{provider.total_failures.toLocaleString()}</p>
                </div>
              </div>

              {/* Success bar */}
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${provider.total_requests > 0 ? (provider.total_successes / provider.total_requests) * 100 : 0}%`,
                    }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      !provider.enabled
                        ? "bg-zinc-600"
                        : provider.status === "healthy"
                        ? "bg-gradient-to-r from-emerald-500 to-cyan-500"
                        : "bg-gradient-to-r from-amber-500 to-orange-500"
                    }`}
                  />
                </div>
              </div>

              {provider.last_error && (
                <div className="mt-3 flex items-start gap-1.5 p-2 rounded-md bg-rose-500/5 border border-rose-500/10">
                  <AlertTriangle className="w-3 h-3 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-rose-400/80 leading-tight">{provider.last_error}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-400">Recent Requests</h3>
          <BarChart3 className="w-4 h-4 text-zinc-600" />
        </div>
        <div className="rounded-xl bg-[#11111a] border border-white/[0.06] overflow-hidden">
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Request</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Virtual Model</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Provider</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {requestHistory.slice(0, 8).map((req) => (
                  <tr key={req.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-xs text-zinc-400 font-mono">{req.id}</td>
                    <td className="px-4 py-2.5 text-xs text-white font-mono">{req.virtual_model}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">{req.provider_id ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          req.status === "success"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : req.status === "failover"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400 text-right font-mono">
                      {Math.round(req.latency_ms)}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {requestHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
              <Activity className="w-8 h-8 mb-2" />
              <p className="text-sm">No requests yet</p>
              <p className="text-xs text-zinc-700">Requests will appear here once they are made through the gateway</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
