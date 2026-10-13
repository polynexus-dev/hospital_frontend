import { useSIPClient } from "./useSIPClient"
import type { SIPStatus } from "./sipClient"
import { CONFIG as SIP_CONFIG } from "./sipClient"

export function StatusDot({ status }: { status: SIPStatus }) {
  const map: Record<SIPStatus, { color: string; bg: string; border: string; label: string; dot: string }> = {
    online: {
      color: "#15803d",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      label: "● Online",
      dot: "bg-success",
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
      dot: "bg-warning animate-pulse",
    },
    registering: {
      color: "#1d4ed8",
      bg: "#eff6ff",
      border: "#bfdbfe",
      label: "◌ Registering…",
      dot: "bg-brand animate-pulse",
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
            ? "bg-success-bg text-success-text border-success/30"
            : sipStatus === "busy"
            ? "bg-warning-bg text-warning-text border-warning/40 shadow-xs"
            : sipStatus === "registering"
            ? "bg-accent-tint text-accent border-accent/30"
            : "bg-chip-bg text-chip-text border-border hover:bg-border-faint cursor-pointer"
        }`}
        title={
          sipStatus === "offline"
            ? "Softphone offline. Click to retry (the extension may need WebRTC enabled on the PBX, or the server's WEBRTC_SIP_* settings)."
            : sipStatus === "registering"
            ? `Connecting to ${SIP_CONFIG.wsUrl || "the PBX"}…`
            : `Softphone: ${sipStatus}${SIP_CONFIG.extNumber ? ` — extension ${SIP_CONFIG.extNumber}` : ""}`
        }
        onClick={() => {
          if (sipStatus === "offline") reconnect()
        }}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            sipStatus === "online"
              ? "bg-success"
              : sipStatus === "busy"
              ? "bg-warning animate-ping"
              : sipStatus === "registering"
              ? "bg-brand animate-pulse"
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
          className="h-8 px-2.5 rounded-control text-xs font-bold text-white bg-danger hover:bg-danger transition-colors shadow-xs flex items-center gap-1.5 animate-pulse"
          title="Hang up current WebRTC call"
        >
          <span>🛑</span>
          <span>End Call</span>
        </button>
      )}
    </div>
  )
}
