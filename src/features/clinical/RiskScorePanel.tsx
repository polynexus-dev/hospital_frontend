import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { ResourceTable } from "../../components/resource/ResourceTable"

// Fall (Morse / Humpty Dumpty), pressure ulcer, VTE, NEWS2 and vulnerability
// scoring with a proper form, and the intervention checklist each risk level
// brings — ticked off by the nurses, with who and when.

interface FormItem { key: string; label: string; type: "bool" | "choice" | "number"; options?: [string | number, string][]; min?: number; max?: number }
interface Level { level: string; high_risk: boolean; interventions: string[] }
interface Tool { tool: string; label: string; items: FormItem[]; levels: Level[] }
interface Assessment {
  id: number; patient: number; patient_name?: string; tool: string; score: number; risk_level: string; assessed_at: string
  intervention_items: string[]; interventions_done: Record<string, { by: string; at: string }>; interventions_pending: string[]; is_high_risk: boolean
}

const input = "w-full px-3 py-2 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const card = "bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4"

function Checklist({ a, onChange }: { a: Assessment; onChange: (a: Assessment) => void }) {
  const [error, setError] = useState<string | null>(null)
  const toggle = async (item: string, done: boolean) => {
    setError(null)
    try {
      onChange(await api.post<Assessment>(`/clinical/risk-assessments/${a.id}/interventions/`, done ? { done: [item] } : { undone: [item] }))
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  if (!a.intervention_items.length) return <div className="text-[12.5px] text-ink-4">No interventions for this level.</div>
  return (
    <ul className="space-y-1">
      {a.intervention_items.map((item) => {
        const done = a.interventions_done?.[item]
        return (
          <li key={item} className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" className="mt-0.5" checked={!!done} onChange={(e) => toggle(item, e.target.checked)} aria-label={item} />
            <span className={done ? "text-ink-4" : ""}>{item}{done && <span className="text-[11.5px]"> — {done.by}, {new Date(done.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}</span>
          </li>
        )
      })}
      {error && <li className="text-[12px] text-danger-text">{error}</li>}
    </ul>
  )
}

export function RiskScorePanel() {
  const [tools, setTools] = useState<Tool[]>([])
  const [toolKey, setToolKey] = useState("morse_fall")
  const [patient, setPatient] = useState("")
  const [admission, setAdmission] = useState("")
  const [patients, setPatients] = useState<{ id: number; full_name: string; uhid: string }[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [result, setResult] = useState<Assessment | null>(null)
  const [pending, setPending] = useState<Assessment[]>([])
  const [error, setError] = useState<string | null>(null)
  const loadPending = () => api.get<Assessment[]>("/clinical/risk-assessments/intervention-compliance/?hours=4").then(setPending).catch(() => setPending([]))
  useEffect(() => {
    api.get<Tool[]>("/clinical/risk-assessments/tools/").then(setTools).catch((e) => setError(extractApiError(e)))
    api.get<any>("/patients/?page_size=50&ordering=-created_at").then((r) => setPatients(r.results ?? [])).catch(() => setPatients([]))
    loadPending()
  }, [])
  const tool = tools.find((t) => t.tool === toolKey)
  const submit = async () => {
    setError(null)
    try {
      const a = await api.post<Assessment>("/clinical/risk-assessments/", { patient: Number(patient), admission: admission ? Number(admission) : null, tool: toolKey, answers })
      setResult(a)
      setAnswers({})
      loadPending()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <div className="space-y-6">
      <section className={card}>
        <div>
          <h2 className="text-lg font-bold">Score a patient</h2>
          <p className="text-sm text-ink-4">The score is worked out on the server. A high risk alerts the nursing team and brings its intervention checklist.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-xs font-semibold text-ink-3">Tool
            <select className={`${input} mt-1`} value={toolKey} onChange={(e) => { setToolKey(e.target.value); setAnswers({}); setResult(null) }}>
              {tools.map((t) => <option key={t.tool} value={t.tool}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-ink-3">Patient
            <select className={`${input} mt-1`} value={patient} onChange={(e) => setPatient(e.target.value)}>
              <option value="">Choose…</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.uhid}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-ink-3">Admission no. (optional)<input className={`${input} mt-1`} value={admission} onChange={(e) => setAdmission(e.target.value)} /></label>
        </div>
        {tool && (
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2.5">
            {tool.items.map((it) => it.type === "bool" ? (
              <label key={it.key} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={!!answers[it.key]} onChange={(e) => setAnswers({ ...answers, [it.key]: e.target.checked })} />{it.label}</label>
            ) : it.type === "choice" ? (
              <label key={it.key} className="text-xs font-semibold text-ink-3">{it.label}
                <select className={`${input} mt-1`} value={String(answers[it.key] ?? "")} onChange={(e) => setAnswers({ ...answers, [it.key]: e.target.value })}>
                  <option value="">—</option>{(it.options ?? []).map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
                </select>
              </label>
            ) : (
              <label key={it.key} className="text-xs font-semibold text-ink-3">{it.label}
                <input type="number" min={it.min} max={it.max} className={`${input} mt-1`} value={String(answers[it.key] ?? "")} onChange={(e) => setAnswers({ ...answers, [it.key]: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button disabled={!patient} onClick={submit} className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white disabled:opacity-50">Calculate &amp; save</button>
          {error && <span className="text-sm text-danger-text">{error}</span>}
        </div>
        {result && (
          <div className={`rounded-lg p-3 ${result.is_high_risk ? "bg-warning-bg" : "bg-success-bg"}`}>
            <div className="font-semibold mb-1.5">Score {result.score} — {result.risk_level.replace("_", " ")} risk</div>
            <Checklist a={result} onChange={setResult} />
          </div>
        )}
      </section>

      <section className={card}>
        <div>
          <h2 className="text-lg font-bold">Interventions still open</h2>
          <p className="text-sm text-ink-4">Admitted patients whose latest high-risk score is over 4 hours old with checklist items not yet done.</p>
        </div>
        {pending.length === 0 ? <div className="text-sm text-ink-4">Nothing outstanding.</div> : pending.map((a) => (
          <div key={a.id} className="border-t border-border pt-2">
            <div className="text-sm font-semibold">{a.patient_name ?? `Patient #${a.patient}`} · {tools.find((t) => t.tool === a.tool)?.label ?? a.tool} · {a.risk_level.replace("_", " ")} ({a.score})</div>
            <Checklist a={a} onChange={(next) => setPending(pending.map((p) => (p.id === next.id ? next : p)).filter((p) => p.interventions_pending.length))} />
          </div>
        ))}
      </section>

      <ResourceTable config={{
        title: "Score history", endpoint: "/clinical/risk-assessments/", searchable: false,
        filters: [{ key: "tool", label: "Tool", type: "select", options: tools.map((t) => ({ value: t.tool, label: t.label })) }],
        columns: [{ key: "patient_name", label: "Patient" }, { key: "tool", label: "Tool" }, { key: "score", label: "Score" }, { key: "risk_level", label: "Risk" },
          { key: "interventions_pending", label: "Open items", render: (r) => (r.intervention_items?.length ? `${r.interventions_pending.length} of ${r.intervention_items.length}` : "—") },
          { key: "assessed_at", label: "At", render: (r) => new Date(r.assessed_at).toLocaleString("en-IN") }],
      }} />
    </div>
  )
}

export const interventionBundlesResource = {
  title: "Intervention checklists",
  description: "Your own checklist for a tool and risk level replaces the built-in one (e.g. your fall-prevention bundle for Morse 'high'). Levels — Morse: low, moderate, high · Humpty Dumpty: low, high · Braden: mild, moderate, high, very_high · Caprini: low, moderate, high, highest · NEWS2: medium, high · Vulnerability: vulnerable.",
  endpoint: "/clinical/intervention-bundles/", createLabel: "Add checklist",
  columns: [{ key: "tool", label: "Tool" }, { key: "risk_level", label: "Level" }, { key: "items", label: "Items", render: (r: any) => (r.items ?? []).join(" · ") }, { key: "is_active", label: "Active" }],
  fields: [
    { key: "tool", label: "Tool", type: "select" as const, required: true, options: ["morse_fall", "humpty_dumpty", "braden", "caprini", "news2", "vulnerability"] },
    { key: "risk_level", label: "Risk level", required: true },
    { key: "items", label: "Items (JSON list)", type: "json" as const, required: true, placeholder: '["Bed in lowest position", "Call bell within reach"]' },
    { key: "is_active", label: "Active", type: "boolean" as const, defaultValue: true },
  ],
}
