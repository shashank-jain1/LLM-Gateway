"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, RefreshCw, Shield, Clock, Zap, Save, Eye, EyeOff, Copy, Check, Wifi, WifiOff, RotateCcw, Plus, Trash2 } from "lucide-react";
import { useGatewayStore } from "@/lib/gateway-store";
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

export function SettingsTab() {
  const { doReloadConfig, doSaveConfig, config, isGatewayConnected } = useGatewayStore();
  const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({});
  const [copiedKeyIndex, setCopiedKeyIndex] = useState<number | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadSuccess, setReloadSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable gateway config fields
  const [editPort, setEditPort] = useState("");
  const [editHost, setEditHost] = useState("");
  const [editDefaultCooldown, setEditDefaultCooldown] = useState("");
  const [editMaxCooldown, setEditMaxCooldown] = useState("");
  const [editRequestTimeout, setEditRequestTimeout] = useState("");
  const [editLogLevel, setEditLogLevel] = useState("");
  const [editApiKeys, setEditApiKeys] = useState<{ key: string; label: string }[]>([]);
  const [hasEdits, setHasEdits] = useState(false);

  // State for generating a new key
  const [showAddKeyDialog, setShowAddKeyDialog] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");

  // Initialize edit fields when config loads
  const gateway = config?.gateway;
  const initEditsFromConfig = () => {
    if (gateway) {
      setEditPort(String(gateway.port));
      setEditHost(gateway.host);
      setEditDefaultCooldown(String(gateway.default_cooldown_seconds));
      setEditMaxCooldown(String(gateway.max_cooldown_seconds));
      setEditRequestTimeout(String(gateway.request_timeout_seconds));
      setEditLogLevel(gateway.log_level);
      
      const keysWithLabels = (gateway.api_keys || []).map((k) => ({
        key: k,
        label: gateway.api_key_labels?.[k] || "Default Key",
      }));
      setEditApiKeys(keysWithLabels);
      setHasEdits(false);
    }
  };

  // Run init on first render and when config changes
  if (gateway && !hasEdits && editPort === "") {
    initEditsFromConfig();
  }

  const markEdited = () => setHasEdits(true);

  const handleReload = async () => {
    setIsReloading(true);
    const success = await doReloadConfig();
    setIsReloading(false);
    if (success) {
      setReloadSuccess(true);
      setTimeout(() => setReloadSuccess(false), 2000);
      // Re-init edits from freshly loaded config
      setTimeout(initEditsFromConfig, 500);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const keysArray = editApiKeys.map((item) => item.key);
    const labelsMap = editApiKeys.reduce((acc, item) => {
      acc[item.key] = item.label;
      return acc;
    }, {} as Record<string, string>);

    const success = await doSaveConfig({
      gateway: {
        api_keys: keysArray.length > 0 ? keysArray : (gateway?.api_keys ?? ["sk-gateway-mysecretkey123"]),
        api_key_labels: labelsMap,
        port: parseInt(editPort, 10) || 8001,
        host: editHost || "0.0.0.0",
        default_cooldown_seconds: parseFloat(editDefaultCooldown) || 30.0,
        max_cooldown_seconds: parseFloat(editMaxCooldown) || 600.0,
        request_timeout_seconds: parseFloat(editRequestTimeout) || 60.0,
        log_level: editLogLevel || "info",
      },
    });
    setIsSaving(false);
    if (success) {
      setSaveSuccess(true);
      setHasEdits(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleReset = () => {
    initEditsFromConfig();
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyIndex(index);
    setTimeout(() => setCopiedKeyIndex(null), 2000);
  };

  const handleOpenAddKeyDialog = () => {
    setNewKeyLabel("");
    setShowAddKeyDialog(true);
  };

  const handleGenerateKey = () => {
    if (!newKeyLabel.trim()) return;
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "sk-gateway-";
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    setEditApiKeys([...editApiKeys, { key: token, label: newKeyLabel.trim() }]);
    setShowAddKeyDialog(false);
    markEdited();
  };

  const deleteKey = (index: number) => {
    if (editApiKeys.length <= 1) {
      alert("At least one API key is required to authenticate requests.");
      return;
    }
    const updated = editApiKeys.filter((_, i) => i !== index);
    setEditApiKeys(updated);
    markEdited();
  };

  const toggleKeyVisibility = (index: number) => {
    setVisibleKeys(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const gatewayUrl = `http://${gateway?.host ?? "0.0.0.0"}:${gateway?.port ?? 8001}/v1/chat/completions`;
  const exampleKey = editApiKeys[0]?.key ? `${editApiKeys[0].key.slice(0, 6)}***...${editApiKeys[0].key.slice(-4)}` : "sk-***...xxxx";
  const fullKey = editApiKeys[0]?.key ?? "";

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
              <p className="text-xs text-zinc-500">Hot-reload config.yaml from disk without restart</p>
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
          className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5 md:col-span-2 flex flex-col h-full"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Client API Keys</h3>
                <p className="text-xs text-zinc-500">Manage client keys and their labels used to access the gateway</p>
              </div>
            </div>
            <button
              onClick={handleOpenAddKeyDialog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-200"
            >
              <Plus className="w-3.5 h-3.5" />
              Generate Key
            </button>
          </div>

          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar flex-1">
            {editApiKeys.map((item, index) => {
              const keyVisible = visibleKeys[index] || false;
              const maskedKey = `${item.key.slice(0, 11)}***...${item.key.slice(-4)}`;
              return (
                <div key={index} className="flex flex-col gap-1 p-3 rounded-lg bg-black/20 border border-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => {
                        const updated = [...editApiKeys];
                        updated[index] = { ...updated[index], label: e.target.value };
                        setEditApiKeys(updated);
                        markEdited();
                      }}
                      className="bg-transparent text-xs font-semibold text-white focus:outline-none focus:border-b focus:border-cyan-500/30 px-1 py-0.5 max-w-[240px]"
                      placeholder="API Key Name/Label"
                    />
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleKeyVisibility(index)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        title={keyVisible ? "Hide key" : "Show key"}
                      >
                        {keyVisible ? (
                          <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopy(item.key, index)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        title="Copy key"
                      >
                        {copiedKeyIndex === index ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteKey(index)}
                        disabled={editApiKeys.length <= 1}
                        className="p-1 rounded bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-white/10"
                        title="Delete key"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500 overflow-hidden select-all px-1">
                    {keyVisible ? item.key : maskedKey}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Editable Gateway Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <Settings className="w-4 h-4 text-zinc-500" />
            Gateway Configuration
          </h3>
          {hasEdits && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Port</label>
              <input
                type="number"
                value={editPort}
                onChange={(e) => { setEditPort(e.target.value); markEdited(); }}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Host</label>
              <input
                type="text"
                value={editHost}
                onChange={(e) => { setEditHost(e.target.value); markEdited(); }}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Default Cooldown (s)
              </label>
              <input
                type="number"
                step="1"
                value={editDefaultCooldown}
                onChange={(e) => { setEditDefaultCooldown(e.target.value); markEdited(); }}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Max Cooldown (s)
              </label>
              <input
                type="number"
                step="1"
                value={editMaxCooldown}
                onChange={(e) => { setEditMaxCooldown(e.target.value); markEdited(); }}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Request Timeout (s)
              </label>
              <input
                type="number"
                step="1"
                value={editRequestTimeout}
                onChange={(e) => { setEditRequestTimeout(e.target.value); markEdited(); }}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Log Level</label>
              <select
                value={editLogLevel}
                onChange={(e) => { setEditLogLevel(e.target.value); markEdited(); }}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-cyan-400 font-mono focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20"
              >
                <option value="debug" className="bg-[#1a1a2e]">debug</option>
                <option value="info" className="bg-[#1a1a2e]">info</option>
                <option value="warning" className="bg-[#1a1a2e]">warning</option>
                <option value="error" className="bg-[#1a1a2e]">error</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 uppercase tracking-wider block mb-1.5">Providers Configured</label>
              <input
                type="text"
                value={config?.providers?.length ?? 0}
                readOnly
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-white focus:outline-none opacity-60"
              />
            </div>
          </div>

          {/* Save / Reset buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!hasEdits || isSaving}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                saveSuccess
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : hasEdits
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20"
                  : "bg-white/5 text-zinc-600 border border-white/[0.04] cursor-not-allowed"
              } disabled:opacity-50`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
            {hasEdits && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-white/5 text-zinc-400 border border-white/[0.06] hover:bg-white/10 transition-all duration-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>

          <p className="text-[10px] text-zinc-600 italic">
            Changes are saved to the live gateway config and persisted to config.yaml on disk.
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

      <Dialog open={showAddKeyDialog} onOpenChange={setShowAddKeyDialog}>
        <DialogContent className="sm:max-w-[425px] bg-[#11111a] border border-white/[0.06] text-white">
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Give this client key a friendly name/label (e.g. "Production App", "John Doe's Project") to identify it in metrics and logs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="key-label" className="text-right text-xs text-zinc-400">
                Label Name
              </Label>
              <Input
                id="key-label"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="e.g. Web App Client"
                className="col-span-3 bg-black/30 border-white/10 focus:border-cyan-500/30 text-white placeholder-zinc-700 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newKeyLabel.trim()) {
                    handleGenerateKey();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddKeyDialog(false)}
              className="text-xs hover:bg-white/5 text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!newKeyLabel.trim()}
              onClick={handleGenerateKey}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs disabled:opacity-50"
            >
              Generate & Add Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
