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
  const { status, models, requestHistory } = useGatewayStore();

  const totalRequests = status?.providers.reduce((sum, p) => sum + p.total_requests, 0) ?? 0;
  const totalSuccesses = status?.providers.reduce((sum, p) => sum + p.total_successes, 0) ?? 0;
  const totalFailures = status?.providers.reduce((sum, p) => sum + p.total_failures, 0) ?? 0;
  const successRate = totalRequests > 0 ? ((totalSuccesses / totalRequests) * 100).toFixed(1) : "0";
  const healthyProviders = status?.providers.filter((p) => p.status === "healthy").length ?? 0;
  const totalProviders = status?.providers.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Requests"
          value={totalRequests.toLocaleString()}
          subtitle="all time"
          icon={Activity}
          trend="12.5%"
          trendUp={true}
          color="emerald"
          delay={0}
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          subtitle="across all providers"
          icon={TrendingUp}
          trend="0.3%"
          trendUp={true}
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
          title="Active Providers"
          value={`${healthyProviders}/${totalProviders}`}
          subtitle={`${totalProviders - healthyProviders} in cooldown`}
          icon={Server}
          color={healthyProviders === totalProviders ? "emerald" : "rose"}
          delay={0.15}
        />
      </div>

      {/* Provider Status Cards */}
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
                provider.status === "healthy"
                  ? "border-emerald-500/20"
                  : "border-amber-500/30"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      provider.status === "healthy" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                    }`}
                  />
                  <span className="text-sm font-medium text-white">{provider.provider_id}</span>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                    provider.status === "healthy"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {provider.status}
                </span>
              </div>

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
                      provider.status === "healthy"
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
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Model</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Provider</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {requestHistory.slice(0, 8).map((req) => (
                  <tr key={req.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-xs text-zinc-400 font-mono">{req.id}</td>
                    <td className="px-4 py-2.5 text-xs text-white">{req.model}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">{req.provider}</td>
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
        </div>
      </div>
    </div>
  );
}
