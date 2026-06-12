"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import { motion } from "framer-motion";
import { ScrollText, Search, Filter, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useState, useMemo } from "react";

export function LogsTab() {
  const { requestHistory } = useGatewayStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failover" | "failed">("all");

  const filtered = useMemo(() => {
    return requestHistory.filter((req) => {
      const matchesSearch =
        !searchQuery ||
        req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.provider.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requestHistory, searchQuery, statusFilter]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case "failover":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case "failed":
        return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return null;
    }
  };

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      failover: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    };
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${classes[status] || ""}`}>
        {statusIcon(status)}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Request Logs</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Complete audit trail of all proxied requests</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Search by request ID, model, or provider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#11111a] border border-white/[0.06] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#11111a] border border-white/[0.06]">
          {(["all", "success", "failover", "failed"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                statusFilter === filter
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Log Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl bg-[#11111a] border border-white/[0.06] overflow-hidden"
      >
        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#11111a] z-10">
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Request ID</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Model</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Provider</th>
                <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Latency</th>
                <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req, i) => {
                const time = new Date(req.timestamp);
                const timeStr = time.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                });
                return (
                  <motion.tr
                    key={req.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">{statusBadge(req.status)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{req.id}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500 font-mono">{timeStr}</td>
                    <td className="px-4 py-3 text-xs text-white font-mono">{req.model}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{req.provider}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono">
                      <span
                        className={
                          req.latency_ms > 1000
                            ? "text-amber-400"
                            : req.latency_ms > 500
                            ? "text-cyan-400"
                            : "text-emerald-400"
                        }
                      >
                        {Math.round(req.latency_ms)}ms
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-right text-zinc-500">
                      {req.tokens_used ? req.tokens_used.toLocaleString() : "—"}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
            <ScrollText className="w-8 h-8 mb-2" />
            <p className="text-sm">No matching requests found</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
