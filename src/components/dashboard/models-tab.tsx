"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import { motion } from "framer-motion";
import { Boxes, Server, ArrowRight, Layers } from "lucide-react";

export function ModelsTab() {
  const { models } = useGatewayStore();
  const modelList = models?.data ?? [];

  const providerColors: Record<string, string> = {
    "openai-primary": "emerald",
    "groq-backup": "cyan",
    "together-backup": "amber",
  };

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  };

  // Model mapping table data
  const modelMappings: Record<string, Record<string, string>> = {
    "gpt-4o": {
      "openai-primary": "gpt-4o",
      "groq-backup": "llama-3.3-70b-versatile",
      "together-backup": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    },
    "gpt-4o-mini": {
      "openai-primary": "gpt-4o-mini",
      "groq-backup": "llama-3.1-8b-instant",
      "together-backup": "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    },
    "text-embedding-3-small": {
      "openai-primary": "text-embedding-3-small",
      "together-backup": "togethercomputer/m2-bert-80M-8k-retrieval",
    },
  };

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

            {/* Provider pills */}
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Available on</p>
            <div className="flex flex-wrap gap-1.5">
              {model.providers.map((pid) => {
                const color = providerColors[pid] || "zinc";
                const cls = colorClasses[color] || colorClasses.emerald;
                return (
                  <span
                    key={pid}
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${cls.bg} ${cls.text} ${cls.border} border`}
                  >
                    <Server className="w-2.5 h-2.5" />
                    {pid}
                  </span>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Model Mapping Table */}
      <div className="rounded-xl bg-[#11111a] border border-white/[0.06] overflow-hidden">
        <div className="p-5 border-b border-white/[0.06]">
          <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Model Mapping Reference
          </h3>
          <p className="text-xs text-zinc-600 mt-1">
            How virtual model names are translated for each provider
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
              </tr>
            </thead>
            <tbody>
              {Object.entries(modelMappings).flatMap(([virtual, providers]) =>
                Object.entries(providers).map(([provider, actual], idx) => (
                  <tr
                    key={`${virtual}-${provider}`}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    {idx === 0 && (
                      <td
                        className="px-5 py-3 font-mono text-xs text-white font-medium align-top"
                        rowSpan={Object.keys(providers).length}
                      >
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3 h-3 text-zinc-600" />
                          {virtual}
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-3 text-xs text-zinc-400">{provider}</td>
                    <td className="px-5 py-3 text-xs text-zinc-300 font-mono">{actual}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
