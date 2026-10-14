import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"

interface CampReport {
  camp: string; days: number; registrations: number; patients: number
  by_date: { date: string; registrations: number }[]; by_doctor: { doctor: string; registrations: number }[]
  camp_bills: number; camp_revenue: string; follow_up_patients: number; follow_up_bills: number; follow_up_admissions: number
  follow_up_opd_revenue: string; follow_up_ipd_revenue: string; total_revenue: string; spend: string; return_on_spend: number | null
}

const inr = (n: number | string) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

/** What a camp brought in: OPD registrations tagged with it and the same patients' later bills. */
export function CampReportModal({ campaignId, onClose }: { campaignId: number; onClose: () => void }) {
  const [days, setDays] = useState(90)
  const [r, setR] = useState<CampReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.get<CampReport>(`/packages/campaigns/${campaignId}/report/?days=${days}`).then(setR).catch((e) => setError(extractApiError(e)))
  }, [campaignId, days])
  const stat = (label: string, value: string | number) => (
    <div className="rounded-lg border border-border dark:border-slate-700 p-3"><div className="text-[11px] uppercase text-ink-4">{label}</div><div className="text-lg font-bold">{value}</div></div>
  )
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 max-w-2xl w-full rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{r?.camp ?? "Camp report"}</h2>
          <label className="text-xs text-ink-3">Follow-up window
            <select className="ml-2 px-2 py-1 border border-border-strong rounded" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[30, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
        </div>
        {error && <div className="text-sm text-danger-text">{error}</div>}
        {r && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {stat("Registrations", r.registrations)}
              {stat("Patients", r.patients)}
              {stat("Camp-day revenue", inr(r.camp_revenue))}
              {stat("Total revenue", inr(r.total_revenue))}
              {stat("Came back", `${r.follow_up_patients} patients`)}
              {stat("Follow-up OPD", inr(r.follow_up_opd_revenue))}
              {stat(`Admissions (${r.follow_up_admissions})`, inr(r.follow_up_ipd_revenue))}
              {stat("Return on spend", r.return_on_spend != null ? `${r.return_on_spend}×` : "No spend logged")}
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[11px] uppercase text-ink-4 mb-1">By day</div>
                {r.by_date.length ? r.by_date.map((d) => <div key={d.date} className="flex justify-between"><span>{d.date}</span><span>{d.registrations}</span></div>) : <div className="text-ink-4">No registrations tagged with this camp yet.</div>}
              </div>
              <div>
                <div className="text-[11px] uppercase text-ink-4 mb-1">By doctor</div>
                {r.by_doctor.map((d) => <div key={d.doctor} className="flex justify-between"><span>{d.doctor}</span><span>{d.registrations}</span></div>)}
              </div>
            </div>
            <p className="text-xs text-ink-4">Counts OPD registrations with this camp chosen at the front desk (any payer). Follow-up revenue is the same patients' later bills within the window, OPD and admissions.</p>
          </>
        )}
        <div className="flex justify-end"><button className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-border-strong" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}
