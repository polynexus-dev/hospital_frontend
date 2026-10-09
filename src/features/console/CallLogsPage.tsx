import { useState, useRef } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { NeutralTag } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"
import {
  listCalls,
  getIncomingCallHistory,
  getOutgoingCallHistory,
  listActiveCalls,
  operatorProductivity,
  clickToCall,
} from "../../api/telephony"
import { useSIPClient } from "../../telephony/useSIPClient"
import { showToast } from "../../components/ui/Toast"
import { extractApiError } from "../../api/client"
import { StatusDot } from "../../telephony/SIPStatusDot"
import type { Call, CallDirection, CallStatus, CallHistorySummary } from "../../types/api"

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDuration(seconds: number) {
  if (!seconds) return "—"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function fmtTime(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const STATUS_COLORS: Record<CallStatus, { bg: string; text: string; dot: string }> = {
  answered:  { bg: "bg-emerald-50",  text: "text-emerald-700",  dot: "bg-emerald-500" },
  missed:    { bg: "bg-red-50",      text: "text-red-600",      dot: "bg-red-500" },
  rnr:       { bg: "bg-amber-50",    text: "text-amber-700",    dot: "bg-amber-400" },
  busy:      { bg: "bg-orange-50",   text: "text-orange-700",   dot: "bg-orange-400" },
  failed:    { bg: "bg-rose-50",     text: "text-rose-700",     dot: "bg-rose-500" },
  voicemail: { bg: "bg-indigo-50",   text: "text-indigo-700",   dot: "bg-indigo-400" },
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: CallStatus }) {
  const c = STATUS_COLORS[status] ?? { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" }
  const labels: Record<CallStatus, string> = {
    answered: "Answered", missed: "Missed", rnr: "RNR", busy: "Busy", failed: "Failed", voicemail: "Voicemail",
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {labels[status] ?? status}
    </span>
  )
}

function DirectionBadge({ dir }: { dir: CallDirection }) {
  const isInbound = dir === "inbound"
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border shadow-2xs ${
        isInbound
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-violet-50 text-violet-700 border-violet-200"
      }`}
    >
      <span className="text-[12px]">{isInbound ? "📲" : "📞"}</span>
      <span>{isInbound ? "Inbound" : "Outgoing"}</span>
    </span>
  )
}

function AudioPlayer({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLAudioElement>(null)
  return (
    <div className="mt-2">
      {open ? (
        <audio
          ref={ref}
          controls
          autoPlay
          src={url}
          className="w-full h-8 rounded"
          style={{ accentColor: "#6366f1" }}
        />
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <span className="text-[14px]">▶</span> Play recording
        </button>
      )}
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-ink-4 mb-0.5">{label}</div>
      <div className={`text-[12.5px] text-ink-2 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  )
}

// ─── click-to-call button ─────────────────────────────────────────────────────

function ClickToCallButton({ toNumber, size = "sm" }: { toNumber: string; size?: "sm" | "md" }) {
  const [feedback, setFeedback] = useState<"idle" | "ok" | "err">("idle")
  const { isOnCall } = useSIPClient()

  const dial = useMutation({
    mutationFn: () => clickToCall(toNumber),
    onSuccess: () => {
      setFeedback("ok")
      showToast(`Initiating call to ${toNumber}... Please wait for PBX bridge.`, "success")
      setTimeout(() => setFeedback("idle"), 3000)
    },
    onError: (err: unknown) => {
      setFeedback("err")
      const msg = extractApiError(err, "Failed to initiate call.")
      showToast(msg, "error")
      setTimeout(() => setFeedback("idle"), 3000)
    },
  })

  const isPending = dial.isPending

  const base =
    size === "md"
      ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control font-semibold text-[12.5px] border transition-all"
      : "inline-flex items-center gap-1 px-2 py-1 rounded-tag font-semibold text-[11px] border transition-all"

  if (feedback === "ok")
    return (
      <span className={`${base} bg-emerald-50 border-emerald-300 text-emerald-700`}>
        ✓ Connecting…
      </span>
    )
  if (feedback === "err")
    return (
      <span className={`${base} bg-red-50 border-red-300 text-red-600`}>
        ✗ Failed
      </span>
    )

  return (
    <button
      disabled={isPending || isOnCall}
      onClick={(e) => {
        e.stopPropagation() // don't toggle the row expand
        if (isOnCall) return
        dial.mutate()
      }}
      title={
        isOnCall
          ? "You are currently on an active call. Hang up first before placing another call."
          : `Click to call ${toNumber}`
      }
      className={`${base} ${
        isOnCall
          ? "bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
          : "bg-white border-border-strong text-ink-2 hover:bg-brand hover:border-brand hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
      }`}
    >
      {isPending ? (
        <span className="animate-spin text-[10px]">⏳</span>
      ) : (
        <span>📞</span>
      )}
      {isPending ? "Dialling…" : isOnCall ? "On Call" : toNumber}
    </button>
  )
}

// ─── call row ─────────────────────────────────────────────────────────────────

function CallRow({ call, expanded, onToggle }: {
  call: Call
  expanded: boolean
  onToggle: () => void
}) {
  // For outbound calls: call back the destination (to_number)
  // For inbound calls: call back the caller (from_number)
  const callbackNumber = call.direction === "outbound" ? call.to_number : call.from_number
  return (
    <div
      className={`border-b border-border-faint last:border-0 transition-colors ${expanded ? "bg-indigo-50/30" : "hover:bg-page/60"}`}
    >
      {/* ── main row ── */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3.5"
      >
        {/* Call Type */}
        <div className="shrink-0 w-24">
          <DirectionBadge dir={call.direction} />
        </div>

        {/* From -> To and Metadata */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold font-mono text-ink-1">
              {call.from_number}
            </span>
            <span className="text-ink-4 text-[11px] font-bold">→</span>
            <span className="text-[13px] font-semibold font-mono text-ink-2">
              {call.to_number}
            </span>
            {call.patient_name && (
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                👤 {call.patient_name}
              </span>
            )}
            {call.department_name && (
              <span className="text-[11px] text-ink-4 font-medium">
                🏢 {call.department_name}
              </span>
            )}
            {(call.call_reason_display || call.call_reason) && (
              <NeutralTag>{call.call_reason_display || call.call_reason}</NeutralTag>
            )}
          </div>

          <div className="text-[11px] text-ink-5 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{fmtTime(call.started_at)}</span>
            {call.operator_name ? (
              <span>· Op: {call.operator_name}</span>
            ) : call.operator ? (
              <span>· Op #{call.operator}</span>
            ) : null}
            {call.provider_call_id && !call.provider_call_id.startsWith("pending-") && (
              <span className="font-mono text-ink-5 opacity-50 truncate max-w-[140px]">
                · {call.provider_call_id}
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0 w-24 text-center">
          <StatusPill status={call.status} />
        </div>

        {/* Duration */}
        <div className="shrink-0 w-16 text-right font-mono text-[12px] text-ink-3">
          {fmtDuration(call.duration_seconds)}
        </div>

        {/* Click to Call Action */}
        <div className="shrink-0 pl-1" onClick={(e) => e.stopPropagation()}>
          <ClickToCallButton toNumber={callbackNumber} />
        </div>

        {/* Expand Chevron */}
        <span className={`text-ink-4 text-[12px] shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}>
          ▸
        </span>
      </button>

      {/* ── expanded detail ── */}
      {expanded && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] border-t border-border-faint bg-white/60">
          <div className="col-span-2 pt-3 font-semibold text-[11px] uppercase tracking-widest text-ink-4 mb-1">
            Call Detail
          </div>
          <Detail
            label="Call Type"
            value={
              <span className={`font-semibold ${call.direction === "inbound" ? "text-blue-600" : "text-violet-600"}`}>
                {call.direction === "inbound" ? "📲 Inbound Call (Patient called hospital)" : "📞 Outgoing Call (Staff dialed patient)"}
              </span>
            }
          />
          <Detail label="Status" value={<StatusPill status={call.status} />} />
          <Detail label={call.direction === "inbound" ? "Caller (Patient Phone)" : "Calling From (PBX / Ext)"} value={call.from_number} mono />
          <Detail label={call.direction === "inbound" ? "Received on Extension" : "Recipient (Patient Phone)"} value={call.to_number} mono />
          {call.patient_name && (
            <Detail label="Patient" value={`👤 ${call.patient_name} (ID #${call.patient})`} />
          )}
          {call.department_name && (
            <Detail label="Department" value={`🏢 ${call.department_name}`} />
          )}
          {call.operator_name && (
            <Detail label="Operator / Staff" value={`🎧 ${call.operator_name} (ID #${call.operator})`} />
          )}
          <Detail label="Started" value={fmtTime(call.started_at)} />
          <Detail label="Answered" value={call.answered_at ? fmtTime(call.answered_at) : "—"} />
          <Detail label="Ended" value={call.ended_at ? fmtTime(call.ended_at) : "—"} />
          <Detail label="Duration" value={fmtDuration(call.duration_seconds)} />
          <Detail label="Reason" value={call.call_reason_display || call.call_reason || "—"} />
          <Detail label="IVR Path" value={call.ivr_path || "—"} />
          <Detail label="Provider" value={call.provider_name || "HoduPBX"} />
          <Detail label="Call ID" value={call.provider_call_id || "—"} mono />
          {call.notes && (
            <div className="col-span-2 border-t border-border-faint pt-2 mt-1">
              <span className="text-ink-4 text-[11px] uppercase tracking-wider">Notes</span>
              <p className="mt-1 text-[12.5px] text-ink-2 leading-relaxed">{call.notes}</p>
            </div>
          )}
          {call.recording_url && (
            <div className="col-span-2 border-t border-border-faint pt-2 mt-1">
              <span className="text-ink-4 text-[11px] uppercase tracking-wider">Recording</span>
              <AudioPlayer url={call.recording_url} />
            </div>
          )}
          {/* ── click-to-call action ── */}
          <div className="col-span-2 border-t border-border-faint pt-3 mt-1">
            <div className="text-[10.5px] uppercase tracking-wider text-ink-4 mb-2">Click-to-Call</div>
            <div className="flex items-center gap-3 flex-wrap">
              <ClickToCallButton toNumber={call.from_number} size="md" />
              {call.to_number && call.to_number !== call.from_number && (
                <ClickToCallButton toNumber={call.to_number} size="md" />
              )}
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-3 pt-2 border-t border-border-faint mt-1">
            <span className={`flex items-center gap-1 text-[11.5px] ${call.consent_recorded ? "text-emerald-600" : "text-ink-4"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${call.consent_recorded ? "bg-emerald-500" : "bg-border-strong"}`} />
              {call.consent_recorded ? "Consent recorded" : "No consent on file"}
            </span>
            <span className={`flex items-center gap-1 text-[11.5px] ${call.recording_url ? "text-emerald-600" : "text-ink-4"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${call.recording_url ? "bg-emerald-500" : "bg-border-strong"}`} />
              {call.recording_url ? "Recording available" : "No recording"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

const DIRECTIONS: { label: string; value: string }[] = [
  { label: "All Calls", value: "" },
  { label: "📲 Incoming History", value: "inbound" },
  { label: "📞 Outgoing History", value: "outbound" },
]

const STATUSES: { label: string; value: string }[] = [
  { label: "All statuses", value: "" },
  { label: "✅ Answered", value: "answered" },
  { label: "❌ Missed", value: "missed" },
  { label: "📵 RNR", value: "rnr" },
  { label: "📳 Busy", value: "busy" },
  { label: "⚠️ Failed", value: "failed" },
]

export function CallLogsPage() {
  const [direction, setDirection] = useState("")
  const [status, setStatus] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<number | string | null>(null)
  const [page, setPage] = useState(1)
  const [quickDial, setQuickDial] = useState("")
  const [qdFeedback, setQdFeedback] = useState<"idle" | "ok" | "err">("idle")
  const { sipStatus, hangup, reconnect, autoDetect, autoTryStatus, testMic, isOnCall } = useSIPClient()

  const PAGE_SIZE = 20

  const params: Record<string, string> = {
    page: String(page),
    page_size: String(PAGE_SIZE),
  }
  if (status) params.status = status
  if (search.trim()) params.search = search.trim()
  if (startDate) params.start = startDate
  if (endDate) params.end = endDate
  if (startDate && !endDate) params.started_at__date = startDate
  if (!direction) {
    params.ordering = "-started_at"
  }

  const callsQuery = useQuery({
    queryKey: ["calls", "logs", direction, params],
    queryFn: async () => {
      if (direction === "inbound") {
        return getIncomingCallHistory(params)
      } else if (direction === "outbound") {
        return getOutgoingCallHistory(params)
      }
      return listCalls(params)
    },
    placeholderData: (prev) => prev,
  })

  const activeCallsQuery = useQuery({
    queryKey: ["calls", "active"],
    queryFn: listActiveCalls,
    refetchInterval: 10_000,
  })

  const productivityQuery = useQuery({
    queryKey: ["calls", "operator-productivity", "today"],
    queryFn: () => operatorProductivity({ start: todayIso() }),
  })

  const inboundCountQuery = useQuery({
    queryKey: ["calls", "count", "inbound", todayIso()],
    queryFn: () => getIncomingCallHistory({ start: todayIso(), end: todayIso(), page_size: "1" }),
    refetchInterval: 15_000,
  })

  const outboundCountQuery = useQuery({
    queryKey: ["calls", "count", "outbound", todayIso()],
    queryFn: () => getOutgoingCallHistory({ start: todayIso(), end: todayIso(), page_size: "1" }),
    refetchInterval: 15_000,
  })

  const calls = callsQuery.data?.results ?? []
  const totalCount = callsQuery.data?.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const activeCalls = activeCallsQuery.data ?? []
  const summary: CallHistorySummary | undefined = (callsQuery.data as any)?.summary

  const inboundToday = inboundCountQuery.data?.summary?.total_calls ?? inboundCountQuery.data?.count ?? 0
  const outboundToday = outboundCountQuery.data?.summary?.total_calls ?? outboundCountQuery.data?.count ?? 0

  const allStats = productivityQuery.data ?? []
  const totals = allStats.reduce(
    (acc, r) => ({
      calls_handled: acc.calls_handled + r.calls_handled,
      answered: acc.answered + r.answered,
      missed: acc.missed + r.missed,
    }),
    { calls_handled: 0, answered: 0, missed: 0 }
  )

  // ── derive unique numbers from current page for quick-dial list ──
  const seenNums = new Set<string>()
  const uniqueNumbers: { number: string; name: string; lastSeen: string; direction: CallDirection }[] = []
  for (const c of calls) {
    const nums = [
      { num: c.from_number, dir: c.direction },
      { num: c.to_number, dir: c.direction },
    ].filter((item) => Boolean(item.num))
    for (const item of nums) {
      if (!seenNums.has(item.num)) {
        seenNums.add(item.num)
        uniqueNumbers.push({
          number: item.num,
          name: c.patient_name || c.call_reason_display || c.call_reason || "",
          lastSeen: c.started_at,
          direction: item.dir,
        })
      }
    }
  }

  const qdMutation = useMutation({
    mutationFn: () => clickToCall(quickDial.trim()),
    onSuccess: () => {
      setQdFeedback("ok")
      setTimeout(() => setQdFeedback("idle"), 3000)
    },
    onError: () => {
      setQdFeedback("err")
      setTimeout(() => setQdFeedback("idle"), 3000)
    },
  })

  function toggleRow(id: number | string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-4 pb-28">
      {/* ── page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink-1">
            {direction === "inbound"
              ? "Incoming Call History"
              : direction === "outbound"
              ? "Outgoing Call History"
              : "Call Logs"}
          </h1>
          <p className="text-[13px] text-ink-4 mt-0.5">
            {direction === "inbound"
              ? "Inbound customer & patient calls with talk duration and recordings"
              : direction === "outbound"
              ? "Outbound Click2Call dials with connected status and talk duration"
              : "Full call history · HoduPBX Telephony"}
            {totalCount > 0 ? ` · ${totalCount} records` : ""}
          </p>
        </div>
        {callsQuery.isFetching && (
          <span className="text-[12px] text-ink-4 animate-pulse">Refreshing…</span>
        )}
      </div>

      {/* ── live active calls banner ── */}
      {activeCalls.length > 0 && (
        <div className="rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-[12px] font-semibold text-emerald-700 mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            {activeCalls.length} Live Call{activeCalls.length > 1 ? "s" : ""} in Progress
            <span className="text-[10.5px] font-normal text-emerald-500 ml-1">· auto-refreshes every 10s</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeCalls.map((c, i) => {
              const isOutbound = c.direction === "outbound" || (c.caller && (c.caller.length <= 4 || c.caller.startsWith("10")))
              return (
                <div
                  key={i}
                  className="bg-white border border-emerald-200 rounded-control px-3 py-1.5 flex items-center gap-2 text-[12.5px] shadow-sm"
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isOutbound ? "bg-violet-100 text-violet-700 border border-violet-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
                    {isOutbound ? "📞 Outgoing" : "📲 Inbound"}
                  </span>
                  <span className="text-emerald-600 font-semibold font-mono">{c.caller}</span>
                  <span className="text-ink-4 text-[11px]">→</span>
                  <span className="font-mono text-ink-2">{c.callee}</span>
                  <span className="text-[11px] text-ink-4 ml-1">⏱ {c.duration}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── summary / today stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card padded>
          <div className="text-[26px] font-bold tracking-tight text-ink-1">
            {summary ? summary.total_calls : totals.calls_handled}
          </div>
          <div className="text-[11.5px] text-ink-4 mt-0.5">
            {direction === "inbound"
              ? "Total Incoming Calls"
              : direction === "outbound"
              ? "Total Outgoing Calls"
              : "Total calls today"}
          </div>
        </Card>
        <Card padded>
          <div className="text-[26px] font-bold tracking-tight text-emerald-600">
            {summary ? summary.answered : totals.answered}
          </div>
          <div className="text-[11.5px] text-ink-4 mt-0.5">Answered</div>
        </Card>
        <Card padded>
          <div className="text-[26px] font-bold tracking-tight text-red-500">
            {summary ? summary.missed : totals.missed}
          </div>
          <div className="text-[11.5px] text-ink-4 mt-0.5">Missed Calls</div>
        </Card>
        <Card padded>
          <div className="text-[26px] font-bold tracking-tight text-amber-600">
            {summary ? summary.rnr : (direction === "inbound" ? inboundToday : direction === "outbound" ? outboundToday : totals.missed)}
          </div>
          <div className="text-[11.5px] text-ink-4 mt-0.5">
            {summary ? "Ring No Response (RNR)" : (direction === "inbound" ? "Inbound Today" : "Outgoing Today")}
          </div>
        </Card>
        <Card padded>
          <div className="text-[26px] font-bold tracking-tight text-indigo-600">
            {summary
              ? fmtDuration(Math.round(summary.avg_duration_seconds))
              : fmtDuration(totals.calls_handled > 0 ? Math.round((totals.answered * 120) / totals.calls_handled) : 0)}
          </div>
          <div className="text-[11.5px] text-ink-4 mt-0.5">Avg Talk Time</div>
        </Card>
      </div>

      {/* ── main two-column layout ── */}
      <div className="grid grid-cols-[260px_1fr] gap-4 items-start">

        {/* ╔══════════════════════════════╗
            ║       QUICK DIAL PANEL       ║
            ╚══════════════════════════════╝ */}
        <div className="flex flex-col gap-3 sticky top-4">
          <Card>
            <div className="px-3.5 py-2.5 border-b border-border-soft flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest font-semibold text-ink-3">📞 Quick Dial</div>
                <div className="text-[11px] text-ink-5 mt-0.5">Browser WebRTC Phone</div>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot status={sipStatus} />
                <button
                  type="button"
                  onClick={() => reconnect()}
                  title="Refresh / Reconnect WebRTC Phone"
                  className="w-6 h-6 rounded flex items-center justify-center text-ink-4 hover:text-ink-1 hover:bg-page transition-colors cursor-pointer border border-border-soft text-[11px]"
                >
                  <span className={sipStatus === "registering" ? "animate-spin inline-block" : ""}>🔄</span>
                </button>
              </div>
            </div>

            {/* Offline notification banner with quick Reconnect action */}
            {sipStatus === "offline" && (
              <div className="px-3.5 py-2 bg-slate-50 border-b border-border-soft flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-ink-4">Phone disconnected</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => reconnect()}
                      className="px-2 py-0.5 rounded bg-brand text-white text-[11px] font-semibold hover:bg-brand/90 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>🔄</span>
                      <span>Connect</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => autoDetect()}
                      title="Test all PBX domain/auth combinations"
                      className="px-2 py-0.5 rounded bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>🔍</span>
                      <span>Auto-Detect</span>
                    </button>
                  </div>
                </div>
                {autoTryStatus && (
                  <div className="text-[10px] text-violet-700 font-mono bg-violet-50 p-1.5 rounded border border-violet-200">
                    {autoTryStatus}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-border-faint text-[10.5px]">
                  <button
                    type="button"
                    onClick={() => testMic()}
                    className="text-brand hover:underline cursor-pointer"
                  >
                    🎙️ Test Mic
                  </button>
                  <a
                    href="/webrtc-sip-phone.html"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    ↗️ Open Softphone HTML
                  </a>
                </div>
              </div>
            )}

            {/* In-Call WebRTC Banner */}
            {sipStatus === "busy" && (
              <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                <span className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Call Active
                </span>
                <button
                  onClick={hangup}
                  className="px-2 py-0.5 rounded text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Hang Up
                </button>
              </div>
            )}

            {/* custom number input */}
            <div className="px-3.5 py-3 border-b border-border-faint">
              <input
                value={quickDial}
                onChange={(e) => setQuickDial(e.target.value.replace(/[^0-9+\-() ]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && quickDial.trim().length >= 6) qdMutation.mutate()
                }}
                placeholder="Enter number…"
                maxLength={15}
                className="w-full h-9 px-3 border border-border-strong rounded-control text-[14px] font-mono outline-none focus:border-brand mb-2"
              />
              <button
                disabled={quickDial.trim().length < 6 || qdMutation.isPending || isOnCall}
                onClick={() => {
                  if (isOnCall) return
                  qdMutation.mutate()
                }}
                title={isOnCall ? "You are on an active call. Hang up first before calling another number." : undefined}
                className={`w-full py-2 rounded-control text-[13px] font-semibold transition-all ${
                  isOnCall
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300"
                    : qdFeedback === "ok"
                    ? "bg-emerald-500 text-white border border-emerald-500"
                    : qdFeedback === "err"
                    ? "bg-red-500 text-white border border-red-500"
                    : "bg-brand text-white hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {isOnCall
                  ? "🔴 On Call — Cannot Dial"
                  : qdMutation.isPending
                  ? "⏳ Dialling…"
                  : qdFeedback === "ok"
                  ? "✓ Connecting…"
                  : qdFeedback === "err"
                  ? "✗ Call Failed"
                  : "📞 Call"}
              </button>
            </div>

            {/* number list */}
            <div>
              <div className="px-3.5 py-2 text-[10.5px] uppercase tracking-widest font-semibold text-ink-4 border-b border-border-faint">
                Numbers from log
              </div>
              {uniqueNumbers.length === 0 && !callsQuery.isLoading && (
                <div className="px-3.5 py-4 text-[12px] text-ink-4">No records yet.</div>
              )}
              <div className="max-h-[420px] overflow-y-auto">
                {uniqueNumbers.map((item) => (
                  <div
                    key={item.number}
                    className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border-faint last:border-0 hover:bg-page group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] opacity-75 shrink-0" title={item.direction === "inbound" ? "Inbound caller" : "Outgoing callee"}>
                          {item.direction === "inbound" ? "📲" : "📞"}
                        </span>
                        <span className="text-[13px] font-mono font-semibold text-ink-1 truncate">
                          {item.number}
                        </span>
                      </div>
                      {item.name && (
                        <div className="text-[10.5px] text-ink-4 truncate pl-4.5">{item.name}</div>
                      )}
                    </div>
                    <ClickToCallButton toNumber={item.number} />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ╔══════════════════════════════╗
            ║      FILTER + TABLE          ║
            ╚══════════════════════════════╝ */}
        <Card>
        <div className="px-4 py-3 flex flex-wrap gap-3 items-center border-b border-border-soft">
          {/* direction toggle */}
          <div className="flex rounded-control overflow-hidden border border-border-strong">
            {DIRECTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => { setDirection(d.value); setPage(1) }}
                className={`px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  direction === d.value
                    ? "bg-brand text-white"
                    : "bg-white text-ink-3 hover:bg-page"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* status */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] text-ink-2 outline-none focus:border-brand bg-white"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* date range */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[11px] text-ink-4 font-semibold">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
              className="h-8 px-2 border border-border-strong rounded-control text-[12px] outline-none focus:border-brand"
            />
            <span className="text-[11px] text-ink-4 font-semibold ml-1">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
              className="h-8 px-2 border border-border-strong rounded-control text-[12px] outline-none focus:border-brand"
            />
          </div>

          {/* search */}
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search number / reason…"
            className="h-8 flex-1 min-w-[180px] px-3 border border-border-strong rounded-control text-[12.5px] font-mono outline-none focus:border-brand"
          />

          {(direction || status || startDate || endDate || search) && (
            <button
              onClick={() => { setDirection(""); setStatus(""); setStartDate(""); setEndDate(""); setSearch(""); setPage(1) }}
              className="text-[12px] text-ink-4 hover:text-ink-2 underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* column header */}
        <div className="hidden sm:flex items-center gap-3.5 px-4 py-2 bg-page text-[10.5px] uppercase tracking-wider text-ink-4 font-semibold border-b border-border-faint">
          <div className="shrink-0 w-24">Call Type</div>
          <div className="flex-1 min-w-0">From → To · Details</div>
          <div className="shrink-0 w-24 text-center">Status</div>
          <div className="shrink-0 w-16 text-right">Duration</div>
          <div className="shrink-0 w-28 text-center">Action</div>
          <div className="w-3 shrink-0" />
        </div>

        {callsQuery.isLoading && <LoadingState />}

        {!callsQuery.isLoading && calls.length === 0 && (
          <div className="px-4 py-10 text-center">
            <div className="text-[32px] mb-2">📋</div>
            <div className="text-[13px] text-ink-3 font-semibold">No call records found</div>
            <div className="text-[12px] text-ink-4 mt-1">Try adjusting your filters or date range.</div>
          </div>
        )}

        {calls.map((call) => (
          <CallRow
            key={call.id}
            call={call}
            expanded={expandedId === call.id}
            onToggle={() => toggleRow(call.id)}
          />
        ))}

        {/* pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border-soft flex items-center justify-between">
            <span className="text-[12px] text-ink-4">
              Page {page} of {totalPages} · {totalCount} total records
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-[12px] font-semibold border border-border-strong rounded-control hover:bg-page disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-[12px] font-semibold border border-border-strong rounded-control hover:bg-page disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </Card>
      </div>{/* end two-column grid */}
    </div>
  )
}
