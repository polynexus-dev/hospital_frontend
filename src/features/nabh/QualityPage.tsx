import { useEffect, useState } from "react"
import { api } from "../../api/client"
import { ModuleHub } from "../../components/resource/ModuleHub"
import { col, opts, patientCol, patientField } from "./fields"
import { KPIDashboard } from "./KPIDashboard"

function MedErrorDashboard() {
  const [d, setD] = useState<any>(null)
  useEffect(() => {
    api.get("/quality/medication-errors/dashboard/").then(setD).catch(() => setD(null))
  }, [])
  if (!d) return <div className="text-sm text-slate-500">Loading…</div>
  const tile = (label: string, v: unknown) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{String(v ?? "—")}</div>
    </div>
  )
  const bars = (title: string, obj: Record<string, number>) => {
    const max = Math.max(1, ...Object.values(obj))
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="text-sm font-semibold mb-3">{title}</div>
        {Object.entries(obj).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs mb-1.5">
            <span className="w-28 text-slate-600 truncate">{k.replace(/_/g, " ")}</span>
            <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded h-2"><div className="bg-rose-500 h-2 rounded" style={{ width: `${(v * 100) / max}%` }} /></div>
            <span className="w-6 text-right">{v}</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tile("Medication errors", d.total)}
        {tile("Near misses (A–B)", d.near_misses)}
        {tile("Harmful (E–I)", d.harmful)}
        {tile("Error rate %", d.error_rate?.value)}
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {bars("By stage", d.by_stage)}
        {bars("By type", d.by_type)}
        {bars("By NCC MERP category", d.by_category)}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="text-sm font-semibold mb-2">Monthly trend</div>
        <div className="flex items-end gap-2 h-32">
          {d.by_month.map((m: any) => (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end">
              <div className="w-full bg-sky-500 rounded-t" style={{ height: `${(m.count * 100) / Math.max(1, ...d.by_month.map((x: any) => x.count))}%` }} />
              <span className="text-[10px] text-slate-500 mt-1">{m.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function QualityPage() {
  return (
    <ModuleHub
      title="Patient Safety & Quality"
      subtitle="NABH COP.8.c, COP.4.d, MOM.4, IMS.2 — incidents, medication errors, emergency codes, drills, checklists and KPIs"
      tabs={[
        { key: "kpis", label: "NABH KPIs", render: () => <KPIDashboard /> },
        {
          key: "incidents",
          label: "Incidents",
          resource: {
            title: "Incident & sentinel event register", endpoint: "/quality/incidents/", createLabel: "Report incident",
            filters: [{ key: "is_sentinel", label: "Sentinel", type: "select", options: [{ value: "true", label: "Sentinel only" }] }],
            columns: [col("occurred_at", "When"), col("incident_type", "Type"), { key: "harm", label: "Harm" }, col("is_sentinel", "Sentinel"), patientCol, col("location", "Where"), { key: "status", label: "Status" }],
            fields: [{ key: "incident_type", label: "Type", type: "select", required: true, options: opts("fall", "medication_error", "adr", "transfusion_reaction", "pressure_ulcer", "wrong_site", "retained_item", "needlestick", "equipment", "identification", "diagnostic", "violence", "unexpected_death", "other") },
              { key: "harm", label: "Harm", type: "select", options: opts("near_miss", "no_harm", "mild", "moderate", "severe", "death"), defaultValue: "no_harm" },
              patientField(false), { key: "location", label: "Location" }, { key: "occurred_at", label: "When", type: "datetime" },
              { key: "description", label: "What happened", type: "textarea", required: true }, { key: "immediate_action", label: "Immediate action", type: "textarea" },
              { key: "is_anonymous", label: "Report anonymously", type: "boolean" }],
            actions: [
              {
                label: "RCA / CAPA", path: "", method: "patch",
                prompt: [{ key: "root_cause", label: "Root cause", type: "textarea", required: true }, { key: "corrective_action", label: "Corrective action", type: "textarea" },
                  { key: "preventive_action", label: "Preventive action", type: "textarea" }, { key: "capa_due", label: "CAPA due", type: "date" },
                  { key: "status", label: "Status", type: "select", options: opts("investigating", "rca_done") }],
                show: (r) => r.status !== "closed",
              },
              { label: "Close", path: "close/", tone: "primary", confirm: "Close this incident?", show: (r) => r.status !== "closed" },
            ],
            toolbar: [{ label: "Dashboard", path: "dashboard/", method: "get" }],
          },
        },
        { key: "med-dash", label: "Medication error dashboard", render: () => <MedErrorDashboard /> },
        {
          key: "med-errors",
          label: "Medication errors",
          resource: {
            title: "Medication errors (opens an incident for RCA)", endpoint: "/quality/medication-errors/", createLabel: "Report medication error",
            columns: [col("occurred_at", "When"), col("medication", "Medication"), col("stage", "Stage"), col("error_type", "Type"), col("category", "NCC MERP"), patientCol],
            fields: [patientField(false), { key: "medication", label: "Medication", required: true },
              { key: "stage", label: "Stage", type: "select", options: opts("prescribing", "transcribing", "dispensing", "administration", "monitoring"), required: true },
              { key: "error_type", label: "Error type", type: "select", options: opts("wrong_drug", "wrong_dose", "wrong_route", "wrong_time", "wrong_patient", "allergy", "interaction", "lasa", "abbreviation", "expired", "other"), required: true },
              { key: "category", label: "NCC MERP category", type: "select", options: opts("A", "B", "C", "D", "E", "F", "G", "H", "I"), defaultValue: "C" },
              { key: "prescribed", label: "Intended" }, { key: "actual", label: "Actual" }, { key: "description", label: "Description", type: "textarea" }],
          },
        },
        {
          key: "codes",
          label: "Emergency codes",
          resource: {
            title: "Code activations", endpoint: "/quality/code-activations/", createLabel: "Activate code",
            description: "Activating a code alerts every configured responder immediately; responders tap Respond to log arrival.",
            columns: [col("code_name", "Code"), col("location", "Location"), col("activated_at", "Activated"), col("is_drill", "Drill"), col("first_response_minutes", "1st response (min)"),
              { key: "responses", label: "Responders", render: (r) => (r.responses ?? []).map((x: any) => x.staff).join(", ") || "—" }, { key: "status", label: "Status" }],
            fields: [{ key: "code", label: "Code", type: "fk", source: "/quality/emergency-codes/", sourceLabel: (r) => `${r.code} — ${r.meaning}`, required: true },
              { key: "location", label: "Location", required: true }, patientField(false), { key: "is_drill", label: "This is a drill", type: "boolean" }],
            actions: [
              { label: "Respond", path: "respond/", tone: "primary", prompt: [{ key: "role", label: "Your role" }], show: (r) => r.status === "active" },
              { label: "Close", path: "close/", prompt: [{ key: "outcome", label: "Outcome", type: "textarea" }], show: (r) => r.status === "active" },
            ],
          },
        },
        {
          key: "code-setup",
          label: "Code setup",
          resource: {
            title: "Emergency code definitions", endpoint: "/quality/emergency-codes/", createLabel: "New code",
            columns: [col("code", "Code"), col("color", "Colour"), col("meaning", "Meaning"), col("responder_roles", "Responder roles"), col("target_response_minutes", "Target (min)")],
            fields: [{ key: "code", label: "Code", required: true }, { key: "color", label: "Colour", required: true }, { key: "meaning", label: "Meaning", required: true },
              { key: "protocol", label: "Protocol", type: "textarea" }, { key: "responder_roles", label: "Responder role templates (JSON)", type: "json", placeholder: '["doctor", "nurse"]' },
              { key: "responders", label: "Named responders", type: "multifk", source: "/users/", sourceLabel: (r) => String(r.email ?? "") }, { key: "target_response_minutes", label: "Target minutes", type: "number", defaultValue: 5 }],
          },
        },
        {
          key: "drills",
          label: "Mock drills",
          resource: {
            title: "Mock drills", endpoint: "/quality/mock-drills/", createLabel: "Record drill",
            columns: [col("drill_date", "Date"), col("location", "Location"), col("variations_observed", "Variations"), col("observations", "Observations"), col("corrective_actions", "Corrective actions")],
            fields: [{ key: "code", label: "Code", type: "fk", source: "/quality/emergency-codes/", sourceLabel: "code" }, { key: "drill_date", label: "Date", type: "date" }, { key: "location", label: "Location" },
              { key: "variations_observed", label: "Variations observed", type: "number", defaultValue: 0 }, { key: "observations", label: "Observations", type: "textarea" }, { key: "corrective_actions", label: "Corrective actions", type: "textarea" }],
          },
        },
        {
          key: "checklists",
          label: "Checklists",
          resource: {
            title: "Checklist runs (crash cart, emergency protocols, stock audits)", endpoint: "/quality/checklist-runs/", createLabel: "Record checklist",
            columns: [col("template_name", "Checklist"), col("location", "Location"), col("completed_at", "Completed"), { key: "all_passed", label: "Result", render: (r) => (r.all_passed ? "All passed" : "Gaps found") }],
            fields: [{ key: "template", label: "Checklist", type: "fk", source: "/quality/checklist-templates/", required: true }, { key: "location", label: "Location" },
              { key: "responses", label: "Responses (JSON)", type: "json", required: true, placeholder: '[{"text": "Defibrillator charged", "checked": true}]' }],
          },
        },
        {
          key: "manual-kpi",
          label: "KPI audit entries",
          resource: {
            title: "Manual / audit KPI data", endpoint: "/quality/kpi-manual-entries/", createLabel: "Enter audit data",
            columns: [col("kpi_code", "KPI"), col("period_start", "From"), col("period_end", "To"), col("numerator", "Num"), col("denominator", "Den"), col("notes", "Notes")],
            fields: [{ key: "kpi_code", label: "KPI code (e.g. K03)", required: true }, { key: "period_start", label: "From", type: "date", required: true }, { key: "period_end", label: "To", type: "date", required: true },
              { key: "numerator", label: "Numerator", type: "number", required: true }, { key: "denominator", label: "Denominator", type: "number", required: true }, { key: "notes", label: "Notes", type: "textarea" }],
          },
        },
      ]}
    />
  )
}
