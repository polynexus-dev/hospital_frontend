import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { extractApiError } from "../../api/client"
import { clickToCall, getMissedOpportunities } from "../../api/telephony"
import { showToast } from "../../components/ui/Toast"
import { LEAD_CLASS, MISSED_OPPORTUNITY } from "./callLabels"

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

function Tile({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="border border-border rounded-lg px-3 py-2">
      <div className="text-[11px] text-ink-4">{label}</div>
      <div className={`text-[20px] font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

/** Call Logs → Missed opportunities: missed calls nobody returned within a
 *  day, and calls where the caller wanted to book but no booking followed
 *  (flagged hourly by backend apps.telephony.opportunities). */
export function MissedOpportunitiesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [start, setStart] = useState(isoDaysAgo(29))
  const [end, setEnd] = useState(isoDaysAgo(0))
  const report = useQuery({
    queryKey: ["calls", "missed-opportunities", start, end],
    queryFn: () => getMissedOpportunities({ start, end }),
    enabled: open,
  })

  if (!open) return null
  const d = report.data
  const s = d?.summary

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-border-strong w-full max-w-[1000px] max-h-[92vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[16px] font-semibold">Missed opportunities</h2>
          <div className="flex items-center gap-2 text-[12.5px]">
            <input type="date" aria-label="From" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 px-2 border border-border-strong rounded-control" />
            <span className="text-ink-4">to</span>
            <input type="date" aria-label="To" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 px-2 border border-border-strong rounded-control" />
            <button type="button" onClick={onClose} aria-label="Close" className="text-ink-4 text-lg ml-1">✕</button>
          </div>
        </div>
        {report.isError && <div className="text-[13px] text-danger-text">{extractApiError(report.error)}</div>}
        {!d && !report.isError && <div className="text-[13px] text-ink-4">Loading…</div>}

        {d && s && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Tile label="Missed opportunities" value={s.missed_opportunities} tone={s.missed_opportunities ? "text-danger-text" : ""} />
              <Tile label="Missed calls never returned" value={s.unreturned} />
              <Tile label="Wanted to book, didn't" value={s.not_booked} />
              <Tile label="Calls analysed by AI" value={s.analysed_calls} />
              <Tile label="Callers who wanted to book" value={s.booking_intent_calls} />
            </div>
            <div className="flex flex-wrap gap-1.5 text-[12.5px]">
              {Object.entries(s.lead_classes).map(([k, n]) => (
                <span key={k} className={`px-2 py-1 rounded ${LEAD_CLASS[k]?.cls ?? "bg-chip-bg"}`}>{LEAD_CLASS[k]?.label ?? k}: <b>{n}</b></span>
              ))}
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <div className="grid grid-cols-[1fr_1.2fr_1.3fr_2.5fr_auto] gap-2.5 px-3 py-2 border-b border-border text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold min-w-[760px]">
                <div>When</div>
                <div>Caller</div>
                <div>Why flagged</div>
                <div>AI summary</div>
                <div />
              </div>
              {d.flagged.map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_1.2fr_1.3fr_2.5fr_auto] gap-2.5 px-3 py-2 border-b border-border-faint text-[12.5px] items-center min-w-[760px]">
                  <div className="text-ink-3">{new Date(c.started_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                  <div>
                    <div className="font-mono">{c.from_number}</div>
                    {c.patient_name && <div className="text-[11.5px] text-ink-4">{c.patient_name}</div>}
                  </div>
                  <div className="text-danger-text font-semibold">{MISSED_OPPORTUNITY[c.missed_opportunity ?? ""] ?? c.missed_opportunity}</div>
                  <div className="text-ink-3 line-clamp-2">{c.ai_summary || c.ivr_path || "—"}</div>
                  <button
                    onClick={() => clickToCall(c.from_number).catch((e) => showToast(extractApiError(e), "error"))}
                    className="h-7 px-2.5 rounded-control border border-brand text-brand text-[12px] font-semibold hover:bg-brand-tint"
                  >
                    Call
                  </button>
                </div>
              ))}
              {d.flagged.length === 0 && <div className="px-3 py-4 text-[12.5px] text-ink-4">Nothing flagged in this period.</div>}
            </div>
            <div className="text-[11.5px] text-ink-4">
              Checked every hour. A missed call is flagged when nobody spoke to that number within 24 hours; a call where the AI heard
              the caller wanting to book is flagged when no appointment or scheduled enquiry followed within 48 hours.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
