import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, extractApiError } from "../../api/client"
import { Button } from "../../components/ui/Button"

// OPD triage (MedNet "Triage" band): the nurse records chief complaint,
// vitals, pain score and priority after check-in; the doctor sees it at the
// top of the consultation and corrects it in place, without leaving the
// screen. Every save records who changed it and when.

export interface OPDTriage {
  id: number
  encounter: number
  chief_complaint: string
  complaint_duration: string
  respiratory_rate: number | null
  blood_sugar_mg_dl: number | null
  pain_score: number | null
  pain_level: string
  allergies_checked: boolean
  priority: "normal" | "urgent" | "emergency"
  notes: string
  height_cm: string | null
  weight_kg: string | null
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse: number | null
  temperature_c: string | null
  spo2: number | null
  recorded_by_name: string
  updated_by_name: string
  created_at: string
  updated_at: string
}

type Draft = Record<string, string | boolean>

const NUMERIC = ["bp_systolic", "bp_diastolic", "pulse", "temperature_c", "spo2", "respiratory_rate", "height_cm", "weight_kg", "blood_sugar_mg_dl", "pain_score"] as const
const FIELDS: { key: (typeof NUMERIC)[number]; label: string }[] = [
  { key: "bp_systolic", label: "BP sys" }, { key: "bp_diastolic", label: "BP dia" }, { key: "pulse", label: "Pulse" },
  { key: "temperature_c", label: "Temp °C" }, { key: "spo2", label: "SpO₂ %" }, { key: "respiratory_rate", label: "Resp. rate" },
  { key: "height_cm", label: "Height cm" }, { key: "weight_kg", label: "Weight kg" }, { key: "blood_sugar_mg_dl", label: "RBS mg/dL" },
]
const PAIN_WORDS = ["No pain", "Very mild", "Minor", "Noticeable", "Moderate", "Moderately strong", "Moderately stronger", "Strong", "Very strong", "Very hard to bear", "Worst possible"]
const PRIORITY_TONE: Record<OPDTriage["priority"], string> = {
  normal: "bg-chip-bg text-ink-3", urgent: "bg-warning-bg text-warning-text", emergency: "bg-danger-bg text-danger-text",
}
const input = "w-full h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] bg-white dark:bg-slate-900"

function toDraft(t: OPDTriage | null): Draft {
  const d: Draft = {
    chief_complaint: t?.chief_complaint ?? "", complaint_duration: t?.complaint_duration ?? "", notes: t?.notes ?? "",
    priority: t?.priority ?? "normal", allergies_checked: t?.allergies_checked ?? false,
  }
  for (const k of NUMERIC) d[k] = t?.[k] != null ? String(t[k]) : ""
  return d
}

function toPayload(d: Draft) {
  const out: Record<string, unknown> = { ...d }
  for (const k of NUMERIC) out[k] = d[k] === "" ? null : Number(d[k])
  return out
}

export function TriageCard({ encounterId }: { encounterId: number }) {
  const qc = useQueryClient()
  const key = ["opd-triage", encounterId]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<{ results: OPDTriage[] }>(`/opd/triage/?encounter=${encounterId}`) })
  const triage = q.data?.results?.[0] ?? null
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(toDraft(null))
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => triage
      ? api.patch<OPDTriage>(`/opd/triage/${triage.id}/`, toPayload(draft))
      : api.post<OPDTriage>("/opd/triage/", { encounter: encounterId, ...toPayload(draft) }),
    onSuccess: () => {
      setEditing(false)
      setError(null)
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ["opd-vitals", encounterId] })
    },
    onError: (e) => setError(extractApiError(e)),
  })

  const start = () => { setDraft(toDraft(triage)); setEditing(true) }
  const set = (k: string, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }))

  if (q.isLoading) return null

  if (!editing) {
    if (!triage) {
      return (
        <div className="rounded-lg border border-dashed border-border px-3 py-2 flex items-center justify-between gap-3">
          <div className="text-[12.5px] text-ink-4">Triage not done yet — chief complaint, vitals, pain score and priority.</div>
          <Button size="sm" variant="secondary" onClick={start}>Record triage</Button>
        </div>
      )
    }
    const vit = [
      triage.bp_systolic != null && `BP ${triage.bp_systolic}/${triage.bp_diastolic ?? "–"}`, triage.pulse != null && `P ${triage.pulse}`,
      triage.temperature_c != null && `${triage.temperature_c}°C`, triage.spo2 != null && `SpO₂ ${triage.spo2}%`,
      triage.respiratory_rate != null && `RR ${triage.respiratory_rate}`, triage.weight_kg != null && `${triage.weight_kg} kg`,
      triage.blood_sugar_mg_dl != null && `RBS ${triage.blood_sugar_mg_dl}`,
    ].filter(Boolean)
    const edited = triage.updated_by_name && triage.updated_at !== triage.created_at
    return (
      <div className="rounded-lg border border-border bg-page/60 px-3 py-2 space-y-1" aria-label="Triage">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] uppercase tracking-[.06em] font-semibold text-ink-4">Triage</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${PRIORITY_TONE[triage.priority]}`}>{triage.priority}</span>
            {triage.pain_score != null && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${triage.pain_score >= 7 ? "bg-danger-bg text-danger-text" : triage.pain_score >= 4 ? "bg-warning-bg text-warning-text" : "bg-chip-bg"}`}>
                Pain {triage.pain_score}/10 · {PAIN_WORDS[triage.pain_score]}
              </span>
            )}
            {triage.allergies_checked && <span className="text-[11px] text-success-text">Allergies checked</span>}
          </div>
          <Button size="sm" variant="ghost" onClick={start}>Edit</Button>
        </div>
        {triage.chief_complaint && <div className="text-[12.5px]"><b>Complaint:</b> {triage.chief_complaint}{triage.complaint_duration ? ` · ${triage.complaint_duration}` : ""}</div>}
        {vit.length > 0 && <div className="text-[12px] text-ink-3">{vit.join(" · ")}</div>}
        {triage.notes && <div className="text-[12px] text-ink-3">{triage.notes}</div>}
        <div className="text-[11px] text-ink-5">
          By {triage.recorded_by_name || "—"} at {new Date(triage.created_at).toLocaleString()}
          {edited ? ` · last edited by ${triage.updated_by_name} at ${new Date(triage.updated_at).toLocaleString()}` : ""}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-brand/40 px-3 py-2.5 space-y-2" aria-label="Triage form">
      <div className="text-[10.5px] uppercase tracking-[.06em] font-semibold text-ink-4">{triage ? "Edit triage" : "Record triage"}</div>
      <div className="grid grid-cols-4 gap-1.5">
        <input className={`${input} col-span-3`} placeholder="Chief complaint" value={String(draft.chief_complaint)} onChange={(e) => set("chief_complaint", e.target.value)} />
        <input className={input} placeholder="Since (e.g. 3 days)" value={String(draft.complaint_duration)} onChange={(e) => set("complaint_duration", e.target.value)} />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {FIELDS.map((f) => (
          <label key={f.key} className="text-[11px] text-ink-4">{f.label}
            <input className={input} inputMode="decimal" value={String(draft[f.key])} onChange={(e) => set(f.key, e.target.value)} />
          </label>
        ))}
        <label className="text-[11px] text-ink-4">Pain (0-10)
          <select className={input} value={String(draft.pain_score)} onChange={(e) => set("pain_score", e.target.value)}>
            <option value="">—</option>
            {PAIN_WORDS.map((w, n) => <option key={n} value={n}>{n} · {w}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[11px] text-ink-4">Priority
          <select className={`${input} w-44`} value={String(draft.priority)} onChange={(e) => set("priority", e.target.value)}>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent — see soon</option>
            <option value="emergency">Emergency — see now</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] mt-3">
          <input type="checkbox" checked={Boolean(draft.allergies_checked)} onChange={(e) => set("allergies_checked", e.target.checked)} /> Allergies asked and checked
        </label>
      </div>
      <textarea className="w-full border border-border rounded-control p-2 text-[12.5px]" rows={2} placeholder="Notes" value={String(draft.notes)} onChange={(e) => set("notes", e.target.value)} />
      {error && <div className="text-[12px] text-danger-text">{error}</div>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save triage"}</Button>
      </div>
    </div>
  )
}
