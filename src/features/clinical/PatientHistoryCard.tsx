import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"

type Row = Record<string, string | boolean>
interface History { past_medical: Row[]; surgical: Row[]; family: Row[]; habits: Record<string, string>; obstetric: Record<string, string>; notes: string; updated_at?: string; updated_by_name?: string }

const input = "h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] bg-transparent min-w-0"
const HABITS: [string, string, string[]][] = [
  ["smoking", "Smoking", ["", "never", "former", "current"]], ["alcohol", "Alcohol", ["", "never", "occasional", "regular"]],
  ["tobacco", "Tobacco / gutkha", ["", "never", "former", "current"]], ["diet", "Diet", ["", "vegetarian", "eggetarian", "non-vegetarian", "vegan"]],
  ["exercise", "Exercise", ["", "none", "occasional", "regular"]],
]

function ListEditor({ title, rows, onChange, cols }: { title: string; rows: Row[]; onChange: (r: Row[]) => void; cols: [string, string, string?][] }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">{title}</div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap gap-1.5 items-center">
            {cols.map(([key, label, kind]) => kind === "bool" ? (
              <label key={key} className="text-[12px] flex items-center gap-1"><input type="checkbox" checked={r[key] !== false} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [key]: e.target.checked } : x)))} />{label}</label>
            ) : (
              <input key={key} aria-label={`${title} ${label} ${i + 1}`} placeholder={label} className={`${input} ${key === cols[0][0] ? "flex-1" : "w-24"}`} value={String(r[key] ?? "")}
                onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)))} />
            ))}
            <button aria-label="Remove" className="text-ink-4 hover:text-danger-text px-1" onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button className="text-[12px] text-brand font-semibold" onClick={() => onChange([...rows, {}])}>+ Add</button>
      </div>
    </div>
  )
}

/** Patient → History: past medical, surgical, family, habits, obstetric. Feeds the header cards. */
export function PatientHistoryCard({ patientId, gender }: { patientId: number; gender?: string }) {
  const queryClient = useQueryClient()
  const [h, setH] = useState<History | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  useEffect(() => { api.get<History>(`/clinical/patient-history/${patientId}/`).then(setH).catch((e) => setError(extractApiError(e))) }, [patientId])
  if (!h) return error ? <Card padded><div className="text-[12.5px] text-danger-text">{error}</div></Card> : null
  const set = (patch: Partial<History>) => { setH({ ...h, ...patch }); setSaved(false) }
  const save = async () => {
    setError(null)
    try {
      const clean = (rows: Row[], key: string) => rows.filter((r) => String(r[key] ?? "").trim())
      setH(await api.put<History>(`/clinical/patient-history/${patientId}/`, {
        ...h, past_medical: clean(h.past_medical, "condition"), surgical: clean(h.surgical, "procedure"), family: clean(h.family, "condition"),
      }))
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ["patient-header", patientId] })
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <Card padded>
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Medical history</Eyebrow>
        {h.updated_at && <span className="text-[11.5px] text-ink-4">Updated {new Date(h.updated_at).toLocaleDateString("en-IN")}{h.updated_by_name ? ` by ${h.updated_by_name}` : ""}</span>}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <ListEditor title="Past medical history" rows={h.past_medical} onChange={(r) => set({ past_medical: r })} cols={[["condition", "Condition"], ["since", "Since"], ["ongoing", "Ongoing", "bool"]]} />
        <ListEditor title="Surgical history" rows={h.surgical} onChange={(r) => set({ surgical: r })} cols={[["procedure", "Procedure"], ["year", "Year"]]} />
        <ListEditor title="Family history" rows={h.family} onChange={(r) => set({ family: r })} cols={[["condition", "Condition"], ["relation", "Relation"]]} />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">Personal history</div>
          <div className="grid grid-cols-2 gap-1.5">
            {HABITS.map(([key, label, opts]) => (
              <label key={key} className="text-[12px] text-ink-3">{label}
                <select className={`${input} w-full mt-0.5`} value={h.habits[key] ?? ""} onChange={(e) => set({ habits: { ...h.habits, [key]: e.target.value } })}>
                  {opts.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
        {gender !== "male" && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">Obstetric history</div>
            <div className="grid grid-cols-5 gap-1.5">
              {[["gravida", "G"], ["para", "P"], ["living", "L"], ["abortions", "A"]].map(([k, l]) => (
                <label key={k} className="text-[12px] text-ink-3">{l}<input aria-label={k} type="number" min={0} className={`${input} w-full mt-0.5`} value={h.obstetric[k] ?? ""} onChange={(e) => set({ obstetric: { ...h.obstetric, [k]: e.target.value } })} /></label>
              ))}
              <label className="text-[12px] text-ink-3">LMP<input aria-label="lmp" type="date" className={`${input} w-full mt-0.5`} value={h.obstetric.lmp ?? ""} onChange={(e) => set({ obstetric: { ...h.obstetric, lmp: e.target.value } })} /></label>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <Button size="sm" onClick={save}>Save history</Button>
        {saved && <span className="text-[12px] text-success-text">Saved.</span>}
        {error && <span className="text-[12px] text-danger-text">{error}</span>}
      </div>
    </Card>
  )
}
