"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import { motion } from "framer-motion";
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Clock,
  Globe,
  Plus,
  Trash2,
  X,
  Hash,
  Boxes,
  Edit,
  Play,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ModelMapping {
  virtual: string;
  actual: string;
}

export function ProvidersTab() {
  const { status, config, doToggleProvider, doAddProvider, doDeleteProvider, doUpdateProvider, doTestProvider } = useGatewayStore();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResultModal, setTestResultModal] = useState<{
    open: boolean;
    providerId: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Add provider form state
  const [formId, setFormId] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formPriority, setFormPriority] = useState("1");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formModels, setFormModels] = useState<ModelMapping[]>([{ virtual: "", actual: "" }]);

  const providers = status?.providers ?? [];

  const handleToggle = async (providerId: string, isEnabled: boolean) => {
    setTogglingId(providerId);
    const action = isEnabled ? "disable" : "enable";
    await doToggleProvider(providerId, action);
    setTogglingId(null);
  };

  const handleDelete = async (providerId: string) => {
    setDeletingId(providerId);
    await doDeleteProvider(providerId);
    setDeletingId(null);
  };

  const openEditDialog = (providerId: string) => {
    const providerConfig = config?.providers.find((p) => p.id === providerId);
    if (!providerConfig) return;

    setEditingId(providerId);
    setFormId(providerId);
    setFormBaseUrl(providerConfig.base_url);
    setFormApiKey(providerConfig.api_key || "");
    setFormPriority(String(providerConfig.priority));
    setFormEnabled(providerConfig.enabled);
    
    const mappings = Object.entries(providerConfig.models || {}).map(([virtual, actual]) => ({
      virtual,
      actual,
    }));
    setFormModels(mappings.length > 0 ? mappings : [{ virtual: "", actual: "" }]);
    setEditDialogOpen(true);
  };

  const handleEditProvider = async () => {
    if (!editingId || !formBaseUrl.trim() || !formApiKey.trim()) return;

    const modelMappings: Record<string, string> = {};
    for (const m of formModels) {
      if (m.virtual.trim() && m.actual.trim()) {
        modelMappings[m.virtual.trim()] = m.actual.trim();
      }
    }

    setIsEditing(true);
    const success = await doUpdateProvider(editingId, {
      base_url: formBaseUrl.trim(),
      api_key: formApiKey.trim(),
      priority: parseInt(formPriority, 10) || 1,
      enabled: formEnabled,
      models: modelMappings,
    });
    setIsEditing(false);

    if (success) {
      resetForm();
      setEditDialogOpen(false);
      setEditingId(null);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    setTestingId(providerId);
    const result = await doTestProvider(providerId);
    setTestingId(null);
    setTestResultModal({
      open: true,
      providerId,
      success: result.success,
      message: result.message,
    });
  };

  const resetForm = () => {
    setFormId("");
    setFormBaseUrl("");
    setFormApiKey("");
    setFormPriority("1");
    setFormEnabled(true);
    setFormModels([{ virtual: "", actual: "" }]);
  };

  const handleAddProvider = async () => {
    if (!formId.trim() || !formBaseUrl.trim() || !formApiKey.trim()) return;

    const modelMappings: Record<string, string> = {};
    for (const m of formModels) {
      if (m.virtual.trim() && m.actual.trim()) {
        modelMappings[m.virtual.trim()] = m.actual.trim();
      }
    }

    setIsAdding(true);
    const success = await doAddProvider({
      id: formId.trim(),
      base_url: formBaseUrl.trim(),
      api_key: formApiKey.trim(),
      priority: parseInt(formPriority, 10) || 1,
      enabled: formEnabled,
      models: modelMappings,
    });
    setIsAdding(false);

    if (success) {
      resetForm();
      setAddDialogOpen(false);
    }
  };

  const addModelRow = () => {
    setFormModels([...formModels, { virtual: "", actual: "" }]);
  };

  const removeModelRow = (index: number) => {
    setFormModels(formModels.filter((_, i) => i !== index));
  };

  const updateModelRow = (index: number, field: "virtual" | "actual", value: string) => {
    const updated = [...formModels];
    updated[index] = { ...updated[index], [field]: value };
    setFormModels(updated);
  };

  const isFormValid = formId.trim() && formBaseUrl.trim() && formApiKey.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Provider Management</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Configure and monitor your LLM backend providers</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            {providers.filter((p) => p.enabled && p.status === "healthy").length} of {providers.length} healthy
          </span>
          <button
            onClick={() => setAddDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        {providers.map((provider, i) => {
          const isToggling = togglingId === provider.provider_id;
          const isDeleting = deletingId === provider.provider_id;

          return (
            <motion.div
              key={provider.provider_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: "easeOut" }}
              className={`rounded-xl bg-[#11111a] border p-6 hover:border-white/[0.12] transition-all duration-300 ${
                !provider.enabled
                  ? "border-zinc-700/30 opacity-60"
                  : provider.status === "healthy"
                  ? "border-white/[0.06]"
                  : "border-amber-500/20"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Left: Provider Info */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        !provider.enabled
                          ? "bg-zinc-500/10 border border-zinc-500/20"
                          : provider.status === "healthy"
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-amber-500/10 border border-amber-500/20"
                      }`}
                    >
                      <Server
                        className={`w-5 h-5 ${
                          !provider.enabled
                            ? "text-zinc-500"
                            : provider.status === "healthy"
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{provider.provider_id}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                            !provider.enabled
                              ? "bg-zinc-500/10 text-zinc-500"
                              : provider.status === "healthy"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {!provider.enabled ? (
                            <X className="w-3 h-3" />
                          ) : provider.status === "healthy" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {!provider.enabled ? "disabled" : provider.status}
                        </span>
                        <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                          <Hash className="w-2.5 h-2.5" />
                          Priority {provider.priority}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Base URL */}
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Globe className="w-3.5 h-3.5 shrink-0 text-zinc-600" />
                    <span className="font-mono truncate">{provider.base_url}</span>
                  </div>

                  {/* Models Mapping */}
                  {provider.models && Object.keys(provider.models).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider flex items-center gap-1">
                        <Boxes className="w-3 h-3" />
                        Model Mappings
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(provider.models).map(([virtual, actual]) => (
                          <span
                            key={virtual}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/10 font-mono"
                          >
                            <span className="text-cyan-300">{virtual}</span>
                            <span className="text-zinc-600">→</span>
                            <span className="text-zinc-400">{actual}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Total Requests</p>
                      <p className="text-lg font-bold text-white">{provider.total_requests.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Success Rate</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {provider.total_requests > 0
                          ? ((provider.total_successes / provider.total_requests) * 100).toFixed(1)
                          : "0"}%
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Failures</p>
                      <p className="text-lg font-bold text-rose-400">{provider.total_failures}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Consecutive Fails</p>
                      <p
                        className={`text-lg font-bold ${
                          provider.consecutive_failures > 0 ? "text-amber-400" : "text-zinc-400"
                        }`}
                      >
                        {provider.consecutive_failures}
                      </p>
                    </div>
                  </div>

                  {/* Error info */}
                  {provider.last_error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/5 border border-rose-500/10">
                      <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-rose-400 font-medium">Last Error</p>
                        <p className="text-[11px] text-rose-400/70 mt-0.5">{provider.last_error}</p>
                      </div>
                    </div>
                  )}

                  {/* Cooldown info */}
                  {provider.enabled && provider.status === "cooldown" && provider.cooldown_until && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-400">
                        In cooldown — auto-recovers in ~
                        {Math.max(0, Math.round(provider.cooldown_until - Date.now() / 1000))}s
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-row lg:flex-col items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleTestProvider(provider.provider_id)}
                    disabled={testingId === provider.provider_id}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all duration-200 disabled:opacity-50"
                  >
                    {testingId === provider.provider_id ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Test
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => openEditDialog(provider.provider_id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 transition-all duration-200"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  <button
                    onClick={() => handleToggle(provider.provider_id, provider.enabled)}
                    disabled={isToggling}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      provider.enabled
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                    } disabled:opacity-50`}
                  >
                    {isToggling ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : provider.enabled ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    {provider.enabled ? "Disable" : "Enable"}
                  </button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all duration-200 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Delete
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#1a1a2e] border-white/10">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Delete Provider</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          Are you sure you want to delete <span className="text-white font-medium">{provider.provider_id}</span>?
                          This action cannot be undone and will immediately remove the provider from the gateway.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(provider.provider_id)}
                          className="bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:bg-rose-500/30"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* No Providers */}
      {providers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
          <Server className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium">No providers configured</p>
          <p className="text-xs mt-1">Add a provider to get started</p>
          <button
            onClick={() => setAddDialogOpen(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        </div>
      )}

      {/* Provider Config Summary */}
      {providers.length > 0 && (
        <div className="rounded-xl bg-[#11111a] border border-white/[0.06] p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Connection Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Provider
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Base URL
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Priority
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Enabled
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Status
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                    Models
                  </th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => (
                  <tr key={provider.provider_id} className="border-b border-white/[0.03]">
                    <td className="px-3 py-2.5 text-xs text-white font-medium">{provider.provider_id}</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">{provider.base_url}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        provider.priority === 1
                          ? "bg-emerald-500/10 text-emerald-400"
                          : provider.priority === 2
                          ? "bg-cyan-500/10 text-cyan-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {provider.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs ${provider.enabled ? "text-emerald-400" : "text-zinc-600"}`}>
                        {provider.enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                        !provider.enabled
                          ? "bg-zinc-500/10 text-zinc-500"
                          : provider.status === "healthy"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {!provider.enabled ? "disabled" : provider.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">
                      {provider.models ? Object.keys(provider.models).join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Provider Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Add Provider</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Configure a new LLM provider for the gateway
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ID */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">Provider ID</Label>
              <Input
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                placeholder="e.g. openai-primary"
                className="bg-black/30 border-white/10 text-white placeholder-zinc-600 text-sm"
              />
            </div>

            {/* Base URL */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">Base URL</Label>
              <Input
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="e.g. https://api.openai.com/v1"
                className="bg-black/30 border-white/10 text-white placeholder-zinc-600 text-sm font-mono"
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">API Key</Label>
              <Input
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="sk-..."
                className="bg-black/30 border-white/10 text-white placeholder-zinc-600 text-sm font-mono"
              />
            </div>

            {/* Priority + Enabled */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Priority</Label>
                <Input
                  type="number"
                  min="1"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="bg-black/30 border-white/10 text-white text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Enabled</Label>
                <div className="flex items-center gap-3 h-9">
                  <Switch
                    checked={formEnabled}
                    onCheckedChange={setFormEnabled}
                  />
                  <span className={`text-sm ${formEnabled ? "text-emerald-400" : "text-zinc-500"}`}>
                    {formEnabled ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {/* Model Mappings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300 text-xs">Model Mappings</Label>
                <button
                  onClick={addModelRow}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add mapping
                </button>
              </div>
              <div className="space-y-2">
                {formModels.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={mapping.virtual}
                      onChange={(e) => updateModelRow(index, "virtual", e.target.value)}
                      placeholder="Virtual model"
                      className="flex-1 bg-black/30 border-white/10 text-white placeholder-zinc-600 text-xs font-mono"
                    />
                    <span className="text-zinc-600 text-xs">→</span>
                    <Input
                      value={mapping.actual}
                      onChange={(e) => updateModelRow(index, "actual", e.target.value)}
                      placeholder="Actual model"
                      className="flex-1 bg-black/30 border-white/10 text-white placeholder-zinc-600 text-xs font-mono"
                    />
                    {formModels.length > 1 && (
                      <button
                        onClick={() => removeModelRow(index)}
                        className="p-1.5 rounded hover:bg-white/5 text-zinc-600 hover:text-rose-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600">
                Map virtual model names (used by clients) to actual provider model names
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              className="bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddProvider}
              disabled={!isFormValid || isAdding}
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {isAdding ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Add Provider
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Provider Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setEditingId(null);
      }}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Provider: {editingId}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update configuration for this provider
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Base URL */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">Base URL</Label>
              <Input
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="e.g. https://api.openai.com/v1"
                className="bg-black/30 border-white/10 text-white placeholder-zinc-600 text-sm font-mono"
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label className="text-zinc-300 text-xs">API Key</Label>
              <Input
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="bg-black/30 border-white/10 text-white placeholder-zinc-600 text-sm font-mono"
              />
            </div>

            {/* Priority + Enabled */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Priority</Label>
                <Input
                  type="number"
                  min="1"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="bg-black/30 border-white/10 text-white text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Enabled</Label>
                <div className="flex items-center gap-3 h-9">
                  <Switch
                    checked={formEnabled}
                    onCheckedChange={setFormEnabled}
                  />
                  <span className={`text-sm ${formEnabled ? "text-emerald-400" : "text-zinc-500"}`}>
                    {formEnabled ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {/* Model Mappings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300 text-xs">Model Mappings</Label>
                <button
                  onClick={addModelRow}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add mapping
                </button>
              </div>
              <div className="space-y-2">
                {formModels.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={mapping.virtual}
                      onChange={(e) => updateModelRow(index, "virtual", e.target.value)}
                      placeholder="Virtual model"
                      className="flex-1 bg-black/30 border-white/10 text-white placeholder-zinc-600 text-xs font-mono"
                    />
                    <span className="text-zinc-600 text-xs">→</span>
                    <Input
                      value={mapping.actual}
                      onChange={(e) => updateModelRow(index, "actual", e.target.value)}
                      placeholder="Actual model"
                      className="flex-1 bg-black/30 border-white/10 text-white placeholder-zinc-600 text-xs font-mono"
                    />
                    {formModels.length > 1 && (
                      <button
                        onClick={() => removeModelRow(index)}
                        className="p-1.5 rounded hover:bg-white/5 text-zinc-600 hover:text-rose-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600">
                Map virtual model names (used by clients) to actual provider model names
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingId(null);
              }}
              className="bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditProvider}
              disabled={!formBaseUrl.trim() || !formApiKey.trim() || isEditing}
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {isEditing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog open={!!testResultModal?.open} onOpenChange={(open) => {
        if (!open) setTestResultModal(null);
      }}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {testResultModal?.success ? (
                <span className="text-emerald-400">✓ Test Succeeded</span>
              ) : (
                <span className="text-rose-400">✗ Test Failed</span>
              )}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Direct connection test for provider <span className="font-mono text-zinc-300 font-semibold">{testResultModal?.providerId}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className={`p-4 rounded-xl border ${
              testResultModal?.success 
                ? "bg-emerald-500/5 border-emerald-500/20 text-zinc-300" 
                : "bg-rose-500/5 border-rose-500/20 text-rose-300"
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wider block mb-2 text-zinc-400">
                {testResultModal?.success ? "Provider Response" : "Error details"}
              </span>
              <p className="text-sm font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                {testResultModal?.message}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setTestResultModal(null)}
              className="bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
