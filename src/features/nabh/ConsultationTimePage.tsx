import { useEffect, useState } from "react"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"

interface DoctorRow {
  doctor_id: number
  doctor: string
  department: string
  consultations: number
  average_minutes?: number
  median_minutes?: number
  shortest_minutes?: number
  longest_minutes?: number
  patients_per_hour?: number | null
  opd_days?: number
  average_wait_minutes?: number | null
  short_consultations?: number
  short_percent?: number
  configured_minutes?: number
  excluded: number
}

interface Report {
  short_under_minutes: number
  max_plausible_minutes: number
  overall: { consultations: number; average_minutes: number | null; median_minutes: number | null; short_consultations: number; excluded: number }
  doctors: DoctorRow[]
  short_consultations: { appointment: number; doctor: string; patient: string; uhid: string; started_at: string; minutes: number }[]
}

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
const m = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v} min`)

/** Per-doctor OPD consultation time: "Start consult" → "Complete". Managers see all doctors; a doctor sees their own. */
export function ConsultationTimePage() {
  const [start, setStart] = useState(daysAgo(30))
  const [end, setEnd] = useState(today())
  const [department, setDepartment] = useState("")
  const [shortUnder, setShortUnder] = useState("3")
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<any>("/departments/?page_size=200").then((r) => setDepartments(r.results ?? r)).catch(() => setDepartments([]))
  }, [])

  const query = () => `start=${start}&end=${end}&short_under=${shortUnder || 3}${department ? `&department=${department}` : ""}`
  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .get<Report>(`/consultation-time/?${query()}`)
      .then(setReport)
      .catch((e) => setError(extractApiError(e)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, department, shortUnder])

  const download = async () => {
    try {
      triggerBlobDownload(await api.getBlob(`/consultation-time/?${query()}&output=xlsx`), `consultation-time-${start}-to-${end}.xlsx`)
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  const o = report?.overall
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Consultation Time</h1>
        <p className="text-sm text-slate-500">
          How long each doctor spends per patient, from “Start consult” to “Complete”. Figures are only as accurate as those two clicks.
          Consultations longer than {report?.max_plausible_minutes ?? 120} minutes are treated as a forgotten click and left out.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs font-semibold text-slate-600">From<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="block mt-1 px-3 py-2 text-sm border rounded-lg" /></label>
          <label className="text-xs font-semibold text-slate-600">To<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="block mt-1 px-3 py-2 text-sm border rounded-lg" /></label>
          <label className="text-xs font-semibold text-slate-600">
            Department
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="block mt-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800">
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Flag consults under (min)
            <input type="number" min={1} max={30} value={shortUnder} onChange={(e) => setShortUnder(e.target.value)} className="block mt-1 w-28 px-3 py-2 text-sm border rounded-lg" />
          </label>
        </div>
        <button onClick={download} className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 uppercase">Excel</button>
      </div>

      {error && <div className="text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}

      {o && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Consultations" value={String(o.consultations)} />
          <Stat label="Average" value={m(o.average_minutes)} />
          <Stat label="Median" value={m(o.median_minutes)} />
          <Stat label={`Under ${report!.short_under_minutes} min`} value={String(o.short_consultations)} tone={o.short_consultations ? "warn" : undefined} />
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase text-left">
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Patients</th>
              <th className="px-4 py-3">Average</th>
              <th className="px-4 py-3">Median</th>
              <th className="px-4 py-3">Shortest – longest</th>
              <th className="px-4 py-3">Patients / hour</th>
              <th className="px-4 py-3">Avg wait</th>
              <th className="px-4 py-3">Short consults</th>
              <th className="px-4 py-3">Excluded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Calculating…</td></tr>
            ) : !report?.doctors.length ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No completed consultations in this period.</td></tr>
            ) : (
              report.doctors.map((r) => (
                <tr key={r.doctor_id}>
                  <td className="px-4 py-3 font-medium">Dr. {r.doctor}<div className="text-xs text-slate-400">{r.department || "No department"}{r.opd_days ? ` · ${r.opd_days} OPD day${r.opd_days > 1 ? "s" : ""}` : ""}</div></td>
                  <td className="px-4 py-3">{r.consultations}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {m(r.average_minutes)}
                    {r.configured_minutes !== undefined && <div className="text-xs font-normal text-slate-400">slot set to {r.configured_minutes} min</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{m(r.median_minutes)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.consultations ? `${r.shortest_minutes} – ${r.longest_minutes} min` : "—"}</td>
                  <td className="px-4 py-3">{r.patients_per_hour ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{m(r.average_wait_minutes)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.short_consultations ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${(r.short_percent ?? 0) >= 20 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.short_consultations} ({r.short_percent}%)
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.excluded || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!!report?.short_consultations.length && (
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <h2 className="px-4 py-3 font-semibold border-b border-slate-200 dark:border-slate-700">
            Consultations under {report.short_under_minutes} minutes
            <span className="ml-2 text-xs font-normal text-slate-500">May be a rushed OPD, a quick follow-up or report review, or late “Start consult” clicks. Worth a look, not a verdict.</span>
          </h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {[...report.short_consultations].reverse().map((s) => (
                <tr key={s.appointment}>
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(s.started_at).toLocaleString()}</td>
                  <td className="px-4 py-2">Dr. {s.doctor}</td>
                  <td className="px-4 py-2">{s.patient} <span className="text-slate-400">{s.uhid}</span></td>
                  <td className="px-4 py-2 font-semibold text-amber-700">{s.minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "warn" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  )
}
