import { useSIPClient } from "./useSIPClient"
import type { SIPStatus } from "./sipClient"

export function StatusDot({ status }: { status: SIPStatus }) {
  const map: Record<SIPStatus, { color: string; bg: string; border: string; label: string; dot: string }> = {
    online: {
      color: "#15803d",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      label: "● Online",
      dot: "bg-emerald-500",
    },
    offline: {
      color: "#6b7280",
      bg: "#f9fafb",
      border: "#e5e7eb",
      label: "○ Offline",
      dot: "bg-gray-400",
    },
    busy: {
      color: "#b45309",
      bg: "#fffbeb",
      border: "#fde68a",
      label: "◉ On Call",
      dot: "bg-amber-500 animate-pulse",
    },
    registering: {
      color: "#1d4ed8",
      bg: "#eff6ff",
      border: "#bfdbfe",
      label: "◌ Registering…",
      dot: "bg-blue-500 animate-pulse",
    },
  }

  const s = map[status] || map.offline

  return (
    <span
      style={{ color: s.color, fontWeight: 600 }}
      className="inline-flex items-center gap-1.5 text-xs select-none"
    >
      {s.label}
    </span>
  )
}

/**
 * Top header WebRTC SIP Phone badge with quick status and hangup control.
 */
export function WebRTCHeaderBadge() {
  const { sipStatus, hangup, reconnect } = useSIPClient()

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-2 h-8 px-2.5 rounded-control text-xs font-semibold border transition-all ${
          sipStatus === "online"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : sipStatus === "busy"
            ? "bg-amber-50 text-amber-900 border-amber-300 shadow-xs"
            : sipStatus === "registering"
            ? "bg-blue-50 text-blue-800 border-blue-200"
            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 cursor-pointer"
        }`}
        title={
          sipStatus === "offline"
            ? "WebRTC offline. Extension 101 may need WebRTC enabled in HoduPBX admin. Click to retry."
            : sipStatus === "registering"
            ? "Connecting to HoduPBX WSS (wss://ecallpbx.konnectcom.in:7443)…"
            : `WebRTC SIP Phone: ${sipStatus} — Extension 101 (1048101@ecallpbx.konnectcom.in)`
        }
        onClick={() => {
          if (sipStatus === "offline") reconnect()
        }}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            sipStatus === "online"
              ? "bg-emerald-500"
              : sipStatus === "busy"
              ? "bg-amber-500 animate-ping"
              : sipStatus === "registering"
              ? "bg-blue-500 animate-pulse"
              : "bg-slate-400"
          }`}
        />
        <span className="font-medium text-[11px] tracking-wide uppercase opacity-75">WebRTC</span>
        <StatusDot status={sipStatus} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            reconnect()
          }}
          title="Refresh / Reconnect WebRTC SIP Phone"
          className="ml-0.5 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <span className={`text-[10px] inline-block ${sipStatus === "registering" ? "animate-spin" : ""}`}>🔄</span>
        </button>
      </div>

      {sipStatus === "busy" && (
        <button
          onClick={hangup}
          className="h-8 px-2.5 rounded-control text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs flex items-center gap-1.5 animate-pulse"
          title="Hang up current WebRTC call"
        >
          <span>🛑</span>
          <span>End Call</span>
        </button>
      )}
    </div>
  )
}
