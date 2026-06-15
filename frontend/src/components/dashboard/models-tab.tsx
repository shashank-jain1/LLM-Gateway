"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import { motion } from "framer-motion";
import { Boxes, Server, ArrowRight, Layers, CheckCircle2, XCircle } from "lucide-react";
import { ReactNode } from "react";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl bg-[#0c0c16]/70 backdrop-blur-2xl border border-white/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.02)] transition-all duration-300 hover:border-indigo-500/15 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.03)] hover:-translate-y-px ${className}`}
    >
      {children}
    </div>
  );
}

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
    if (provider.fetched_models) {
      for (const fetchedModel of provider.fetched_models) {
        if (!modelMappings[fetchedModel]) {
          modelMappings[fetchedModel] = {};
        }
        if (!modelMappings[fetchedModel][provider.provider_id]) {
          modelMappings[fetchedModel][provider.provider_id] = `${fetchedModel} (Auto-fetched)`;
        }
      }
    }
  }

  // Provider colors based on index - refined palette
  const colorPalette = [
    { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/15" },
    { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/15" },
    { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/15" },
    { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/15" },
    { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/15" },
  ];

  const providerColorMap: Record<string, (typeof colorPalette)[number]> = {};
  providers.forEach((p, i) => {
    providerColorMap[p.provider_id] = colorPalette[i % colorPalette.length];
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white tracking-tight">Virtual Models</h2>
        <p className="text-sm text-zinc-500 mt-0.5 font-medium">
          Virtual model names map to provider-specific models for seamless failover
        </p>
      </div>

      {/* Model війModel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modelList.map((model, i) => (
          <motion.div
            key={model.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          >
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Boxes className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white font-mono">{model.id}</h3>
                  <p className="text-[10px] text-zinc-600 font-medium">Virtual model</p>
                </div>
              </div>

              {/* Provider pills with enabled/disabled state */}
              <p className="text-[10px] uppercase tracking-widest text-zinc-700 font-semibold mb-2.5">
                Available on
              </p>
              <div className="flex flex-wrap gap-1.5">
                {model.providers.map((pid) => {
                  const provider = providers.find((p) => p.provider_id === pid);
                  const cls = providerColorMap[pid] || colorPalette[0];
                  const isEnabled = provider?.enabled ?? true;
                  return (
                    <span
                      key={pid}
                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md ${cls.bg} ${cls.text} ${cls.border} border ${!isEnabled ? "opacity-40 line-through" : ""}`}
                    >
                      {isEnabled ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {pid}
                      {!isEnabled && <span className="text-[8px] ml-0.5">(disabled)</span>}
                    </span>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* No models yet */}
      {modelList.length === 0 && Object.keys(modelMappings).length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
          <Boxes className="w-8 h-8 mb-3 text-zinc-700" />
          <p className="text-sm font-medium">No models configured</p>
          <p className="text-xs text-zinc-700 mt-1">Add providers with model mappings to see virtual models here</p>
        </div>
      )}

      {/* Model Mapping Table */}
      {Object.keys(modelMappings).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-400 tracking-tight">Model Mapping Reference</h3>
            <div className="flex-1 h-px bg-white/[0.04] ml-2" />
          </div>
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-white/[0.06]">
              <p className="text-xs text-zinc-500">
                How virtual model names are translated for each provider
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Virtual Model</th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Provider</th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Actual Model</th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Status</th>
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
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                !isEnabled
                                  ? "bg-zinc-500/10 text-zinc-500"
                                  : isHealthy
                                  ? "bg-teal-500/10 text-teal-400"
                                  : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
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
          </Card>
        </div>
      )}
    </div>
  );
}
