"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import { motion } from "framer-motion";
import {
  Activity,
  Clock,
  Zap,
  Send,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  buildLatencyDataFromHistory,
  buildVolumeDataFromHistory,
  buildErrorDataFromHistory,
} from "@/lib/gateway-api";

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "#1a1a2e",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "12px",
};

const PIE_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6"];

function EmptyChartState({ title }: { title: string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-zinc-600">
      <BarChart3 className="w-8 h-8 mb-2" />
      <p className="text-sm">No data yet</p>
      <p className="text-xs text-zinc-700 mt-1">{title} will appear once requests are made</p>
    </div>
  );
}

export function MonitoringTab() {
  const { requestHistory, config, doTestRequest, status } = useGatewayStore();
  const [selectedApiKey, setSelectedApiKey] = useState("all");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testModel, setTestModel] = useState("");
  const [testMessage, setTestMessage] = useState("Hello! Can you respond with a short greeting?");
  const [isSending, setIsSending] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const apiKeys = useMemo(() => {
    const keys = new Set<string>();
    requestHistory.forEach((req) => {
      if (req.api_key) keys.add(req.api_key);
    });
    if (config?.gateway?.api_keys) {
      config.gateway.api_keys.forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  }, [requestHistory, config]);

  const filteredHistory = useMemo(() => {
    if (selectedApiKey === "all") return requestHistory;
    return requestHistory.filter((req) => req.api_key === selectedApiKey);
  }, [requestHistory, selectedApiKey]);

  const latencyData = useMemo(() => buildLatencyDataFromHistory(filteredHistory), [filteredHistory]);
  const volumeData = useMemo(() => buildVolumeDataFromHistory(filteredHistory), [filteredHistory]);
  const errorData = useMemo(() => buildErrorDataFromHistory(filteredHistory), [filteredHistory]);

  const handleTestRequest = async () => {
    if (!testModel.trim() || !testMessage.trim()) return;
    setIsSending(true);
    setTestResult(null);
    setTestError(null);

    try {
      const result = await doTestRequest(testModel.trim(), [
        { role: "user", content: testMessage.trim() },
      ]);
      if (result) {
        setTestResult(result);
      } else {
        setTestError("Request failed — no response from gateway");
      }
    } catch (err: any) {
      setTestError(err.message || "Request failed");
    } finally {
      setIsSending(false);
    }
  };

  const openTestDialog = () => {
    setTestResult(null);
    setTestError(null);
    setTestDialogOpen(true);
  };

  // Get available virtual models for the test request dropdown
  const availableModels = status?.providers
    ? [...new Set(status.providers.flatMap((p) => Object.keys(p.models)))]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Monitoring & Analytics</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Real-time performance metrics across all providers</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* API Key selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">API Key:</span>
            <select
              value={selectedApiKey}
              onChange={(e) => setSelectedApiKey(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#11111a] border border-white/[0.06] text-xs text-white focus:outline-none focus:border-cyan-500/30"
            >
              <option value="all">All API Keys</option>
              {apiKeys.map((key) => {
                const label = config?.gateway?.api_key_labels?.[key] || "Client Key";
                const displayKey = `${key.slice(0, 11)}***...${key.slice(-4)}`;
                return (
                  <option key={key} value={key}>
                    {label} ({displayKey})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={openTestDialog}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all duration-200"
          >
            <Send className="w-4 h-4" />
            Send Test Request
          </button>
        </div>
      </div>

      {/* Latency Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-zinc-300">Response Latency</h3>
          </div>
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">milliseconds</span>
        </div>
        {latencyData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gradOpenai" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGroq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradTogether" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={CUSTOM_TOOLTIP_STYLE}
                  labelStyle={{ color: "#a1a1aa" }}
                  itemStyle={{ color: "#e4e4e7" }}
                />
                {/* Dynamically render areas based on data keys */}
                {latencyData.length > 0 &&
                  Object.keys(latencyData[0])
                    .filter((k) => k !== "time")
                    .map((key, idx) => {
                      const gradients = ["url(#gradOpenai)", "url(#gradGroq)", "url(#gradTogether)"];
                      const colors = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899"];
                      return (
                        <Area
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill={gradients[idx % gradients.length]}
                          name={key}
                        />
                      );
                    })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChartState title="Latency data" />
        )}
      </motion.div>

      {/* Bottom Row: Volume + Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Request Volume */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="lg:col-span-3 rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-300">Request Volume</h3>
            </div>
          </div>
          {volumeData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={CUSTOM_TOOLTIP_STYLE}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#e4e4e7" }}
                  />
                  <Bar dataKey="requests" fill="#10b981" radius={[3, 3, 0, 0]} name="Requests" opacity={0.8} />
                  <Bar dataKey="failovers" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Failovers" opacity={0.8} />
                  <Bar dataKey="failures" fill="#ef4444" radius={[3, 3, 0, 0]} name="Failures" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartState title="Volume data" />
          )}
        </motion.div>

        {/* Error Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="lg:col-span-2 rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-zinc-500" />
              <h3 className="text-sm font-medium text-zinc-300">Error Distribution</h3>
            </div>
          </div>
          {errorData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={errorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {errorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CUSTOM_TOOLTIP_STYLE}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#e4e4e7" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={6}
                    formatter={(value: string) => (
                      <span style={{ color: "#a1a1aa", fontSize: "11px" }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChartState title="Error data" />
          )}
        </motion.div>
      </div>

      {/* Test Request Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Send Test Request</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Send a chat completion request through the gateway to test connectivity
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Model */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">Virtual Model</Label>
              {availableModels.length > 0 ? (
                <select
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/30"
                >
                  <option value="" className="bg-[#1a1a2e]">Select a model...</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m} className="bg-[#1a1a2e]">
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                  placeholder="e.g. gpt-4o"
                  className="bg-black/30 border-white/10 text-white placeholder-zinc-600 text-sm font-mono"
                />
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">Message</Label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter your test message"
                rows={3}
                className="w-full px-3 py-2 rounded-md bg-black/30 border border-white/10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 resize-none"
              />
            </div>

            {/* Result */}
            {testResult && (
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-xs text-emerald-400 font-medium mb-1">Response received</p>
                <p className="text-xs text-zinc-300 line-clamp-4 whitespace-pre-wrap">
                  {typeof testResult === "object"
                    ? testResult.choices?.[0]?.message?.content || JSON.stringify(testResult, null, 2).slice(0, 500)
                    : String(testResult).slice(0, 500)}
                </p>
              </div>
            )}

            {testError && (
              <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-400">{testError}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestDialogOpen(false)}
              className="bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
            >
              Close
            </Button>
            <Button
              onClick={handleTestRequest}
              disabled={!testModel.trim() || !testMessage.trim() || isSending}
              className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
