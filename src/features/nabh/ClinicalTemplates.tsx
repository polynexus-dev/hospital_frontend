import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, extractApiError } from "../../api/client"

// Structured assessment templates: the builder where hospitals make their own
// (or adapt the pre-built specialty library), and the form that renders any
// template for a doctor to fill in. The backend validates answers against the
// template, so this only has to render it faithfully.

export type TemplateFieldType = "text" | "textarea" | "number" | "select" | "multiselect" | "boolean" | "date"

export interface TemplateField {
  key: string
  label: string
  type: TemplateFieldType
  options?: string[]
  required?: boolean
  /** builder-only: key still follows the label (never sent to the API) */
  _new?: boolean
}

export interface AssessmentTemplate {
  id: number
  name: string
  category: string
  setting: "opd" | "ipd" | "both"
  fields: TemplateField[]
  is_active: boolean
}

export const CATEGORIES: [string, string][] = [
  ["general", "General medicine"], ["cardiology", "Cardiology"], ["orthopaedics", "Orthopaedics"], ["obstetrics", "Obstetrics"],
  ["antenatal", "Antenatal"], ["gynaecology", "Gynaecology"], ["paediatrics", "Paediatrics"], ["dermatology", "Dermatology"],
  ["neurology", "Neurology"], ["gastroenterology", "Gastroenterology"], ["pulmonology", "Pulmonology"], ["nephrology", "Nephrology"],
  ["urology", "Urology"], ["endocrinology", "Endocrinology / Diabetes"], ["psychiatry", "Psychiatry"], ["surgery", "Surgery"],
  ["ophthalmology", "Ophthalmology"], ["ent", "ENT"], ["dental", "Dental"], ["oncology", "Oncology"], ["rehab", "Rehabilitation"],
  ["nursing", "Nursing"], ["dietary", "Dietary"],
]
const categoryLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c

const FIELD_TYPES: [TemplateFieldType, string][] = [
  ["text", "Short text"], ["textarea", "Long text"], ["number", "Number"], ["select", "Pick one"],
  ["multiselect", "Pick several"], ["boolean", "Yes / No"], ["date", "Date"],
]

async function listTemplates(setting?: "opd" | "ipd"): Promise<AssessmentTemplate[]> {
  const res = await api.get<any>("/clinical/assessment-templates/?page_size=500")
  const rows: AssessmentTemplate[] = res.results ?? res
  return setting ? rows.filter((t) => t.setting === setting || t.setting === "both") : rows
}

// ---------------------------------------------------------------- form

const looks = {
  slate: {
    input: "w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900",
    label: "text-xs font-semibold text-slate-600 dark:text-slate-300",
    chipOn: "bg-emerald-600 text-white border-emerald-600",
    chipOff: "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200",
  },
  panel: {
    input: "w-full h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] bg-transparent",
    label: "text-[11.5px] text-ink-4",
    chipOn: "bg-brand text-white border-brand",
    chipOff: "border-border text-ink-3",
  },
}

/** Renders a template's fields. `value` is the answers object sent as `data`. */
export function TemplateFields({ fields, value, onChange, look = "slate", disabled = false }: {
  fields: TemplateField[]
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  look?: keyof typeof looks
  disabled?: boolean
}) {
  const L = looks[look]
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v })
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {fields.map((f) => {
        const v = value[f.key]
        const wide = f.type === "textarea" || f.type === "multiselect"
        return (
          <label key={f.key} className={`block ${wide ? "sm:col-span-2" : ""}`}>
            <span className={L.label}>
              {f.label}
              {f.required && <span className="text-rose-600"> *</span>}
            </span>
            <div className="mt-1">
              {f.type === "textarea" ? (
                <textarea rows={2} disabled={disabled} className={`${L.input} h-auto py-1.5`} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === "select" ? (
                <select disabled={disabled} className={L.input} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value || undefined)}>
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "multiselect" ? (
                <div className="flex flex-wrap gap-1.5">
                  {(f.options ?? []).map((o) => {
                    const list = (Array.isArray(v) ? v : []) as string[]
                    const on = list.includes(o)
                    return (
                      <button type="button" key={o} disabled={disabled} onClick={() => set(f.key, on ? list.filter((x) => x !== o) : [...list, o])}
                        className={`px-2 py-0.5 rounded-full border text-[12px] ${on ? L.chipOn : L.chipOff}`}>
                        {o}
                      </button>
                    )
                  })}
                </div>
              ) : f.type === "boolean" ? (
                <div className="flex gap-1.5">
                  {[true, false].map((b) => (
                    <button type="button" key={String(b)} disabled={disabled} onClick={() => set(f.key, v === b ? undefined : b)}
                      className={`px-3 py-0.5 rounded-full border text-[12px] ${v === b ? L.chipOn : L.chipOff}`}>
                      {b ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              ) : (
                <input disabled={disabled} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} step="any" className={L.input}
                  value={(v as string | number) ?? ""}
                  onChange={(e) => set(f.key, e.target.value === "" ? undefined : f.type === "number" ? Number(e.target.value) : e.target.value)} />
              )}
            </div>
          </label>
        )
      })}
    </div>
  )
}

export function answerText(v: unknown): string {
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) return ""
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (Array.isArray(v)) return v.join(", ")
  return String(v)
}

// ------------------------------------------------- consultation section

/** "Specialty assessment" inside the OPD consultation panel. */
export function SpecialtyAssessmentSection({ encounterId, patientId, doctorId }: { encounterId: number; patientId: number; doctorId?: number }) {
  const queryClient = useQueryClient()
  const doctorQuery = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: () => api.get<{ speciality: string }>(`/doctors/${doctorId}/`),
    enabled: !!doctorId,
  })
  const doctorSpeciality = doctorQuery.data?.speciality
  const templatesQuery = useQuery({ queryKey: ["assessment-templates", "opd"], queryFn: () => listTemplates("opd") })
  const savedQuery = useQuery({
    queryKey: ["encounter-assessments", encounterId],
    queryFn: () => api.get<any>(`/clinical/assessments/?encounter=${encounterId}`).then((r) => (r.results ?? r) as any[]),
  })
  const active = useMemo(() => (templatesQuery.data ?? []).filter((t) => t.is_active), [templatesQuery.data])
  const [templateId, setTemplateId] = useState<number | "">("")
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)

  // Pre-select the template matching the doctor's speciality.
  useEffect(() => {
    if (templateId !== "" || !active.length || !doctorSpeciality) return
    const s = doctorSpeciality.toLowerCase()
    const match = active.find((t) => s.includes(t.category.slice(0, 5)) || categoryLabel(t.category).toLowerCase().split(/[ /]+/).some((w) => w.length > 3 && s.includes(w)))
    if (match) setTemplateId(match.id)
  }, [active, doctorSpeciality, templateId])

  const template = active.find((t) => t.id === templateId)
  const save = useMutation({
    mutationFn: () => api.post("/clinical/assessments/", { patient: patientId, encounter: encounterId, template: templateId, kind: "initial", data: answers }),
    onSuccess: () => {
      setAnswers({})
      setError(null)
      queryClient.invalidateQueries({ queryKey: ["encounter-assessments", encounterId] })
    },
    onError: (e) => setError(extractApiError(e)),
  })
  const byId = new Map((templatesQuery.data ?? []).map((t) => [t.id, t]))

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1.5">Specialty assessment</div>
      {(savedQuery.data ?? []).map((a) => {
        const t = byId.get(a.template)
        return (
          <div key={a.id} className="text-[12px] text-ink-3 mb-2 border-l-2 border-border pl-2">
            <div className="font-semibold text-ink-2">{t?.name ?? categoryLabel(a.category)}</div>
            {(t?.fields ?? []).map((f) => {
              const text = answerText(a.data?.[f.key])
              return text ? <div key={f.key}><span className="text-ink-5">{f.label}: </span>{text}</div> : null
            })}
          </div>
        )
      })}
      <select className="w-full h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] bg-transparent mb-2" value={templateId}
        onChange={(e) => { setTemplateId(e.target.value ? Number(e.target.value) : ""); setAnswers({}) }}>
        <option value="">Choose a template…</option>
        {active.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {template && (
        <>
          <TemplateFields fields={template.fields} value={answers} onChange={setAnswers} look="panel" />
          {error && <div className="text-[12px] text-rose-600 mt-1.5">{error}</div>}
          <button className="mt-2 h-7 px-3 rounded-control text-[12px] font-semibold bg-brand text-white disabled:opacity-50" disabled={save.isPending} onClick={() => save.mutate()}>
            Save assessment
          </button>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------- builder page

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40)

function FieldEditor({ field, onChange, onRemove, onMove, first, last }: {
  field: TemplateField
  onChange: (f: TemplateField) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  first: boolean
  last: boolean
}) {
  const input = "px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
  const needsOptions = field.type === "select" || field.type === "multiselect"
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <input className={`${input} flex-1 min-w-[180px]`} placeholder="Label shown to the doctor" value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value, key: field._new ? slug(e.target.value) : field.key })} />
        <select className={input} value={field.type} onChange={(e) => onChange({ ...field, type: e.target.value as TemplateFieldType })}>
          {FIELD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!field.required} onChange={(e) => onChange({ ...field, required: e.target.checked })} /> Required</label>
        <div className="flex gap-1 ml-auto">
          <button type="button" disabled={first} onClick={() => onMove(-1)} className="px-2 text-slate-500 disabled:opacity-30" title="Move up">↑</button>
          <button type="button" disabled={last} onClick={() => onMove(1)} className="px-2 text-slate-500 disabled:opacity-30" title="Move down">↓</button>
          <button type="button" onClick={onRemove} className="px-2 text-rose-600 text-xs font-semibold">Remove</button>
        </div>
      </div>
      {needsOptions && (
        <textarea rows={2} className={`${input} w-full`} placeholder="Options, one per line"
          value={(field.options ?? []).join("\n")}
          onChange={(e) => onChange({ ...field, options: e.target.value.split("\n").map((o) => o.trimStart()).filter((o, i, all) => o || i === all.length - 1) })} />
      )}
      <div className="text-[11px] text-slate-400">
        Stored as <code>{field.key || "…"}</code>
        {!field._new && " — kept when you rename, so earlier answers stay linked"}
      </div>
    </div>
  )
}

function TemplateEditor({ initial, onClose, onSaved }: { initial: Partial<AssessmentTemplate>; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial.name ?? "")
  const [category, setCategory] = useState(initial.category ?? "general")
  const [setting, setSetting] = useState<AssessmentTemplate["setting"]>(initial.setting ?? "opd")
  const [fields, setFields] = useState<TemplateField[]>(initial.fields ?? [{ key: "", label: "", type: "text", _new: true }])
  const [preview, setPreview] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const clean = fields.map((f) => ({
    ...f, key: f.key || slug(f.label), label: f.label.trim(),
    ...(f.type === "select" || f.type === "multiselect" ? { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) } : { options: undefined }),
  }))
  const problems = [
    !name.trim() && "Give the template a name.",
    !clean.length && "Add at least one field.",
    clean.some((f) => !f.label) && "Every field needs a label.",
    new Set(clean.map((f) => f.key)).size !== clean.length && "Two fields have the same label — make them distinct.",
    clean.some((f) => (f.type === "select" || f.type === "multiselect") && !f.options?.length) && "Pick-one / pick-several fields need options.",
  ].filter(Boolean) as string[]

  const save = async () => {
    setSaving(true)
    setError(null)
    const body = { name: name.trim(), category, setting, fields: clean.map(({ options, _new, ...rest }) => (options ? { ...rest, options } : rest)) }
    try {
      if (initial.id) await api.patch(`/clinical/assessment-templates/${initial.id}/`, body)
      else await api.post("/clinical/assessment-templates/", body)
      onSaved()
    } catch (e) {
      setError(extractApiError(e))
    } finally {
      setSaving(false)
    }
  }

  const input = "w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
  const move = (i: number, dir: -1 | 1) => setFields((fs) => { const next = [...fs]; [next[i], next[i + dir]] = [next[i + dir], next[i]]; return next })
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-5xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-bold">{initial.id ? "Edit template" : "New template"}</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">×</button>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 p-6">
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">Name<input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rheumatology consultation" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">Specialty
                <select className={`${input} mt-1`} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Used in
                <select className={`${input} mt-1`} value={setting} onChange={(e) => setSetting(e.target.value as AssessmentTemplate["setting"])}>
                  <option value="opd">OPD</option><option value="ipd">IPD</option><option value="both">OPD & IPD</option>
                </select>
              </label>
            </div>
            <div className="text-xs font-semibold text-slate-600 pt-2">Fields</div>
            {fields.map((f, i) => (
              <FieldEditor key={i} field={f} first={i === 0} last={i === fields.length - 1}
                onChange={(nf) => setFields((fs) => fs.map((x, j) => (j === i ? nf : x)))}
                onRemove={() => setFields((fs) => fs.filter((_, j) => j !== i))} onMove={(d) => move(i, d)} />
            ))}
            <button type="button" onClick={() => setFields((fs) => [...fs, { key: "", label: "", type: "text", _new: true }])} className="text-sm font-semibold text-emerald-700">+ Add field</button>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2">Preview — what the doctor sees</div>
            <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4">
              <TemplateFields fields={clean.filter((f) => f.label)} value={preview} onChange={setPreview} />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3 justify-end">
          {(error || problems[0]) && <div className="text-sm text-rose-700 mr-auto">{error ?? problems[0]}</div>}
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700">Cancel</button>
          <button onClick={save} disabled={saving || problems.length > 0} className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClinicalTemplatesPage() {
  const queryClient = useQueryClient()
  const templatesQuery = useQuery({ queryKey: ["assessment-templates", "all"], queryFn: () => listTemplates() })
  const [editing, setEditing] = useState<Partial<AssessmentTemplate> | null>(null)
  const [filter, setFilter] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["assessment-templates"] })

  const install = async () => {
    setError(null)
    try {
      const res = await api.post<{ added: string[] }>("/clinical/assessment-templates/install-library/", {})
      setNotice(res.added.length ? `Added ${res.added.length}: ${res.added.join(", ")}.` : "You already have every library template.")
      refresh()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const toggle = async (t: AssessmentTemplate) => {
    try {
      await api.patch(`/clinical/assessment-templates/${t.id}/`, { is_active: !t.is_active })
      refresh()
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  const rows = (templatesQuery.data ?? []).filter((t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase()) || categoryLabel(t.category).toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Clinical Templates</h1>
          <p className="text-sm text-slate-500">Structured forms doctors fill in during consultations. Use the pre-built specialty library, adapt a copy, or build your own.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={install} className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700">Add specialty library</button>
          <button onClick={() => setEditing({})} className="px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white">New template</button>
        </div>
      </div>
      {notice && <div className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">{notice}</div>}
      {error && <div className="text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
      <input className="w-full max-w-sm px-3 py-2 text-sm border border-slate-300 rounded-lg" placeholder="Search by name or specialty" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase text-left">
              <th className="px-4 py-3">Template</th><th className="px-4 py-3">Specialty</th><th className="px-4 py-3">Used in</th><th className="px-4 py-3">Fields</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {templatesQuery.isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            ) : rows.map((t) => (
              <tr key={t.id} className={t.is_active ? "" : "opacity-50"}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3">{categoryLabel(t.category)}</td>
                <td className="px-4 py-3 uppercase text-xs">{t.setting === "both" ? "OPD & IPD" : t.setting}</td>
                <td className="px-4 py-3">{t.fields.length}{t.fields.some((f) => f.required) && <span className="text-slate-400"> ({t.fields.filter((f) => f.required).length} required)</span>}</td>
                <td className="px-4 py-3">{t.is_active ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                  <button onClick={() => setEditing(t)} className="text-xs font-semibold text-emerald-700">Edit</button>
                  <button onClick={() => setEditing({ ...t, id: undefined, name: `${t.name} (copy)` })} className="text-xs font-semibold text-slate-600">Duplicate</button>
                  <button onClick={() => toggle(t)} className="text-xs font-semibold text-slate-600">{t.is_active ? "Deactivate" : "Activate"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <TemplateEditor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
    </div>
  )
}
