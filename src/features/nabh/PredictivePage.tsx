import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { StatusPill } from "../../components/resource/ResourceTable"

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.get<T>(url).then(setData).catch((e) => setError(extractApiError(e)))
  }, [url])
  return { data, error }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Forecast({ url, title }: { url: string; title: string }) {
  const { data, error } = useFetch<any>(url)
  if (error) return <Card title={title}><div className="text-xs text-rose-600">{error}</div></Card>
  if (!data) return <Card title={title}><div className="text-xs text-slate-500">Loading…</div></Card>
  const max = Math.max(1, ...data.forecast.map((d: any) => d.forecast))
  return (
    <Card title={`${title} — trend ×${data.trend_factor}`}>
      <div className="flex items-end gap-1.5 h-36">
        {data.forecast.map((d: any) => (
          <div key={d.date} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ${d.forecast}`}>
            <span className="text-[10px] text-slate-500">{Math.round(d.forecast)}</span>
            <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${(d.forecast * 100) / max}%` }} />
            <span className="text-[9px] text-slate-400 mt-1">{new Date(d.date).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Predictive analytics: demand, beds, staffing (HRM.1.f), stock-outs, no-show risk. */
export function PredictivePage() {
  const staffing = useFetch<any>("/predict/staffing/")
  const stock = useFetch<any[]>("/predict/stockouts/")
  const noshow = useFetch<any>("/predict/no-show/")
  const beds = useFetch<any>("/predict/beds/")
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Predictive Analytics</h1>
        <p className="text-sm text-slate-500">Explainable forecasts from your own history — weekday seasonality × recent trend, average length of stay, consumption rates and no-show history.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Forecast url="/predict/opd-footfall/" title="OPD footfall — next 14 days" />
        <Forecast url="/predict/admissions/" title="Admissions — next 14 days" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Bed availability">
          {beds.data ? (
            <div className="space-y-1 text-sm">
              <div>Available now: <b>{beds.data.available_now}</b></div>
              {Object.entries(beds.data.expected_free).map(([k, v]) => <div key={k}>Expected to free in {k}: <b>{String(v)}</b></div>)}
              <div className="text-xs text-slate-500">ALOS {beds.data.alos_hours} h</div>
            </div>
          ) : <div className="text-xs text-slate-500">Loading…</div>}
        </Card>
        <Card title="Nurse staffing — next 7 days">
          {staffing.data ? (
            <table className="w-full text-xs">
              <thead><tr className="text-slate-500 text-left"><th>Date</th><th>Beds</th><th>Need/shift</th><th>Gaps</th></tr></thead>
              <tbody>
                {staffing.data.days.map((d: any) => (
                  <tr key={d.date} className="border-t border-slate-100 dark:border-slate-700">
                    <td>{d.date}</td><td>{d.forecast_occupied_beds}</td><td>{d.nurses_needed_per_shift}</td>
                    <td className={Object.keys(d.gaps).length ? "text-rose-600 font-semibold" : "text-emerald-600"}>{Object.keys(d.gaps).length ? Object.entries(d.gaps).map(([s, n]) => `${s} −${n}`).join(", ") : "OK"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="text-xs text-slate-500">Loading…</div>}
          {staffing.data && <div className="text-[11px] text-slate-400 mt-2">Ratios: ward {staffing.data.assumptions.ward_nurse_ratio}, ICU {staffing.data.assumptions.icu_nurse_ratio}</div>}
        </Card>
        <Card title="Medicines likely to stock out">
          {stock.data ? (
            stock.data.length ? (
              <ul className="text-xs space-y-1">
                {stock.data.slice(0, 12).map((s: any) => (
                  <li key={s.medicine} className="flex justify-between"><span>{s.medicine}{s.is_emergency ? " ⚠" : ""}</span><span className={s.days_of_stock < 7 ? "text-rose-600 font-semibold" : ""}>{s.days_of_stock} days</span></li>
                ))}
              </ul>
            ) : <div className="text-xs text-slate-500">No consumption history yet.</div>
          ) : <div className="text-xs text-slate-500">Loading…</div>}
        </Card>
      </div>
      <Card title={`Appointment no-show risk (hospital base rate ${noshow.data ? Math.round(noshow.data.base_rate * 100) : "—"}%)`}>
        {noshow.data ? (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 text-left"><th className="py-1">Patient</th><th>Doctor</th><th>When</th><th>History</th><th>Risk</th></tr></thead>
            <tbody>
              {noshow.data.appointments.slice(0, 25).map((a: any) => (
                <tr key={a.appointment} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1">{a.patient}</td><td>{a.doctor}</td><td>{a.date} {String(a.time).slice(0, 5)}</td><td>{a.history}</td>
                  <td><StatusPill value={a.risk >= 0.4 ? "high" : a.risk >= 0.2 ? "medium" : "low"} /> {Math.round(a.risk * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="text-xs text-slate-500">Loading…</div>}
      </Card>
    </div>
  )
}
