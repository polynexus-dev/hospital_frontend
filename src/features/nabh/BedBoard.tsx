import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"

interface BedCell {
  id: number
  bed_number: string
  room: string
  bed_type: string
  status: string
  patient: string | null
  uhid: string | null
  expected_discharge_date: string | null
}

const colour: Record<string, string> = {
  available: "bg-success-bg border-success/25 dark:bg-emerald-950",
  occupied: "bg-danger-bg border-danger-border dark:bg-rose-950",
  cleaning: "bg-warning-bg border-warning/30 dark:bg-amber-950",
  reserved: "bg-brand-tint border-brand-border dark:bg-sky-950",
  maintenance: "bg-chip-bg border-border-strong dark:bg-slate-800",
}

/** AAC.5.h occupied-bed display + AAC.5.i availability forecast. */
export function BedBoard() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.get("/ipd/bed-board/").then(setData).catch((e) => setError(extractApiError(e)))
  }, [])
  if (error) return <div className="text-sm text-danger-text bg-danger-bg rounded-lg p-3">{error}</div>
  if (!data) return <div className="text-sm text-ink-4">Loading bed board…</div>
  const p = data.prediction
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          ["Total beds", data.summary.total],
          ["Occupied", data.summary.occupied],
          ["Available now", data.summary.available],
          ["Occupancy", `${data.summary.occupancy_pct}%`],
          ["Free in 24 h (forecast)", p.projected_available_24h],
          ["Free in 72 h (forecast)", p.projected_available_72h],
        ].map(([k, v]) => (
          <div key={String(k)} className="bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-3">
            <div className="text-[11px] uppercase text-ink-4">{k}</div>
            <div className="text-xl font-bold text-ink dark:text-slate-100">{String(v)}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-4">Forecast uses expected discharge dates, else the 90-day average length of stay ({p.alos_hours} h).</p>
      {data.wards.map((w: any) => (
        <div key={w.ward} className="bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-4">
          <div className="flex justify-between mb-3">
            <h3 className="font-semibold text-ink dark:text-slate-100">{w.ward}</h3>
            <span className="text-xs text-ink-4">{w.occupied}/{w.total} occupied</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {w.beds.map((b: BedCell) => (
              <div key={b.id} className={`rounded-lg border p-2 text-xs ${colour[b.status] ?? colour.maintenance}`}>
                <div className="font-bold">{b.bed_number} <span className="font-normal text-ink-4">· {b.bed_type}</span></div>
                <div className="truncate">{b.patient ?? b.status}</div>
                {b.expected_discharge_date && <div className="text-ink-4">exp. {b.expected_discharge_date}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
