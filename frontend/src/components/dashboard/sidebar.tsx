"use client";

import { useGatewayStore } from "@/lib/gateway-store";
import {
  LayoutDashboard,
  Server,
  Boxes,
  Activity,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "providers", label: "Providers", icon: Server },
  { id: "models", label: "Models", icon: Boxes },
  { id: "monitoring", label: "Monitoring", icon: Activity },
  { id: "logs", label: "Request Logs", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
];

function StatusIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center w-5 h-5">
        {isOnline ? (
          <>
            <div className="absolute w-3 h-3 rounded-full bg-teal-400/20 animate-ping" />
            <div className="relative w-2 h-2 rounded-full bg-teal-400 status-dot-online" />
          </>
        ) : (
          <div className="w-2 h-2 rounded-full bg-rose-500" />
        )}
      </div>
      <span
        className={`text-xs font-medium tracking-tight ${
          isOnline ? "text-teal-400" : "text-rose-400"
        }`}
      >
        {isOnline ? "Online" : "Offline"}
      </span>
    </div>
  );
}

export function Sidebar() {
  const { activeTab, setActiveTab, sidebarCollapsed, toggleSidebar, status, isGatewayConnected } = useGatewayStore();

  const enabledProviders = status?.providers.filter((p) => p.enabled).length ?? 0;
  const healthyCount = status?.providers.filter((p) => p.enabled && p.status === "healthy").length ?? 0;
  const totalProviders = status?.providers.length ?? 0;

  return (
    <aside
      className={`${
        sidebarCollapsed ? "w-16" : "w-[240px]"
      } h-screen sticky top-0 shrink-0 flex flex-col border-r border-white/[0.06] bg-[#080810]/90 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] relative z-20`}
    >
      {/* Logo Area */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-4 h-4 text-indigo-400"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <h2 className="text-sm font-semibold text-zinc-200 tracking-tight leading-none">Gateway</h2>
            <p className="text-[11px] text-zinc-600 font-medium mt-0.5">v1.0.0</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="w-full group relative"
            >
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-indigo-500/[0.08] text-indigo-300"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 transition-colors duration-200 ${
                    isActive ? "text-indigo-400" : "text-zinc-600 group-hover:text-zinc-400"
                  }`}
                />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </div>
              {/* Active indicator line */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-indigo-500 rounded-r-full"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Connection Status & Provider Summary */}
      {!sidebarCollapsed && (
        <div className="p-3 space-y-3">
          {/* Connection */}
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-700 font-semibold mb-2.5">Gateway</p>
            <StatusIndicator isOnline={isGatewayConnected} />
            {isGatewayConnected && (
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-zinc-600">Latency</span>
                  <span className="text-[11px] font-mono text-zinc-400">{status?.gateway?.port ?? "—"}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-zinc-600">Uptime</span>
                  <span className="text-[11px] font-mono text-zinc-400">—</span>
                </div>
              </div>
            )}
          </div>

          {/* Providers Summary */}
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-700 font-semibold mb-3">Providers</p>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1.5">
                {status?.providers.map((p) => (
                  <div
                    key={p.provider_id}
                    className={`w-6 h-6 rounded-full border-2 border-[#080810] flex items-center justify-center ${
                      !p.enabled
                        ? "bg-zinc-700"
                        : p.status === "healthy"
                        ? "bg-teal-500/80"
                        : "bg-amber-500/80"
                    }`}
                    title={`${p.provider_id}: ${!p.enabled ? "disabled" : p.status}`}
                  >
                    <span className="text-[7px] font-bold text-white/90 uppercase tracking-tighter">
                      {p.provider_id.slice(0, 1)}
                    </span>
                  </div>
                ))}
              </div>
              <span className="text-xs text-zinc-500 font-medium">
                {healthyCount}/{totalProviders} <span className="text-zinc-600">healthy</span>
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-500/60 transition-all duration-500"
                  style={{
                    width: totalProviders > 0 ? `${(healthyCount / totalProviders) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="mx-3 mb-3 h-8 flex items-center justify-center rounded-md bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 group"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        ) : (
          <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 font-medium transition-colors flex items-center gap-1.5">
            <ChevronLeft className="w-3.5 h-3.5" />
            Collapse
          </span>
        )}
      </button>
    </aside>
  );
}
