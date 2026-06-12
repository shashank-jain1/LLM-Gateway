"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import { motion } from "framer-motion";
import { ScrollText, Search, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { useState, useMemo } from "react";

export function LogsTab() {
  const { requestHistory, config } = useGatewayStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failover" | "failed">("all");
  const [apiKeyFilter, setApiKeyFilter] = useState("all");

  const apiKeys = useMemo(() => {
    const keys = new Set<string>();
    requestHistory.forEach((req) => {
      if (req.api_key) keys.add(req.api_key);
    });
    return Array.from(keys);
  }, [requestHistory]);

  const filtered = useMemo(() => {
    return requestHistory.filter((req) => {
      const matchesSearch =
        !searchQuery ||
        req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.virtual_model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (req.provider_id ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || req.status === statusFilter;
      const matchesApiKey = apiKeyFilter === "all" || req.api_key === apiKeyFilter;
      return matchesSearch && matchesStatus && matchesApiKey;
    });
  }, [requestHistory, searchQuery, statusFilter, apiKeyFilter]);

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

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts * 1000);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (ts: number) => {
    const date = new Date(ts * 1000);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
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

        {/* API Key selector filter */}
        {apiKeys.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#11111a] border border-white/[0.06]">
            <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">API Key:</span>
            <select
              value={apiKeyFilter}
              onChange={(e) => setApiKeyFilter(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#11111a]">All Keys</option>
              {apiKeys.map((key) => {
                const label = config?.gateway?.api_key_labels?.[key] || "Client Key";
                const displayKey = `${key.slice(0, 11)}***...${key.slice(-4)}`;
                return (
                  <option key={key} value={key} className="bg-[#11111a]">
                    {label} ({displayKey})
                  </option>
                );
              })}
            </select>
          </div>
        )}

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
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">API Key</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Virtual Model</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Provider</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">HTTP Status</th>
                <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Latency</th>
                <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Attempts</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req, i) => {
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
                    <td className="px-4 py-3 text-xs text-zinc-500 font-mono" title={req.api_key || "None"}>
                      {req.api_key ? (
                        <span className="text-zinc-400">
                          {config?.gateway?.api_key_labels?.[req.api_key] || `${req.api_key.slice(0, 11)}...${req.api_key.slice(-4)}`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      <div className="font-mono">{formatTimestamp(req.timestamp)}</div>
                      <div className="text-[10px] text-zinc-700">{formatDate(req.timestamp)}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white font-mono">{req.virtual_model}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{req.provider_id ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`font-mono ${
                        req.status_code >= 200 && req.status_code < 300
                          ? "text-emerald-400"
                          : req.status_code >= 400 && req.status_code < 500
                          ? "text-amber-400"
                          : req.status_code >= 500
                          ? "text-rose-400"
                          : "text-zinc-500"
                      }`}>
                        {req.status_code}
                      </span>
                    </td>
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
                    <td className="px-4 py-3 text-xs text-right">
                      <span className={`inline-flex items-center gap-1 ${
                        req.attempt_count > 1
                          ? "text-amber-400"
                          : "text-zinc-500"
                      }`}>
                        {req.attempt_count > 1 && <RefreshCw className="w-3 h-3" />}
                        {req.attempt_count}
                      </span>
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
