import { useState } from "react"
import { extractApiError } from "../../api/client"
import { createAnaesthesiaRecord, downloadAnaesthesiaChart, finalizeAnaesthesiaRecord, updateAnaesthesiaRecord } from "../../api/ot"
import { FieldInput } from "../../components/resource/ResourceTable"
import type { AnaesthesiaRecord, AnaesthesiaRow, OTSchedule } from "../../types/api"
import { userField } from "../nabh/fields"
import { UpdatedBy } from "./UpdatedBy"

// Anaesthesia record: vitals many times over the case, drugs, fluids and
// recovery — and the printable chart (MedNet "anaesthesia chart print").

const inputCls = "w-full px-2.5 py-1.5 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-60"
const labelCls = "block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1"

const toLocalInput = (iso?: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)
const nowHHMM = () => new Date().toTimeString().slice(0, 5)

interface Col { key: string; label: string; type?: "time" | "number"; width?: string }

const VITAL_COLS: Col[] = [
  { key: "time", label: "Time", type: "time", width: "w-24" },
  { key: "hr", label: "HR", type: "number" },
  { key: "bp", label: "BP (sys/dia)" },
  { key: "spo2", label: "SpO2 %", type: "number" },
  { key: "etco2", label: "EtCO2", type: "number" },
]
const DRUG_COLS: Col[] = [
  { key: "time", label: "Time", type: "time", width: "w-24" },
  { key: "drug", label: "Drug" },
  { key: "dose", label: "Dose" },
  { key: "route", label: "Route", width: "w-24" },
]
const FLUID_COLS: Col[] = [
  { key: "fluid", label: "Fluid" },
  { key: "volume_ml", label: "Volume (mL)", type: "number", width: "w-32" },
]

function RowsEditor({ title, cols, rows, onChange, newRow }: { title: string; cols: Col[]; rows: AnaesthesiaRow[]; onChange: (r: AnaesthesiaRow[]) => void; newRow: () => AnaesthesiaRow }) {
  const set = (i: number, key: string, value: string, type?: string) => {
    const next = rows.map((r, j) => (j === i ? { ...r, [key]: type === "number" && value !== "" ? Number(value) : value } : r))
    onChange(next)
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-2 dark:text-slate-200">{title}</h3>
        <button type="button" onClick={() => onChange([...rows, newRow()])} className="text-xs font-semibold text-brand dark:text-indigo-300">+ Add row</button>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-ink-4">None yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-4">{cols.map((c) => <th key={c.key} className="text-left font-medium px-1 pb-1">{c.label}</th>)}<th /></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c.key} className={`px-1 py-0.5 ${c.width ?? ""}`}>
                      <input type={c.type ?? "text"} value={String(r[c.key] ?? "")} onChange={(e) => set(i, c.key, e.target.value, c.type)} className={inputCls} aria-label={c.label} />
                    </td>
                  ))}
                  <td className="px-1 w-8">
                    <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-ink-4 hover:text-danger-text" aria-label="Remove row">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function AnaesthesiaRecordModal({ schedule, onClose, onSaved }: { schedule: OTSchedule; onClose: () => void; onSaved: () => void }) {
  const existing = schedule.anaesthesia_record
  const [rec, setRec] = useState<Partial<AnaesthesiaRecord>>(() => ({
    anaesthesia_type: "General anaesthesia",
    anaesthetist: schedule.anaesthetist ?? undefined,
    vitals: [],
    drugs: [],
    fluids: [],
    ...existing,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const locked = !!rec.finalized_at
  const up = (patch: Partial<AnaesthesiaRecord>) => setRec((r) => ({ ...r, ...patch }))

  const clean = (rows: AnaesthesiaRow[] = []) => rows.filter((r) => Object.entries(r).some(([k, v]) => k !== "time" && v !== "" && v !== null))

  const save = async (): Promise<AnaesthesiaRecord | null> => {
    setError(null)
    setNotice(null)
    if (!rec.anaesthetist) {
      setError("Choose the anaesthetist.")
      return null
    }
    const body: Partial<AnaesthesiaRecord> = {
      ...rec,
      vitals: clean(rec.vitals),
      drugs: clean(rec.drugs),
      fluids: clean(rec.fluids),
    }
    if (locked) {
      delete body.anaesthesia_type
      delete body.intra_op_notes
    }
    setBusy(true)
    try {
      const saved = rec.id ? await updateAnaesthesiaRecord(rec.id, body) : await createAnaesthesiaRecord({ ...body, ot_schedule: schedule.id, anaesthesia_type: body.anaesthesia_type ?? "", anaesthetist: rec.anaesthetist })
      setRec(saved)
      setNotice("Saved.")
      onSaved()
      return saved
    } catch (e) {
      setError(extractApiError(e))
      return null
    } finally {
      setBusy(false)
    }
  }

  const finalize = async () => {
    if (!confirm("Finalise the anaesthesia record? The anaesthesia type and notes are then locked.")) return
    const saved = await save()
    if (!saved) return
    try {
      setRec(await finalizeAnaesthesiaRecord(saved.id))
      setNotice("Finalised.")
      onSaved()
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  const print = async () => {
    const saved = await save()
    if (!saved) return
    try {
      const url = URL.createObjectURL(await downloadAnaesthesiaChart(saved.id))
      window.open(url, "_blank", "noopener")
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-4xl w-full max-h-[92vh] overflow-y-auto rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Anaesthesia record</h2>
            <p className="text-sm text-ink-4">{schedule.operation_theatre_room} · {new Date(schedule.scheduled_start).toLocaleString()}{locked ? " · finalised" : ""}</p>
          </div>
          <button onClick={onClose} className="text-ink-4 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={labelCls}>Anaesthetist</label>
            <FieldInput field={userField("anaesthetist", "Anaesthetist", true)} value={rec.anaesthetist} onChange={(v) => up({ anaesthetist: v ? Number(v) : undefined })} />
          </div>
          <div>
            <label className={labelCls}>Anaesthesia type</label>
            <input className={inputCls} disabled={locked} value={rec.anaesthesia_type ?? ""} onChange={(e) => up({ anaesthesia_type: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>ASA grade</label>
            <select className={inputCls} value={rec.asa_grade ?? ""} onChange={(e) => up({ asa_grade: e.target.value })}>
              <option value="">—</option>
              {["I", "II", "III", "IV", "V", "VI", "IE", "IIE", "IIIE", "IVE", "VE"].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Airway device</label>
            <input className={inputCls} placeholder="ETT 7.5, LMA 4, face mask…" value={rec.airway_device ?? ""} onChange={(e) => up({ airway_device: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Induction</label>
            <input type="datetime-local" className={inputCls} value={toLocalInput(rec.induction_at)} onChange={(e) => up({ induction_at: fromLocalInput(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Reversal</label>
            <input type="datetime-local" className={inputCls} value={toLocalInput(rec.reversal_at)} onChange={(e) => up({ reversal_at: fromLocalInput(e.target.value) })} />
          </div>
        </div>

        <RowsEditor title="Vitals" cols={VITAL_COLS} rows={rec.vitals ?? []} onChange={(vitals) => up({ vitals })} newRow={() => ({ time: nowHHMM() })} />
        <RowsEditor title="Drugs" cols={DRUG_COLS} rows={rec.drugs ?? []} onChange={(drugs) => up({ drugs })} newRow={() => ({ time: nowHHMM(), route: "IV" })} />
        <RowsEditor title="Fluids" cols={FLUID_COLS} rows={rec.fluids ?? []} onChange={(fluids) => up({ fluids })} newRow={() => ({ fluid: "" })} />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Blood loss (mL)</label>
            <input type="number" min={0} className={inputCls} value={rec.estimated_blood_loss_ml ?? ""} onChange={(e) => up({ estimated_blood_loss_ml: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Urine output (mL)</label>
            <input type="number" min={0} className={inputCls} value={rec.urine_output_ml ?? ""} onChange={(e) => up({ urine_output_ml: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Aldrete score</label>
            <input type="number" min={0} max={10} className={inputCls} value={rec.recovery_aldrete_score ?? ""} onChange={(e) => up({ recovery_aldrete_score: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Shifted to</label>
            <input className={inputCls} placeholder="Recovery / ICU / ward" value={rec.shifted_to ?? ""} onChange={(e) => up({ shifted_to: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Complications</label>
            <textarea rows={2} className={inputCls} value={rec.complications ?? ""} onChange={(e) => up({ complications: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Intra-operative notes</label>
            <textarea rows={2} className={inputCls} disabled={locked} value={rec.intra_op_notes ?? ""} onChange={(e) => up({ intra_op_notes: e.target.value })} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {error && <span className="mr-auto text-sm text-danger-text">{error}</span>}
          {notice && !error && <span className="mr-auto text-sm text-success-text">{notice}</span>}
          {!error && !notice && <UpdatedBy name={rec.updated_by_name} at={rec.updated_at} className="mr-auto" />}
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-ink-4">Close</button>
          <button type="button" disabled={busy} onClick={print} className="px-4 py-2 text-sm font-medium rounded-lg border border-border-strong dark:border-slate-600 disabled:opacity-50">Print chart</button>
          {!locked && <button type="button" disabled={busy} onClick={finalize} className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-tint text-brand-dark disabled:opacity-50">Finalise</button>}
          <button type="button" disabled={busy} onClick={save} className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  )
}
