"use client";

import { create } from "zustand";
import {
  getGatewayStatus,
  getRequestHistory,
  getModels,
  reloadConfig,
  toggleProvider,
  type GatewayStatus,
  type ModelsResponse,
  type RequestHistoryEntry,
  generateLatencyTimeline,
  generateRequestVolume,
  generateErrorDistribution,
} from "@/lib/gateway-api";

interface GatewayStore {
  // Data
  status: GatewayStatus | null;
  models: ModelsResponse | null;
  requestHistory: RequestHistoryEntry[];
  latencyData: ReturnType<typeof generateLatencyTimeline>;
  volumeData: ReturnType<typeof generateRequestVolume>;
  errorData: ReturnType<typeof generateErrorDistribution>;

  // UI State
  isLoading: boolean;
  activeTab: string;
  sidebarCollapsed: boolean;
  toasts: Array<{ id: string; message: string; type: "success" | "error" }>;

  // Actions
  fetchStatus: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchRequestHistory: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
  doReloadConfig: () => Promise<boolean>;
  doToggleProvider: (providerId: string, action: "enable" | "disable") => Promise<boolean>;
  addToast: (message: string, type?: "success" | "error") => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  status: null,
  models: null,
  requestHistory: [],
  latencyData: generateLatencyTimeline(),
  volumeData: generateRequestVolume(),
  errorData: generateErrorDistribution(),
  isLoading: false,
  activeTab: "overview",
  sidebarCollapsed: false,
  toasts: [],

  fetchStatus: async () => {
    try {
      const status = await getGatewayStatus();
      set({ status });
    } catch (e) {
      console.error("Failed to fetch gateway status:", e);
    }
  },

  fetchModels: async () => {
    try {
      const models = await getModels();
      set({ models });
    } catch (e) {
      console.error("Failed to fetch models:", e);
    }
  },

  fetchRequestHistory: async () => {
    try {
      const requestHistory = await getRequestHistory();
      set({ requestHistory });
    } catch (e) {
      console.error("Failed to fetch request history:", e);
    }
  },

  refreshAll: async () => {
    set({ isLoading: true });
    try {
      await Promise.all([
        get().fetchStatus(),
        get().fetchModels(),
        get().fetchRequestHistory(),
      ]);
      set({
        latencyData: generateLatencyTimeline(),
        volumeData: generateRequestVolume(),
        errorData: generateErrorDistribution(),
      });
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

  doToggleProvider: async (providerId, action) => {
    try {
      const result = await toggleProvider(providerId, action);
      if (result.status === "ok") {
        get().addToast(`Provider ${providerId} ${action}d`, "success");
        await get().fetchStatus();
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

  addToast: (message, type = "success") => {
    const id = `toast-${++toastCounter}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 3500);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
