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
  available: "bg-emerald-50 border-emerald-300 dark:bg-emerald-950",
  occupied: "bg-rose-50 border-rose-300 dark:bg-rose-950",
  cleaning: "bg-amber-50 border-amber-300 dark:bg-amber-950",
  reserved: "bg-sky-50 border-sky-300 dark:bg-sky-950",
  maintenance: "bg-slate-100 border-slate-300 dark:bg-slate-800",
}

/** AAC.5.h occupied-bed display + AAC.5.i availability forecast. */
export function BedBoard() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.get("/ipd/bed-board/").then(setData).catch((e) => setError(extractApiError(e)))
  }, [])
  if (error) return <div className="text-sm text-rose-700 bg-rose-50 rounded-lg p-3">{error}</div>
  if (!data) return <div className="text-sm text-slate-500">Loading bed board…</div>
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
          <div key={String(k)} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
            <div className="text-[11px] uppercase text-slate-500">{k}</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{String(v)}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Forecast uses expected discharge dates, else the 90-day average length of stay ({p.alos_hours} h).</p>
      {data.wards.map((w: any) => (
        <div key={w.ward} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex justify-between mb-3">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{w.ward}</h3>
            <span className="text-xs text-slate-500">{w.occupied}/{w.total} occupied</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {w.beds.map((b: BedCell) => (
              <div key={b.id} className={`rounded-lg border p-2 text-xs ${colour[b.status] ?? colour.maintenance}`}>
                <div className="font-bold">{b.bed_number} <span className="font-normal text-slate-500">· {b.bed_type}</span></div>
                <div className="truncate">{b.patient ?? b.status}</div>
                {b.expected_discharge_date && <div className="text-slate-500">exp. {b.expected_discharge_date}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
