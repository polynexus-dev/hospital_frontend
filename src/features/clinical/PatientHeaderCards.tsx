import { useQuery } from "@tanstack/react-query"
import { api } from "../../api/client"

export interface PatientHeader {
  patient: { id: number; name: string; uhid: string; age: number | null; gender: string; blood_group: string }
  allergies: { allergen: string; severity: string; reaction: string }[]
  conditions: { condition: string; since?: string }[]
  surgeries: { procedure: string; year?: string }[]
  family: { relation?: string; condition: string }[]
  habits: Record<string, string>
  obstetric: Record<string, string | number>
  risks: { tool: string; level: string; score: number }[]
  alerts: number
  last_vitals: { at: string; bp: string; pulse: number | null; temperature_c: string | null; spo2: number | null; weight_kg: string | null } | null
}

const chip = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium"

function Card({ title, tone = "neutral", children, empty }: { title: string; tone?: "bad" | "warn" | "neutral"; children: React.ReactNode; empty: boolean }) {
  const border = tone === "bad" ? "border-danger-text/40" : tone === "warn" ? "border-warning-text/40" : "border-border dark:border-slate-700"
  return (
    <div className={`rounded-lg border ${border} bg-white dark:bg-slate-800 px-3 py-2 min-w-0`}>
      <div className="text-[10.5px] uppercase tracking-[.06em] font-semibold text-ink-4 mb-1">{title}</div>
      {empty ? <div className="text-[12px] text-ink-5">None recorded</div> : <div className="flex flex-wrap gap-1">{children}</div>}
    </div>
  )
}

/** History at a glance above clinical screens: allergies, conditions, surgeries, family, habits, high risks, last vitals.
 *  Renders nothing for staff without clinical access. */
export function PatientHeaderCards({ patientId }: { patientId: number }) {
  const q = useQuery({
    queryKey: ["patient-header", patientId],
    queryFn: () => api.get<PatientHeader>(`/clinical/patient-header/${patientId}/`),
    retry: false,
  })
  const h = q.data
  if (!h) return null
  const habits = Object.entries(h.habits)
  const ob = Object.entries(h.obstetric).filter(([, v]) => v !== "" && v !== null && v !== undefined)
  const v = h.last_vitals
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2" aria-label="Patient history summary">
      <Card title={`Allergies${h.alerts ? ` · ${h.alerts} alert${h.alerts === 1 ? "" : "s"}` : ""}`} tone={h.allergies.length ? "bad" : "neutral"} empty={!h.allergies.length}>
        {h.allergies.map((a) => <span key={a.allergen} className={`${chip} bg-danger-bg text-danger-text`} title={a.reaction}>{a.allergen}{a.severity === "severe" ? " ⚠" : ""}</span>)}
      </Card>
      <Card title="Conditions" empty={!h.conditions.length}>
        {h.conditions.map((c, i) => <span key={i} className={`${chip} bg-chip-bg`}>{c.condition}{c.since ? ` (${c.since})` : ""}</span>)}
      </Card>
      <Card title="Surgeries" empty={!h.surgeries.length}>
        {h.surgeries.map((s, i) => <span key={i} className={`${chip} bg-chip-bg`}>{s.procedure}{s.year ? ` · ${s.year}` : ""}</span>)}
      </Card>
      <Card title={ob.length ? "Family · Obstetric" : "Family"} empty={!h.family.length && !ob.length}>
        {h.family.map((f, i) => <span key={i} className={`${chip} bg-chip-bg`}>{f.relation ? `${f.relation}: ` : ""}{f.condition}</span>)}
        {ob.map(([k, val]) => <span key={k} className={`${chip} bg-chip-bg`}>{k.toUpperCase().slice(0, 1)}{k === "lmp" ? `MP ${val}` : val}</span>)}
      </Card>
      <Card title="Habits" empty={!habits.length}>
        {habits.map(([k, val]) => <span key={k} className={`${chip} bg-chip-bg`}>{k.replace("_", " ")}: {val}</span>)}
      </Card>
      <Card title="Risks · last vitals" tone={h.risks.length ? "warn" : "neutral"} empty={!h.risks.length && !v}>
        {h.risks.map((r) => <span key={r.tool} className={`${chip} bg-warning-bg text-warning-text`}>{r.tool}: {r.level.replace("_", " ")}</span>)}
        {v && <span className={`${chip} bg-chip-bg`}>{[v.bp && `BP ${v.bp}`, v.pulse && `P ${v.pulse}`, v.spo2 && `SpO₂ ${v.spo2}`, v.temperature_c && `${v.temperature_c}°C`].filter(Boolean).join(" · ")}</span>}
      </Card>
    </div>
  )
}
