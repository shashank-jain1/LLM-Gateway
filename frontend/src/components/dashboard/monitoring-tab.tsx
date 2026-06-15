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
import { useState, useMemo, ReactNode } from "react";
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

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl bg-[#0c0c16]/70 backdrop-blur-2xl border border-white/[0.06] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.02)] p-5 transition-all duration-300 hover:border-indigo-500/15 ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
      <h3 className="text-sm font-semibold text-zinc-400 tracking-tight">{title}</h3>
      <div className="flex-1 h-px bg-white/[0.04] ml-2" />
    </div>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "#0c0c16",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

const PIE_COLORS = ["#2dd4bf", "#818cf8", "#f59e0b", "#fb7185", "#a78bfa"];

function EmptyChartState({ title }: { title: string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-zinc-700">
      <BarChart3 className="w-8 h-8 mb-3" />
      <p className="text-sm font-medium">No data yet</p>
      <p className="text-xs text-zinc-800 mt-1">{title} will appear once requests are made</p>
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

  const availableModels = status?.providers
    ? [...new Set(status.providers.flatMap((p) => Object.keys(p.models)))]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">Monitoring & Analytics</h2>
          <p className="text-sm text-zinc-500 mt-0.5 font-medium">Real-time performance metrics across all providers</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* API Key selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 font-medium whitespace-nowrap">API Key:</span>
            <select
              value={selectedApiKey}
              onChange={(e) => setSelectedApiKey(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#0c0c16]/70 border border-white/[0.06] text-xs text-white focus:outline-none focus:border-indigo-500/30"
            >
              <option value="all" className="bg-[#0c0c16]">All API Keys</option>
              {apiKeys.map((key) => {
                const label = config?.gateway?.api_key_labels?.[key] || "Client Key";
                const displayKey = `${key.slice(0, 11)}***...${key.slice(-4)}`;
                return (
                  <option key={key} value={key} className="bg-[#0c0c16]">
                    {label} ({displayKey})
                  </option>
                );
              })}
            </select>
          </div>

          <button
            onClick={openTestDialog}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all duration-200"
          >
            <Send className="w-4 h-4" />
            Send Test Request
          </button>
        </div>
      </div>

      {/* Latency Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-500" />
              <h3 className="text-sm font-semibold text-zinc-400 tracking-tight">Response Latency</h3>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-700 font-bold">milliseconds</span>
          </div>
          {latencyData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="gradTeal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradIndigo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="time" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={CUSTOM_TOOLTIP_STYLE}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#e4e4e7" }}
                  />
                  {latencyData.length > 0 &&
                    Object.keys(latencyData[0])
                      .filter((k) => k !== "time")
                      .map((key, idx) => {
                        const gradients = ["url(#gradTeal)", "url(#gradIndigo)", "url(#gradAmber)"];
                        const colors = ["#2dd4bf", "#818cf8", "#f59e0b", "#a78bfa", "#fb7185"];
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
        </Card>
      </motion.div>

      {/* Bottom Row: Volume + Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Request Volume */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="lg:col-span-3"
        >
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4 text-zinc-500" />
              <h3 className="text-sm font-semibold text-zinc-400 tracking-tight">Request Volume</h3>
            </div>
            {volumeData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="time" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={CUSTOM_TOOLTIP_STYLE}
                      labelStyle={{ color: "#a1a1aa" }}
                      itemStyle={{ color: "#e4e4e7" }}
                    />
                    <Bar dataKey="requests" fill="#2dd4bf" radius={[3, 3, 0, 0]} name="Requests" opacity={0.8} />
                    <Bar dataKey="failovers" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Failovers" opacity={0.8} />
                    <Bar dataKey="failures" fill="#fb7185" radius={[3, 3, 0, 0]} name="Failures" opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChartState title="Volume data" />
            )}
          </Card>
        </motion.div>

        {/* Error Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="lg:col-span-2"
        >
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-4 h-4 text-zinc-500" />
              <h3 className="text-sm font-semibold text-zinc-400 tracking-tight">Error Distribution</h3>
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
          </Card>
        </motion.div>
      </div>

      {/* Test Request Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="bg-[#0c0c16] border border-white/[0.08] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white text-base font-semibold">Send Test Request</DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Send a chat completion request through the gateway to test connectivity
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Model */}
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs font-medium">Virtual Model</Label>
              {availableModels.length > 0 ? (
                <select
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-black/40 border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/30"
                >
                  <option value="" className="bg-[#0c0c16]">Select a model...</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m} className="bg-[#0c0c16]">
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={testModel}
                  onChange={(e) => setTestModel(e.target.value)}
                  placeholder="e.g. gpt-4o"
                  className="bg-black/40 border-white/[0.08] text-white placeholder-zinc-600 text-sm font-mono"
                />
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs font-medium">Message</Label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter your test message"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/30 resize-none"
              />
            </div>

            {/* Result */}
            {testResult && (
              <div className="p-3 rounded-lg bg-teal-500/[0.05] border border-teal-500/[0.1]">
                <p className="text-xs text-teal-400 font-semibold mb-1.5">Response received</p>
                <p className="text-xs text-zinc-300 line-clamp-4 whitespace-pre-wrap leading-relaxed">
                  {typeof testResult === "object"
                    ? testResult.choices?.[0]?.message?.content || JSON.stringify(testResult, null, 2).slice(0, 500)
                    : String(testResult).slice(0, 500)}
                </p>
              </div>
            )}

            {testError && (
              <div className="p-3 rounded-lg bg-rose-500/[0.05] border border-rose-500/[0.1]">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-400 leading-relaxed">{testError}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestDialogOpen(false)}
              className="bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 text-xs"
            >
              Close
            </Button>
            <Button
              onClick={handleTestRequest}
              disabled={!testModel.trim() || !testMessage.trim() || isSending}
              className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/25 disabled:opacity-40 text-xs font-medium"
            >
              {isSending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
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
