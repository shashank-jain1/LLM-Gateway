"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import { motion } from "framer-motion";
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  Clock,
  Globe,
} from "lucide-react";
import { useState } from "react";

export function ProvidersTab() {
  const { status, doToggleProvider } = useGatewayStore();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const providers = status?.providers ?? [];

  const handleToggle = async (providerId: string, isEnabled: boolean) => {
    setTogglingId(providerId);
    const action = isEnabled ? "disable" : "enable";
    await doToggleProvider(providerId, action);
    setTogglingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Provider Management</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Configure and monitor your LLM backend providers</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            {providers.filter((p) => p.status === "healthy").length} of {providers.length} healthy
          </span>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        {providers.map((provider, i) => {
          const isEnabled = provider.status === "healthy" || provider.consecutive_failures < 5;
          const successRate =
            provider.total_requests > 0
              ? ((provider.total_successes / provider.total_requests) * 100).toFixed(1)
              : "0";
          const isToggling = togglingId === provider.provider_id;

          return (
            <motion.div
              key={provider.provider_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
              className={`rounded-xl bg-[#11111a] border p-6 hover:border-white/[0.12] transition-all duration-300 ${
                provider.status === "healthy" ? "border-white/[0.06]" : "border-amber-500/20"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Left: Provider Info */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        provider.status === "healthy"
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-amber-500/10 border border-amber-500/20"
                      }`}
                    >
                      <Server
                        className={`w-5 h-5 ${
                          provider.status === "healthy" ? "text-emerald-400" : "text-amber-400"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{provider.provider_id}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                            provider.status === "healthy"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {provider.status === "healthy" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {provider.status}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          Priority {i + 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Total Requests</p>
                      <p className="text-lg font-bold text-white">{provider.total_requests.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Success Rate</p>
                      <p className="text-lg font-bold text-emerald-400">{successRate}%</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Failures</p>
                      <p className="text-lg font-bold text-rose-400">{provider.total_failures}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Consecutive Fails</p>
                      <p
                        className={`text-lg font-bold ${
                          provider.consecutive_failures > 0 ? "text-amber-400" : "text-zinc-400"
                        }`}
                      >
                        {provider.consecutive_failures}
                      </p>
                    </div>
                  </div>

                  {/* Error info */}
                  {provider.last_error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                      <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-rose-400 font-medium">Last Error</p>
                        <p className="text-[11px] text-rose-400/70 mt-0.5">{provider.last_error}</p>
                      </div>
                    </div>
                  )}

                  {/* Cooldown info */}
                  {provider.status === "cooldown" && provider.cooldown_until && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-400">
                        In cooldown — auto-recovers in ~
                        {Math.max(0, Math.round(provider.cooldown_until - Date.now() / 1000))}s
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-row lg:flex-col items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(provider.provider_id, isEnabled)}
                    disabled={isToggling}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      isEnabled
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                    } disabled:opacity-50`}
                  >
                    {isToggling ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isEnabled ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    {isEnabled ? "Disable" : "Enable"}
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10 transition-all duration-200">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Provider Config Summary */}
      <div className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Connection Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                  Provider
                </th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                  Base URL
                </th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                  API Key
                </th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/[0.03]">
                <td className="px-3 py-2.5 text-xs text-white font-medium">openai-primary</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">https://api.openai.com/v1</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">sk-***...xxxx</td>
                <td className="px-3 py-2.5">
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">1</span>
                </td>
              </tr>
              <tr className="border-b border-white/[0.03]">
                <td className="px-3 py-2.5 text-xs text-white font-medium">groq-backup</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">https://api.groq.com/openai/v1</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">gsk-***...xxxx</td>
                <td className="px-3 py-2.5">
                  <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">2</span>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 text-xs text-white font-medium">together-backup</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">https://api.together.xyz/v1</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">together-***...xxxx</td>
                <td className="px-3 py-2.5">
                  <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">3</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
