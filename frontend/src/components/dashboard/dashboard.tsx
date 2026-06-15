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

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-700 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

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
    <div className="flex h-screen overflow-hidden bg-[#070710] text-zinc-200 relative">
      {/* Subtle background grid */}
      <div className="absolute inset-0 bg-grid pointer-events-none z-0 opacity-50" />

      {/* Ambient glows */}
      <div className="absolute top-[-15%] left-[-5%] w-[45%] h-[45%] rounded-full bg-indigo-500/[0.03] blur-[140px] pointer-events-none bg-glow-cyan z-0" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-teal-500/[0.03] blur-[120px] pointer-events-none bg-glow-rose z-0" />

      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto relative z-10">
        <div className="p-8 lg:p-10 max-w-[1440px] mx-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="w-5 h-5 text-indigo-400"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white tracking-tight leading-tight">
                  LLM Gateway
                </h1>
                <p className="text-sm text-zinc-500 font-medium mt-0.5">
                  Multi-provider API management
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Gateway Badge */}
              <div
                className={`flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all duration-300 ${
                  isGatewayConnected
                    ? "bg-teal-500/[0.06] border-teal-500/15"
                    : "bg-rose-500/[0.06] border-rose-500/15"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isGatewayConnected ? "bg-teal-400 status-dot-online" : "bg-rose-500"
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] font-semibold tracking-wide ${
                    isGatewayConnected ? "text-teal-400" : "text-rose-400"
                  }`}
                >
                  {isGatewayConnected ? "Gateway Online" : "Gateway Offline"}
                </span>
              </div>

              {/* Refresh Button */}
              <button
                onClick={refreshAll}
                disabled={isLoading}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200 disabled:opacity-40 group"
                title="Refresh data"
              >
                <RefreshIcon spinning={isLoading} />
              </button>
            </div>
          </header>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
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
