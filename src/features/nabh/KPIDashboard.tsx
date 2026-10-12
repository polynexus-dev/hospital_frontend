import { useEffect, useState } from "react"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"
import { FormModal } from "../../components/resource/ResourceTable"

interface KPIRow {
  code: string
  name: string
  unit: string
  standard: string
  kind: string
  numerator: number | null
  denominator: number | null
  value: number | null
  source: string
  note: string
}

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

/** NABH IMS.2 — the 32 hospital KPIs + Digital Health KPIs, computed live, with manual entry for audit-based ones, export and quarterly publishing. */
export function KPIDashboard() {
  const [start, setStart] = useState(daysAgo(30))
  const [end, setEnd] = useState(today())
  const [kind, setKind] = useState<"nabh" | "dhs">("nabh")
  const [rows, setRows] = useState<KPIRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState<KPIRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ kpis: KPIRow[] }>(`/quality/kpis/?start=${start}&end=${end}&kind=${kind}`)
      setRows(res.kpis)
    } catch (e) {
      setError(extractApiError(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, kind])

  const exportAs = async (fmt: string) => {
    const blob = await api.getBlob(`/quality/kpis/?start=${start}&end=${end}&kind=${kind}&export=${fmt}`)
    triggerBlobDownload(blob, `nabh-kpis-${start}-${end}.${fmt}`)
  }

  const publish = async () => {
    try {
      const res = await api.post<{ published: number; period: { start: string; end: string } }>("/quality/kpis/publish/", {})
      setNotice(`Published ${res.published} KPIs for ${res.period.start} → ${res.period.end}.`)
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs font-semibold text-ink-3">From<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="block mt-1 px-3 py-2 text-sm border rounded-lg" /></label>
          <label className="text-xs font-semibold text-ink-3">To<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="block mt-1 px-3 py-2 text-sm border rounded-lg" /></label>
          <div className="flex rounded-lg border overflow-hidden text-sm">
            {(["nabh", "dhs"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`px-3 py-2 ${kind === k ? "bg-success text-white" : "bg-white dark:bg-slate-800"}`}>
                {k === "nabh" ? "NABH hospital KPIs" : "Digital Health KPIs"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["csv", "xlsx", "json", "xml", "pdf"].map((f) => (
            <button key={f} onClick={() => exportAs(f)} className="px-3 py-2 text-xs font-semibold rounded-lg bg-chip-bg dark:bg-slate-700 uppercase">{f}</button>
          ))}
          <button onClick={publish} className="px-3 py-2 text-sm font-medium rounded-lg bg-success text-white">Publish last quarter</button>
        </div>
      </div>
      {notice && <div className="text-sm text-success-text bg-success-bg rounded-lg px-3 py-2">{notice}</div>}
      {error && <div className="text-sm text-danger-text bg-danger-bg rounded-lg px-3 py-2">{error}</div>}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase text-left">
              <th className="px-4 py-3">Code</th><th className="px-4 py-3">Indicator</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Num / Den</th><th className="px-4 py-3">Source</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-slate-700">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-4">Computing…</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.code}>
                  <td className="px-4 py-3 font-mono text-xs">{r.code}<div className="text-ink-5">{r.standard}</div></td>
                  <td className="px-4 py-3">{r.name}{r.note && <div className="text-xs text-ink-5">{r.note}</div>}</td>
                  <td className="px-4 py-3 font-semibold text-ink dark:text-slate-100 whitespace-nowrap">{r.value === null ? "—" : `${r.value} ${r.unit}`}</td>
                  <td className="px-4 py-3 text-ink-4 whitespace-nowrap">{r.numerator ?? "—"} / {r.denominator ?? "—"}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.source === "system" ? "bg-success-bg text-success-text" : r.source === "manual" ? "bg-brand-tint text-brand-dark" : "bg-chip-bg text-ink-4"}`}>{r.source}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setManual(r)} className="text-xs font-semibold text-success-text">Enter audit data</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {manual && (
        <FormModal
          title={`${manual.code} — ${manual.name}`}
          fields={[
            { key: "numerator", label: "Numerator", type: "number", required: true },
            { key: "denominator", label: "Denominator", type: "number", required: true },
            { key: "notes", label: "Audit notes", type: "textarea" },
          ]}
          onClose={() => setManual(null)}
          onSubmit={async (body) => {
            await api.post("/quality/kpi-manual-entries/", { ...body, kpi_code: manual.code, period_start: start, period_end: end })
            setManual(null)
            load()
          }}
        />
      )}
    </div>
  )
}
