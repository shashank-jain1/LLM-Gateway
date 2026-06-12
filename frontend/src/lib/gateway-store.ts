"use client";

import { create } from "zustand";
import {
  getGatewayStatus,
  getRequestHistory,
  getModels,
  getGatewayConfig,
  saveGatewayConfig,
  reloadConfig,
  toggleProvider,
  addProvider,
  deleteProvider,
  updateProvider,
  sendTestRequest,
  testProvider,
  buildLatencyDataFromHistory,
  buildVolumeDataFromHistory,
  buildErrorDataFromHistory,
  type GatewayStatus,
  type ModelsResponse,
  type RequestHistoryEntry,
  type GatewayConfig,
} from "@/lib/gateway-api";

interface GatewayStore {
  // Data
  status: GatewayStatus | null;
  models: ModelsResponse | null;
  requestHistory: RequestHistoryEntry[];
  config: GatewayConfig | null;
  latencyData: any[];
  volumeData: any[];
  errorData: any[];

  // UI State
  isLoading: boolean;
  isGatewayConnected: boolean;
  activeTab: string;
  sidebarCollapsed: boolean;
  toasts: Array<{ id: string; message: string; type: "success" | "error" }>;

  // Actions
  fetchStatus: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchRequestHistory: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
  doReloadConfig: () => Promise<boolean>;
  doSaveConfig: (config: Partial<GatewayConfig>) => Promise<boolean>;
  doToggleProvider: (providerId: string, action: "enable" | "disable") => Promise<boolean>;
  doAddProvider: (provider: { id: string; enabled: boolean; priority: number; base_url: string; api_key: string; models: Record<string, string> }) => Promise<boolean>;
  doDeleteProvider: (providerId: string) => Promise<boolean>;
  doUpdateProvider: (providerId: string, updates: Record<string, any>) => Promise<boolean>;
  doTestProvider: (providerId: string) => Promise<{ success: boolean; message: string }>;
  doTestRequest: (model: string, messages: Array<{ role: string; content: string }>) => Promise<any>;
  addToast: (message: string, type?: "success" | "error") => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  status: null,
  models: null,
  requestHistory: [],
  config: null,
  latencyData: [],
  volumeData: [],
  errorData: [],
  isLoading: false,
  isGatewayConnected: false,
  activeTab: "overview",
  sidebarCollapsed: false,
  toasts: [],

  fetchStatus: async () => {
    try {
      const status = await getGatewayStatus();
      set({ status, isGatewayConnected: true });
    } catch (e) {
      console.error("Failed to fetch gateway status:", e);
      set({ isGatewayConnected: false });
    }
  },

  fetchModels: async () => {
    try {
      const models = await getModels();
      set({ models, isGatewayConnected: true });
    } catch (e) {
      console.error("Failed to fetch models:", e);
    }
  },

  fetchRequestHistory: async () => {
    try {
      const requestHistory = await getRequestHistory(200);
      set({
        requestHistory,
        latencyData: buildLatencyDataFromHistory(requestHistory),
        volumeData: buildVolumeDataFromHistory(requestHistory),
        errorData: buildErrorDataFromHistory(requestHistory),
      });
    } catch (e) {
      console.error("Failed to fetch request history:", e);
    }
  },

  fetchConfig: async () => {
    try {
      const config = await getGatewayConfig();
      set({ config });
    } catch (e) {
      console.error("Failed to fetch gateway config:", e);
    }
  },

  refreshAll: async () => {
    set({ isLoading: true });
    try {
      await Promise.all([
        get().fetchStatus(),
        get().fetchModels(),
        get().fetchRequestHistory(),
        get().fetchConfig(),
      ]);
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  doReloadConfig: async () => {
    try {
      const result = await reloadConfig();
      if (result.status === "ok") {
        get().addToast("Config reloaded successfully", "success");
        await get().refreshAll();
        return true;
      } else {
        get().addToast(result.message || "Failed to reload config", "error");
        return false;
      }
    } catch {
      get().addToast("Gateway unreachable", "error");
      return false;
    }
  },

  doSaveConfig: async (config) => {
    try {
      const result = await saveGatewayConfig(config);
      if (result.status === "ok") {
        get().addToast("Gateway configuration saved", "success");
        await get().refreshAll();
        return true;
      } else {
        get().addToast(result.message || "Failed to save config", "error");
        return false;
      }
    } catch {
      get().addToast("Gateway unreachable", "error");
      return false;
    }
  },

  doToggleProvider: async (providerId, action) => {
    try {
      const result = await toggleProvider(providerId, action);
      if (result.status === "ok") {
        get().addToast(`Provider ${providerId} ${action}d`, "success");
        await get().refreshAll();
        return true;
      } else {
        get().addToast(result.message || `Failed to ${action} provider`, "error");
        return false;
      }
    } catch {
      get().addToast("Gateway unreachable", "error");
      return false;
    }
  },

  doAddProvider: async (provider) => {
    try {
      const result = await addProvider(provider);
      if (result.status === "ok") {
        get().addToast(`Provider '${provider.id}' added`, "success");
        await get().refreshAll();
        return true;
      } else {
        get().addToast(result.message || "Failed to add provider", "error");
        return false;
      }
    } catch {
      get().addToast("Gateway unreachable", "error");
      return false;
    }
  },

  doDeleteProvider: async (providerId) => {
    try {
      const result = await deleteProvider(providerId);
      if (result.status === "ok") {
        get().addToast(`Provider '${providerId}' deleted`, "success");
        await get().refreshAll();
        return true;
      } else {
        get().addToast(result.message || "Failed to delete provider", "error");
        return false;
      }
    } catch {
      get().addToast("Gateway unreachable", "error");
      return false;
    }
  },

  doUpdateProvider: async (providerId, updates) => {
    try {
      const result = await updateProvider(providerId, updates);
      if (result.status === "ok") {
        get().addToast(`Provider '${providerId}' updated`, "success");
        await get().refreshAll();
        return true;
      } else {
        get().addToast(result.message || "Failed to update provider", "error");
        return false;
      }
    } catch {
      get().addToast("Gateway unreachable", "error");
      return false;
    }
  },

  doTestProvider: async (providerId) => {
    try {
      const result = await testProvider(providerId);
      if (result.status === "ok") {
        get().addToast(`Provider '${providerId}' test succeeded!`, "success");
        return { success: true, message: result.response || result.message };
      } else {
        get().addToast(`Provider '${providerId}' test failed`, "error");
        return { success: false, message: result.details || result.message };
      }
    } catch {
      get().addToast("Gateway unreachable", "error");
      return { success: false, message: "Gateway unreachable" };
    }
  },

  doTestRequest: async (model, messages) => {
    try {
      const result = await sendTestRequest({ model, messages, stream: false });
      await get().refreshAll(); // Refresh to get updated request history
      return result;
    } catch {
      get().addToast("Test request failed — gateway unreachable", "error");
      return null;
    }
  },

  addToast: (message, type = "success") => {
    const id = `toast-${++toastCounter}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 3500);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
