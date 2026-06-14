"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import { motion } from "framer-motion";
import { Boxes, Server, ArrowRight, Layers, CheckCircle2, XCircle } from "lucide-react";

export function ModelsTab() {
  const { status, models } = useGatewayStore();
  const modelList = models?.data ?? [];
  const providers = status?.providers ?? [];

  // Build model mappings from live provider data
  const modelMappings: Record<string, Record<string, string>> = {};
  for (const provider of providers) {
    if (provider.models) {
      for (const [virtualModel, actualModel] of Object.entries(provider.models)) {
        if (!modelMappings[virtualModel]) {
          modelMappings[virtualModel] = {};
        }
        modelMappings[virtualModel][provider.provider_id] = actualModel;
      }
    }
  }

  // Provider colors based on index
  const colorPalette = [
    { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
    { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
    { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
    { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
  ];

  const providerColorMap: Record<string, (typeof colorPalette)[number]> = {};
  providers.forEach((p, i) => {
    providerColorMap[p.provider_id] = colorPalette[i % colorPalette.length];
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Virtual Models</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Virtual model names map to provider-specific models for seamless failover
        </p>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {modelList.map((model, i) => (
          <motion.div
            key={model.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5 hover:border-white/[0.12] transition-colors duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center">
                <Boxes className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white font-mono">{model.id}</h3>
                <p className="text-[10px] text-zinc-600">Virtual model</p>
              </div>
            </div>

            {/* Provider pills with enabled/disabled state */}
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Available on</p>
            <div className="flex flex-wrap gap-1.5">
              {model.providers.map((pid) => {
                const provider = providers.find((p) => p.provider_id === pid);
                const cls = providerColorMap[pid] || colorPalette[0];
                const isEnabled = provider?.enabled ?? true;
                return (
                  <span
                    key={pid}
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${cls.bg} ${cls.text} ${cls.border} border ${!isEnabled ? "opacity-40 line-through" : ""}`}
                  >
                    {isEnabled ? (
                      <CheckCircle2 className="w-2.5 h-2.5" />
                    ) : (
                      <XCircle className="w-2.5 h-2.5" />
                    )}
                    {pid}
                    {!isEnabled && <span className="text-[8px] ml-0.5">(disabled)</span>}
                  </span>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* No models yet */}
      {modelList.length === 0 && Object.keys(modelMappings).length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
          <Boxes className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium">No models configured</p>
          <p className="text-xs mt-1">Add providers with model mappings to see virtual models here</p>
        </div>
      )}

      {/* Model Mapping Table */}
      {Object.keys(modelMappings).length > 0 && (
        <div className="rounded-xl bg-[#11111a] border border-white/[0.06] overflow-hidden">
          <div className="p-5 border-b border-white/[0.06]">
            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Model Mapping Reference
            </h3>
            <p className="text-xs text-zinc-600 mt-1">
              How virtual model names are translated for each provider (from live gateway data)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Virtual Model
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Provider
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Actual Model
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Provider Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(modelMappings).flatMap(([virtual, providerMap]) =>
                  Object.entries(providerMap).map(([providerId, actual], idx) => {
                    const provider = providers.find((p) => p.provider_id === providerId);
                    const isEnabled = provider?.enabled ?? true;
                    const isHealthy = provider?.status === "healthy";
                    return (
                      <tr
                        key={`${virtual}-${providerId}`}
                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                      >
                        {idx === 0 && (
                          <td
                            className="px-5 py-3 font-mono text-xs text-white font-medium align-top"
                            rowSpan={Object.keys(providerMap).length}
                          >
                            <div className="flex items-center gap-2">
                              <ArrowRight className="w-3 h-3 text-zinc-600" />
                              {virtual}
                            </div>
                          </td>
                        )}
                        <td className="px-5 py-3 text-xs text-zinc-400">{providerId}</td>
                        <td className="px-5 py-3 text-xs text-zinc-300 font-mono">{actual}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            !isEnabled
                              ? "bg-zinc-500/10 text-zinc-500"
                              : isHealthy
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {!isEnabled ? (
                              <XCircle className="w-3 h-3" />
                            ) : isHealthy ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            {!isEnabled ? "disabled" : provider?.status ?? "unknown"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
