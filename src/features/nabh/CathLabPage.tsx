import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { ModuleHub } from "../../components/resource/ModuleHub"
import { admissionField, col, doctorField, opts, patientCol, patientField } from "./fields"

// Cath lab: procedure register with the in-lab clock (sheath in → reperfusion → sheath out),
// findings, device traceability, charge posting and the quality indicators.

const COMPLICATIONS = ["None", "Access-site haematoma", "Retroperitoneal bleed", "Coronary dissection", "No-reflow", "Perforation",
  "Arrhythmia requiring treatment", "Contrast reaction", "Contrast nephropathy", "Stroke / TIA", "Emergency CABG", "Death"]

function KpiPanel() {
  const [k, setK] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get<any>("/cathlab/procedures/kpis/").then(setK).catch((e) => setError(extractApiError(e))) }, [])
  if (error) return <div className="text-sm text-rose-700">{error}</div>
  if (!k) return <div className="text-sm text-slate-500">Loading…</div>
  const cards: [string, string][] = [
    ["Procedures (90 days)", String(k.procedures)],
    ["Primary PCI door-to-device ≤ 90 min", k.primary_pci.within_target_percent != null ? `${k.primary_pci.within_target_percent}%` : "—"],
    ["Median door-to-device", k.primary_pci.median_door_to_device_minutes != null ? `${k.primary_pci.median_door_to_device_minutes} min` : "—"],
    ["Complication rate", k.complication_rate_percent != null ? `${k.complication_rate_percent}%` : "—"],
    ["Radial access", k.radial_access_percent != null ? `${k.radial_access_percent}%` : "—"],
    ["Mean contrast", k.mean_contrast_ml != null ? `${k.mean_contrast_ml} mL` : "—"],
    ["Contrast over safe limit", String(k.contrast_over_limit)],
    ["High radiation dose (≥ 5 Gy)", String(k.high_radiation_dose)],
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([l, v]) => <div key={l} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"><div className="text-xs text-slate-500">{l}</div><div className="text-2xl font-bold">{v}</div></div>)}
      </div>
      <div className="text-sm text-slate-600">{Object.entries(k.by_type).map(([t, n]) => `${t}: ${n}`).join(" · ") || "No completed procedures in this period."}</div>
    </div>
  )
}

export function CathLabPage() {
  return (
    <ModuleHub
      title="Cath Lab"
      subtitle="Coronary & structural procedures — door-to-device timing, contrast and radiation safety, device traceability and billing"
      tabs={[
        {
          key: "procedures", label: "Procedures",
          resource: {
            title: "Procedure register", endpoint: "/cathlab/procedures/", createLabel: "Schedule procedure",
            filters: [{ key: "status", label: "Status", type: "select", options: opts("scheduled", "in_progress", "completed", "abandoned") },
              { key: "procedure_type", label: "Type", type: "select", options: opts("cag", "ptca", "primary_pci", "ppi", "icd_crt", "ep_study", "structural", "peripheral", "other") }],
            columns: [patientCol, col("procedure_type", "Procedure"), col("urgency", "Urgency"), col("operator_name", "Operator"), { key: "status", label: "Status" },
              { key: "door_to_device_minutes", label: "Door→device", render: (r) => (r.door_to_device_minutes != null ? `${r.door_to_device_minutes} min` : "—") },
              { key: "safety_flags", label: "Safety", render: (r) => (r.safety_flags?.length ? <span className="text-amber-700" title={r.safety_flags.join("\n")}>⚠ {r.safety_flags.length}</span> : "—") },
              { key: "finalized_at", label: "Report", render: (r) => (r.finalized_at ? "Final" : "Draft") }],
            fields: [patientField(), admissionField(), { key: "procedure_type", label: "Procedure", type: "select", required: true, options: [
                { value: "cag", label: "Coronary angiography" }, { value: "ptca", label: "PTCA / elective PCI" }, { value: "primary_pci", label: "Primary PCI (STEMI)" },
                { value: "ppi", label: "Permanent pacemaker" }, { value: "icd_crt", label: "ICD / CRT" }, { value: "ep_study", label: "EP study / ablation" },
                { value: "structural", label: "Structural (TAVI / BMV / device closure)" }, { value: "peripheral", label: "Peripheral angiography / plasty" }, { value: "other", label: "Other" }] },
              { key: "urgency", label: "Urgency", type: "select", options: opts("elective", "urgent", "emergency"), defaultValue: "elective" },
              { key: "indication", label: "Indication", required: true }, doctorField("operator", "Operator"), doctorField("assistant", "Assistant", false),
              { key: "procedure_tariff", label: "Procedure tariff (for billing)", type: "fk", source: "/finance/tariff/", sourceLabel: (r) => `${r.code} — ${r.name}` },
              { key: "ed_visit", label: "ED visit (STEMI — door time)", type: "fk", source: "/emergency/ed-visits/", sourceLabel: (r) => `#${r.id} ${r.patient_name ?? ""} ${r.arrived_at ? new Date(String(r.arrived_at)).toLocaleString() : ""}` },
              { key: "scheduled_at", label: "Scheduled for", type: "datetime" }, { key: "weight_kg", label: "Weight (kg)", type: "number" }, { key: "creatinine_mg_dl", label: "Creatinine (mg/dL)", type: "number" }],
            actions: [
              { label: "Sheath in", path: "start/", tone: "primary", show: (r) => r.status === "scheduled" },
              { label: "Reperfusion / first device", path: "reperfusion/", show: (r) => r.status === "in_progress" && !r.device_at },
              { label: "Add device", path: "add-device/", show: (r) => !r.finalized_at, prompt: [
                { key: "kind", label: "Device", type: "select", required: true, options: opts("des", "bms", "balloon", "dcb", "pacemaker", "lead", "occluder", "valve", "other") },
                { key: "brand", label: "Brand", required: true }, { key: "model_name", label: "Model" }, { key: "size", label: "Size (e.g. 3.0 × 28 mm)" },
                { key: "lot_number", label: "Lot number", required: true }, { key: "udi", label: "UDI" }, { key: "serial_number", label: "Serial no." },
                { key: "vessel", label: "Vessel" }, { key: "quantity", label: "Quantity", type: "number", defaultValue: 1 }, { key: "unit_price", label: "Billed price", type: "number" }] },
              { label: "Sheath out", path: "complete/", show: (r) => r.status === "in_progress" },
              { label: "Record findings", path: "", method: "patch", show: (r) => !r.finalized_at, prompt: [
                { key: "access_site", label: "Access site", type: "select", options: opts("right radial", "left radial", "right femoral", "left femoral", "brachial") },
                { key: "sheath_fr", label: "Sheath (Fr)", type: "number" }, { key: "contrast_agent", label: "Contrast agent" }, { key: "contrast_ml", label: "Contrast (mL)", type: "number" },
                { key: "fluoro_minutes", label: "Fluoroscopy (min)", type: "number" }, { key: "air_kerma_mgy", label: "Air kerma (mGy)", type: "number" }, { key: "dap_gy_cm2", label: "DAP (Gy·cm²)", type: "number" },
                { key: "dominance", label: "Dominance", type: "select", options: opts("right", "left", "co-dominant") }, { key: "lv_ef_percent", label: "LV EF %", type: "number" },
                { key: "vessel_findings", label: "Vessel findings (JSON)", type: "json", placeholder: '[{"vessel": "LAD", "segment": "proximal", "stenosis_percent": 90, "timi_flow": 3, "intervention": "DES"}]' },
                { key: "complications", label: `Complications (JSON list) — ${COMPLICATIONS.join(", ")}`, type: "json", placeholder: '["None"]' },
                { key: "conclusion", label: "Conclusion", type: "textarea" }, { key: "recommendation", label: "Recommendation", type: "select", options: opts("medical", "pci", "cabg", "surgery", "other") },
                { key: "delay_reason", label: "Reason for door-to-device delay (primary PCI > 90 min)" }] },
              { label: "Finalise report", path: "finalize/", tone: "primary", confirm: "Finalise and lock this report?", show: (r) => ["completed", "abandoned"].includes(r.status) && !r.finalized_at },
              { label: "Post charges", path: "post-charges/", show: (r) => !!r.admission },
              { label: "Report PDF", path: "report/", method: "get", download: "cath-report.pdf" },
            ],
          },
        },
        { key: "kpis", label: "Quality indicators", render: () => <KpiPanel /> },
      ]}
    />
  )
}
