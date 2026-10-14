import { useEffect, useState } from "react"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"

// MRD MIS: discharges not yet ICD-coded, death cases and medico-legal cases.

type Kind = "uncoded" | "deaths" | "mlc"
interface Summary { uncoded: number; not_coded: number; overdue_coding: number; deaths: number; ipd_deaths: number; deaths_within_48h: number; mlc: number; mlc_police_not_intimated: number }
interface Report { title: string; count: number; rows: Record<string, unknown>[] }

const input = "px-3 py-2 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const today = () => new Date().toISOString().slice(0, 10)
const monthAgo = () => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
const COLUMNS: Record<Kind, [string, string][]> = {
  uncoded: [["uhid", "UHID"], ["patient", "Patient"], ["discharged_at", "Discharged"], ["outcome", "Outcome"], ["doctor", "Doctor"], ["department", "Dept"], ["state", "Coding"], ["days_since_discharge", "Days"]],
  deaths: [["source", "Where"], ["uhid", "UHID"], ["patient", "Patient"], ["age", "Age"], ["gender", "Sex"], ["died_at", "Died"], ["hours_after_arrival", "Hrs after arrival"], ["doctor", "Doctor"], ["cause_of_death", "Cause"], ["mlc", "MLC"]],
  mlc: [["source", "Where"], ["mlc_number", "MLC no."], ["type", "Type"], ["uhid", "UHID"], ["patient", "Patient"], ["arrived_at", "Arrived"], ["police_station", "Police station"], ["intimation_hours", "Intimated (hrs)"], ["checklist", "Checklist"], ["outcome", "Outcome"]],
}

function cell(v: unknown) {
  if (v === true) return "Yes"
  if (v === false) return "No"
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) return new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
  return String(v)
}

export function MRDReportsPanel() {
  const [start, setStart] = useState(monthAgo())
  const [end, setEnd] = useState(today())
  const [kind, setKind] = useState<Kind>("uncoded")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    setError(null)
    try {
      const [s, r] = await Promise.all([
        api.get<Summary>(`/mrd/reports/?kind=summary&start=${start}&end=${end}`),
        api.get<Report>(`/mrd/reports/?kind=${kind}&start=${start}&end=${end}`),
      ])
      setSummary(s)
      setReport(r)
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  useEffect(() => { load() }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const exportAs = async (output: "xlsx" | "csv") => {
    try {
      triggerBlobDownload(await api.getBlob(`/mrd/reports/?kind=${kind}&start=${start}&end=${end}&output=${output}`), `mrd-${kind}-${start}-to-${end}.${output}`)
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const tile = (k: Kind, label: string, value: number | undefined, sub: string) => (
    <button key={k} onClick={() => setKind(k)} className={`text-left rounded-lg border p-3 ${kind === k ? "border-brand bg-brand-tint" : "border-border dark:border-slate-700"}`}>
      <div className="text-[11px] uppercase text-ink-4">{label}</div>
      <div className="text-2xl font-bold">{value ?? "—"}</div>
      <div className="text-[12px] text-ink-4">{sub}</div>
    </button>
  )
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">MRD reports</h2>
        <p className="text-sm text-ink-4">Discharges still to be ICD-coded (or coded but not verified), deaths in the wards and emergency, and medico-legal cases.</p>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-ink-3">From<input type="date" className={`${input} block mt-1`} value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="text-xs font-semibold text-ink-3">To<input type="date" className={`${input} block mt-1`} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <button onClick={load} className="px-4 py-2 text-sm font-semibold rounded-lg bg-chip-bg dark:bg-slate-700">Show</button>
        <button onClick={() => exportAs("xlsx")} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border-strong">Excel</button>
        <button onClick={() => exportAs("csv")} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border-strong">CSV</button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {tile("uncoded", "Not coded / not verified", summary?.uncoded, summary ? `${summary.not_coded} not coded · ${summary.overdue_coding} over 7 days` : "")}
        {tile("deaths", "Deaths", summary?.deaths, summary ? `${summary.ipd_deaths} in wards · ${summary.deaths_within_48h} within 48 h` : "")}
        {tile("mlc", "Medico-legal cases", summary?.mlc, summary ? `${summary.mlc_police_not_intimated} police not yet intimated` : "")}
      </div>
      {error && <div className="text-sm text-danger-text">{error}</div>}
      {report && (
        <div className="overflow-x-auto">
          <div className="text-sm font-semibold mb-1">{report.title} ({report.count})</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-ink-4 uppercase text-left">{COLUMNS[kind].map(([, l]) => <th key={l} className="py-2 pr-3 whitespace-nowrap">{l}</th>)}</tr></thead>
            <tbody className="divide-y divide-border dark:divide-slate-700">
              {report.rows.map((r, i) => <tr key={i}>{COLUMNS[kind].map(([k]) => <td key={k} className="py-1.5 pr-3 whitespace-nowrap">{cell(r[k])}</td>)}</tr>)}
              {report.rows.length === 0 && <tr><td colSpan={COLUMNS[kind].length} className="py-3 text-ink-4">Nothing in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
