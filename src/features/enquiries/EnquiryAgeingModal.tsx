import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"
import { Button } from "../../components/ui/Button"
import { viewRecord } from "../../store/recordViewer"

interface Row {
  id: number
  name: string
  source: string
  stage: string
  department: string
  owner: string
  age_hours: number
  quiet_hours: number
  sla_breached: boolean
  escalation_level: number
  follow_up_date: string | null
  follow_up_overdue: boolean
}

interface Owner {
  owner_id: number | null
  owner: string
  open: number
  untouched: number
  sla_breached: number
  follow_ups_overdue: number
  oldest_hours: number
}

interface Ageing {
  summary: {
    open: number
    untouched: number
    sla_breached: number
    follow_ups_overdue: number
    median_first_response_minutes_30d: number | null
    contacted_within_4h_pct_30d: number | null
  }
  by_age: Record<string, number>
  by_quiet_time: Record<string, number>
  by_owner: Owner[]
  rows: Row[]
  rows_truncated: boolean
}

const AGE_LABELS: Record<string, string> = { under_4h: "< 4 h", "4_24h": "4–24 h", "1_3d": "1–3 days", "3_7d": "3–7 days", "7_30d": "7–30 days", over_30d: "30+ days" }
const QUIET_LABELS: Record<string, string> = { today: "< 1 day", "1_3d": "1–3 days", "3_7d": "3–7 days", over_7d: "7+ days" }

function duration(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${Math.round(hours)} h`
  return `${Math.round(hours / 24)} days`
}

function Tile({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="border border-border rounded-lg px-3 py-2">
      <div className="text-[11px] text-ink-4">{label}</div>
      <div className={`text-[20px] font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

/** Enquiries → Waiting too long: open enquiries by how long they've waited
 *  and how long since anyone touched them, per owner; first-contact response
 *  times; export for the daily huddle. */
export function EnquiryAgeingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [owner, setOwner] = useState("")
  const [source, setSource] = useState("")
  const params = new URLSearchParams()
  if (owner) params.set("assigned_to", owner)
  if (source) params.set("source", source)
  const qs = params.toString()
  const report = useQuery({
    queryKey: ["enquiry-ageing", qs],
    queryFn: () => api.get<Ageing>(`/enquiries/ageing/${qs ? `?${qs}` : ""}`),
    enabled: open,
    refetchInterval: 60_000,
  })
  const [exportError, setExportError] = useState("")
  const download = async (fmt: "csv" | "xlsx") => {
    setExportError("")
    try {
      triggerBlobDownload(await api.getBlob(`/enquiries/ageing/?${qs}${qs ? "&" : ""}export=${fmt}`), `enquiry-ageing.${fmt}`)
    } catch (e) {
      setExportError(extractApiError(e))
    }
  }

  if (!open) return null
  const d = report.data
  const s = d?.summary

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-border-strong w-full max-w-[1100px] max-h-[92vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[16px] font-semibold">Enquiries waiting too long</h2>
          <div className="flex items-center gap-2">
            <select aria-label="Owner" className="h-8 px-2 border border-border-strong rounded-control text-[12.5px]" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Everyone</option>
              <option value="none">Unassigned</option>
              {(d?.by_owner ?? []).filter((o) => o.owner_id).map((o) => <option key={o.owner_id} value={o.owner_id!}>{o.owner}</option>)}
            </select>
            <select aria-label="Source" className="h-8 px-2 border border-border-strong rounded-control text-[12.5px]" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All sources</option>
              {["ivr", "whatsapp", "website", "walk_in", "referral", "google", "meta", "other"].map((src) => <option key={src} value={src}>{src.replace("_", " ")}</option>)}
            </select>
            <Button size="sm" variant="secondary" onClick={() => void download("xlsx")}>Excel</Button>
            <Button size="sm" variant="secondary" onClick={() => void download("csv")}>CSV</Button>
            <button type="button" onClick={onClose} aria-label="Close" className="text-ink-4 text-lg ml-1">✕</button>
          </div>
        </div>
        {(report.isError || exportError) && <div className="text-[13px] text-danger-text">{exportError || extractApiError(report.error)}</div>}
        {!d && !report.isError && <div className="text-[13px] text-ink-4">Loading…</div>}

        {d && s && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Tile label="Open enquiries" value={s.open} />
              <Tile label="Not contacted yet" value={s.untouched} />
              <Tile label="First contact overdue" value={s.sla_breached} tone={s.sla_breached ? "text-danger-text" : ""} />
              <Tile label="Follow-ups overdue" value={s.follow_ups_overdue} tone={s.follow_ups_overdue ? "text-warning-text" : ""} />
              <Tile label="Median first response (30 d)" value={s.median_first_response_minutes_30d === null ? "—" : duration(s.median_first_response_minutes_30d / 60)} />
              <Tile label="Contacted within 4 h (30 d)" value={s.contacted_within_4h_pct_30d === null ? "—" : `${s.contacted_within_4h_pct_30d}%`} />
            </div>

            <div className="grid md:grid-cols-2 gap-3 text-[12.5px]">
              <div>
                <div className="font-semibold mb-1">How long they've been open</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(d.by_age).map(([k, n]) => <span key={k} className="px-2 py-1 rounded bg-chip-bg">{AGE_LABELS[k]}: <b>{n}</b></span>)}
                </div>
              </div>
              <div>
                <div className="font-semibold mb-1">Time since anyone touched them</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(d.by_quiet_time).map(([k, n]) => <span key={k} className={`px-2 py-1 rounded ${k === "over_7d" && n ? "bg-danger-bg text-danger-text" : "bg-chip-bg"}`}>{QUIET_LABELS[k]}: <b>{n}</b></span>)}
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-[13px] mb-1">By owner</div>
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-[11px] uppercase text-ink-4"><tr><th className="py-1">Owner</th><th>Open</th><th>Not contacted</th><th>First contact overdue</th><th>Follow-ups overdue</th><th>Oldest</th></tr></thead>
                <tbody>
                  {d.by_owner.map((o) => (
                    <tr key={o.owner_id ?? 0} className="border-t border-border">
                      <td className="py-1.5">{o.owner}</td><td>{o.open}</td><td>{o.untouched}</td>
                      <td className={o.sla_breached ? "text-danger-text font-semibold" : ""}>{o.sla_breached}</td>
                      <td className={o.follow_ups_overdue ? "text-warning-text font-semibold" : ""}>{o.follow_ups_overdue}</td>
                      <td>{duration(o.oldest_hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="font-semibold text-[13px] mb-1">Most urgent first {d.rows_truncated && <span className="text-ink-4 font-normal">(first 300; export for all)</span>}</div>
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-[11px] uppercase text-ink-4">
                  <tr><th className="py-1">#</th><th>Name</th><th>Source</th><th>Stage</th><th>Owner</th><th>Open for</th><th>Quiet for</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.id} onClick={(ev) => viewRecord(ev, r, { subtitle: "Enquiry" })} title="Click to view details" className="border-t border-border align-top cursor-pointer">
                      <td className="py-1.5">{r.id}</td>
                      <td>{r.name}</td>
                      <td>{r.source.replace("_", " ")}</td>
                      <td>{r.stage.replace("_", " ")}</td>
                      <td>{r.owner}</td>
                      <td>{duration(r.age_hours)}</td>
                      <td>{duration(r.quiet_hours)}</td>
                      <td className="space-x-1">
                        {r.sla_breached && <span className="px-1.5 rounded bg-danger-bg text-danger-text">First contact overdue</span>}
                        {r.escalation_level > 0 && <span className="px-1.5 rounded bg-warning-bg text-warning-text">Escalated{r.escalation_level > 1 ? " to manager" : ""}</span>}
                        {r.follow_up_overdue && <span className="px-1.5 rounded bg-warning-bg text-warning-text">Follow-up was {r.follow_up_date}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.rows.length === 0 && <p className="text-[12.5px] text-ink-4 py-2">Nothing waiting. 🎉</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
