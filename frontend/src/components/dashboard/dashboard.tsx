"use client";

import { useEffect } from "react";
import { useGatewayStore } from "@/lib/gateway-store";
import { Sidebar } from "@/components/dashboard/sidebar";
import { OverviewTab } from "@/components/dashboard/overview-tab";
import { ProvidersTab } from "@/components/dashboard/providers-tab";
import { ModelsTab } from "@/components/dashboard/models-tab";
import { MonitoringTab } from "@/components/dashboard/monitoring-tab";
import { LogsTab } from "@/components/dashboard/logs-tab";
import { SettingsTab } from "@/components/dashboard/settings-tab";
import { ToastContainer } from "@/components/dashboard/toast-container";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";

export function Dashboard() {
  const { activeTab, refreshAll, isLoading, isGatewayConnected } = useGatewayStore();

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "providers":
        return <ProvidersTab />;
      case "models":
        return <ModelsTab />;
      case "monitoring":
        return <MonitoringTab />;
      case "logs":
        return <LogsTab />;
      case "settings":
        return <SettingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#07070c] text-white relative">
      {/* Background Cosmic Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/[0.04] blur-[130px] pointer-events-none bg-glow-1 z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/[0.04] blur-[130px] pointer-events-none bg-glow-2 z-0" />
      <div className="absolute top-[35%] left-[20%] w-[35%] h-[35%] rounded-full bg-blue-500/[0.02] blur-[150px] pointer-events-none bg-glow-1 z-0" />

      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto relative z-10">
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  LLM Gateway
                </span>
              </h1>
              <p className="text-sm text-zinc-500 mt-1">Multi-provider API management & monitoring</p>
            </div>
            <div className="flex items-center gap-3">
              {isGatewayConnected ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-400">Gateway Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                  <div className="h-2 w-2 rounded-full bg-rose-500" />
                  <span className="text-xs font-medium text-rose-400">Gateway Offline</span>
                </div>
              )}
              <button
                onClick={refreshAll}
                disabled={isLoading}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 disabled:opacity-50"
                title="Refresh data"
              >
                <svg
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Gateway Offline Banner */}
          <AnimatePresence>
            {!isGatewayConnected && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <WifiOff className="w-5 h-5 text-rose-400 shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-rose-300">Gateway Offline</h3>
                    <p className="text-xs text-rose-400/70 mt-0.5">
                      Cannot connect to the Python LLM Gateway backend. Data shown may be stale. Check that the gateway service is running.
                    </p>
                  </div>
                  <button
                    onClick={refreshAll}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/20 hover:bg-rose-500/30 transition-all duration-200 disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                    Retry
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {renderTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
