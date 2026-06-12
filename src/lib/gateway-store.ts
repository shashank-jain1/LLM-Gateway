"use client";

import { create } from "zustand";
import {
  getGatewayStatus,
  getRequestHistory,
  getModels,
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

  // Actions
  fetchStatus: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchRequestHistory: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  toggleSidebar: () => void;
}

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
      await Promise.all([get().fetchStatus(), get().fetchModels(), get().fetchRequestHistory()]);
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
}));
