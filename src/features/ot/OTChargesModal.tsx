import { useEffect, useState } from "react"
import { extractApiError } from "../../api/client"
import { postOTCharges, previewOTCharges } from "../../api/ot"
import type { OTCharges, OTSchedule } from "../../types/api"

// OT tariff charges for one surgery: grade x room category -> surgeon,
// anaesthetist, assistant and OT lines. Re-posting replaces, never doubles.

const inr = (n: number | string | null | undefined) => (n === null || n === undefined ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`)
const ROOM: Record<string, string> = { "": "Any room / day care", general: "General", semi_private: "Semi-private", private: "Private", icu: "ICU", ventilator: "Ventilator" }

export function OTChargesModal({ schedule, onClose, onPosted }: { schedule: OTSchedule; onClose: () => void; onPosted: () => void }) {
  const [data, setData] = useState<OTCharges | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState(false)

  useEffect(() => { previewOTCharges(schedule.id).then(setData).catch((e) => setError(extractApiError(e))) }, [schedule.id])

  const post = async () => {
    setBusy(true)
    setError(null)
    try {
      setData(await postOTCharges(schedule.id))
      setPosted(true)
      onPosted()
    } catch (e) {
      setError(extractApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const cancelled = schedule.status === "cancelled"
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-lg w-full rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-ink dark:text-slate-100">OT charges</h2>
          <p className="text-sm text-ink-4">
            {data?.grade ?? "No grade"} · {ROOM[data?.room_category ?? ""] ?? data?.room_category}
            {schedule.charges_posted_at && !posted ? ` · last posted ${new Date(schedule.charges_posted_at).toLocaleString()}` : ""}
          </p>
        </div>
        {data?.problem && <div className="text-sm text-warning-text bg-warning-bg rounded-lg px-3 py-2">{data.problem}</div>}
        {data && data.lines.length > 0 && (
          <div className="text-sm space-y-1">
            {data.lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3"><span className="text-ink-2 dark:text-slate-200">{l.description}</span><span>{inr(l.amount)}</span></div>
            ))}
            <div className="flex justify-between font-semibold pt-1.5 border-t border-border-soft dark:border-slate-700"><span>Total</span><span>{inr(data.total)}</span></div>
          </div>
        )}
        {posted && data?.bill_number && <div className="text-sm text-success-text">Posted to bill {data.bill_number} (bill total {inr(data.bill_net_amount)}).</div>}
        {error && <div className="text-sm text-danger-text">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-ink-4">Close</button>
          {!cancelled && (
            <button type="button" disabled={busy || !data || !!data.problem} onClick={post} className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg disabled:opacity-50">
              {busy ? "Posting…" : schedule.charges_posted_at || posted ? "Re-post to bill" : "Post to bill"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
