"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, RefreshCw, Shield, Clock, Zap, Save, Eye, EyeOff, Copy, Check } from "lucide-react";
import { useGatewayStore } from "@/lib/gateway-store";

export function SettingsTab() {
  const { doReloadConfig } = useGatewayStore();
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

  const gatewayUrl = "http://localhost:8000/v1/chat/completions";
  const exampleKey = "sk-gateway-mysecretkey123";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Gateway configuration and quick actions</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
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
          transition={{ delay: 0.1, duration: 0.4 }}
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
              <span className="truncate">{showApiKey ? exampleKey : "sk-gate\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}</span>
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
              onClick={() => handleCopy(exampleKey)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-zinc-400" />
              )}
            </button>
          </div>
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
                defaultValue="8000"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Host</label>
              <input
                type="text"
                defaultValue="0.0.0.0"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30"
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
                defaultValue="30"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Max Cooldown (s)
              </label>
              <input
                type="text"
                defaultValue="600"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Request Timeout (s)
              </label>
              <input
                type="text"
                defaultValue="60"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30"
              />
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-200">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </motion.div>

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
  -H "Authorization: Bearer ${exampleKey}" \\
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
                `curl -X POST ${gatewayUrl} -H "Authorization: Bearer ${exampleKey}" -H "Content-Type: application/json" -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}],"stream":false}'`
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
