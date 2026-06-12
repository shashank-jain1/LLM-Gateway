"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, RefreshCw, Shield, Clock, Zap, Save, Eye, EyeOff, Copy, Check, Wifi, WifiOff } from "lucide-react";
import { useGatewayStore } from "@/lib/gateway-store";

export function SettingsTab() {
  const { doReloadConfig, config, isGatewayConnected } = useGatewayStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadSuccess, setReloadSuccess] = useState(false);

  const handleReload = async () => {
    setIsReloading(true);
    const success = await doReloadConfig();
    setIsReloading(false);
    if (success) {
      setReloadSuccess(true);
      setTimeout(() => setReloadSuccess(false), 2000);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const gateway = config?.gateway;
  const gatewayUrl = `http://${gateway?.host ?? "0.0.0.0"}:${gateway?.port ?? 8000}/v1/chat/completions`;
  const exampleKey = gateway?.api_keys?.[0] ? `${gateway.api_keys[0].slice(0, 6)}***...${gateway.api_keys[0].slice(-4)}` : "sk-***...xxxx";
  const fullKey = gateway?.api_keys?.[0] ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Gateway configuration and quick actions</p>
      </div>

      {/* Connection Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`rounded-xl border p-5 ${
          isGatewayConnected
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-rose-500/5 border-rose-500/20"
        }`}
      >
        <div className="flex items-center gap-3">
          {isGatewayConnected ? (
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-emerald-400" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-rose-400" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-white">
              Gateway {isGatewayConnected ? "Connected" : "Disconnected"}
            </h3>
            <p className="text-xs text-zinc-500">
              {isGatewayConnected
                ? "The Python LLM Gateway backend is reachable and responding"
                : "Cannot reach the Python LLM Gateway backend. Check that it is running."}
            </p>
          </div>
          <div className="ml-auto">
            <div className={`h-3 w-3 rounded-full ${isGatewayConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${isReloading ? "animate-spin" : ""}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Reload Configuration</h3>
              <p className="text-xs text-zinc-500">Hot-reload config.yaml without restart</p>
            </div>
          </div>
          <button
            onClick={handleReload}
            disabled={isReloading}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              reloadSuccess
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20"
            } disabled:opacity-50`}
          >
            {isReloading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Reloading...
              </>
            ) : reloadSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Config reloaded!
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Reload Config
              </>
            )}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">API Key</h3>
              <p className="text-xs text-zinc-500">Gateway authentication key</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] font-mono text-sm text-zinc-300">
              <span className="truncate">{showApiKey ? (fullKey || exampleKey) : exampleKey}</span>
            </div>
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4 text-zinc-400" />
              ) : (
                <Eye className="w-4 h-4 text-zinc-400" />
              )}
            </button>
            <button
              onClick={() => handleCopy(fullKey || exampleKey)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-zinc-400" />
              )}
            </button>
          </div>
          {gateway?.api_keys && gateway.api_keys.length > 1 && (
            <p className="text-[10px] text-zinc-600 mt-2">
              {gateway.api_keys.length} API keys configured (showing first)
            </p>
          )}
        </motion.div>
      </div>

      {/* Connection Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
      >
        <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-zinc-500" />
          Gateway Configuration
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Port</label>
              <input
                type="text"
                value={gateway?.port ?? "—"}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Host</label>
              <input
                type="text"
                value={gateway?.host ?? "—"}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Default Cooldown (s)
              </label>
              <input
                type="text"
                value={gateway?.default_cooldown_seconds ?? "—"}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Max Cooldown (s)
              </label>
              <input
                type="text"
                value={gateway?.max_cooldown_seconds ?? "—"}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Request Timeout (s)
              </label>
              <input
                type="text"
                value={gateway?.request_timeout_seconds ?? "—"}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Log Level</label>
              <input
                type="text"
                value={gateway?.log_level ?? "—"}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-cyan-400 font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Providers Configured</label>
              <input
                type="text"
                value={config?.providers?.length ?? 0}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none"
              />
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 italic">
            Configuration is loaded from the live gateway. Edit config.yaml and click &quot;Reload Config&quot; to apply changes.
          </p>
        </div>
      </motion.div>

      {/* Configured Providers */}
      {config?.providers && config.providers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
        >
          <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-zinc-500" />
            Configured Providers
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">ID</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Base URL</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Priority</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Enabled</th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Models</th>
                </tr>
              </thead>
              <tbody>
                {config.providers.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.03]">
                    <td className="px-3 py-2.5 text-xs text-white font-medium">{p.id}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">{p.base_url}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400">{p.priority}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs ${p.enabled ? "text-emerald-400" : "text-zinc-600"}`}>
                        {p.enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">
                      {p.models ? Object.keys(p.models).join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Usage Example */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
      >
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Quick Start — cURL Example</h3>
        <div className="relative">
          <pre className="p-4 rounded-lg bg-black/50 border border-white/[0.06] text-xs font-mono text-zinc-300 overflow-x-auto">
{`curl -X POST ${gatewayUrl} \\
  -H "Authorization: Bearer ${fullKey || "sk-gateway-mysecretkey123"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'`}
          </pre>
          <button
            onClick={() =>
              handleCopy(
                `curl -X POST ${gatewayUrl} -H "Authorization: Bearer ${fullKey || "sk-gateway-mysecretkey123"}" -H "Content-Type: application/json" -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}],"stream":false}'`
              )
            }
            className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
