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
  Zap,
  Wifi,
  WifiOff,
} from "lucide-react";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "providers", label: "Providers", icon: Server },
  { id: "models", label: "Models", icon: Boxes },
  { id: "monitoring", label: "Monitoring", icon: Activity },
  { id: "logs", label: "Request Logs", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { activeTab, setActiveTab, sidebarCollapsed, toggleSidebar, status, isGatewayConnected } = useGatewayStore();

  const enabledProviders = status?.providers.filter((p) => p.enabled).length ?? 0;
  const healthyCount = status?.providers.filter((p) => p.enabled && p.status === "healthy").length ?? 0;
  const totalProviders = status?.providers.length ?? 0;

  return (
    <aside
      className={`${
        sidebarCollapsed ? "w-16" : "w-64"
      } h-screen sticky top-0 shrink-0 flex flex-col border-r border-white/[0.06] bg-[#0d0d14] transition-all duration-300 ease-in-out relative`}
    >
      {/* Logo Area */}
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <h2 className="text-sm font-semibold text-white tracking-tight">Gateway</h2>
            <p className="text-[10px] text-zinc-500">v1.0.0</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-400"}`} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Connection Status */}
      {!sidebarCollapsed && (
        <div className="p-4 border-t border-white/[0.06]">
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Connection</p>
            <div className="flex items-center gap-2">
              {isGatewayConnected ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-400" />
              )}
              <span className={`text-xs font-medium ${isGatewayConnected ? "text-emerald-400" : "text-rose-400"}`}>
                {isGatewayConnected ? "Online" : "Offline"}
              </span>
              <div className={`ml-auto h-2 w-2 rounded-full ${isGatewayConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            </div>
          </div>
        </div>
      )}

      {/* Provider Status Summary */}
      {!sidebarCollapsed && (
        <div className="px-4 pb-4">
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Providers</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {status?.providers.map((p) => (
                  <div
                    key={p.provider_id}
                    className={`w-5 h-5 rounded-full border-2 border-[#0d0d14] ${
                      !p.enabled
                        ? "bg-zinc-600"
                        : p.status === "healthy"
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`}
                    title={`${p.provider_id}: ${!p.enabled ? "disabled" : p.status}`}
                  />
                ))}
              </div>
              <span className="text-xs text-zinc-400">
                {healthyCount}/{totalProviders} healthy
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-[#1a1a2e] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors z-10"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3 h-3 text-zinc-400" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-zinc-400" />
        )}
      </button>
    </aside>
  );
}
