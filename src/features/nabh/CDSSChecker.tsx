import { useState } from "react"
import { api, extractApiError } from "../../api/client"
import { FieldInput, StatusPill } from "../../components/resource/ResourceTable"
import { patientField } from "./fields"

interface Alert {
  alert_type: string
  severity: string
  title: string
  message: string
}

/** Run the CDSS (allergy, interaction, duplicate, contraindication, high-risk/LASA/restricted) before prescribing. */
export function CDSSChecker() {
  const [patient, setPatient] = useState<unknown>(null)
  const [meds, setMeds] = useState("")
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const medications = meds.split("\n").map((m) => m.trim()).filter(Boolean).map((name) => ({ name }))
      const res = await api.post<{ alerts: Alert[] }>("/clinical/cdss/check/", { patient, medications, persist: true })
      setAlerts(res.alerts)
    } catch (e) {
      setError(extractApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4">
        <h2 className="text-lg font-bold text-ink dark:text-slate-100">Prescription safety check</h2>
        <p className="text-sm text-ink-4">Checks the proposed medicines against the patient's allergies, current medicines, diagnoses and the formulary flags. Alerts are logged to the patient's record.</p>
        <div>
          <label className="block text-xs font-semibold text-ink-3 mb-1">Patient</label>
          <FieldInput field={patientField()} value={patient} onChange={setPatient} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-3 mb-1">Proposed medicines (one per line)</label>
          <textarea className="w-full px-3 py-2 text-sm border border-border-strong rounded-lg bg-white dark:bg-slate-900" rows={6} value={meds} onChange={(e) => setMeds(e.target.value)} placeholder={"Amoxicillin 500mg\nAspirin 75mg"} />
        </div>
        <button disabled={!patient || !meds.trim() || busy} onClick={run} className="px-4 py-2 text-sm font-medium text-white bg-success hover:bg-success-text rounded-lg disabled:opacity-50">
          {busy ? "Checking…" : "Check"}
        </button>
        {error && <div className="text-sm text-danger-text bg-danger-bg rounded-lg p-3">{error}</div>}
      </div>
      <div className="space-y-3">
        {alerts === null ? null : alerts.length === 0 ? (
          <div className="rounded-xl p-5 bg-success-bg text-success-text dark:bg-emerald-950 dark:text-emerald-300 text-sm font-semibold">No safety issues found.</div>
        ) : (
          alerts.map((a, i) => (
            <div key={i} className={`rounded-xl p-4 border ${a.severity === "critical" ? "border-danger-border bg-danger-bg dark:bg-rose-950" : "border-warning/30 bg-warning-bg dark:bg-amber-950"}`}>
              <div className="flex items-center gap-2 mb-1">
                <StatusPill value={a.severity} />
                <span className="text-xs uppercase text-ink-4">{a.alert_type.replace(/_/g, " ")}</span>
              </div>
              <div className="font-semibold text-ink dark:text-slate-100">{a.title}</div>
              <div className="text-sm text-ink-2 dark:text-slate-300">{a.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
