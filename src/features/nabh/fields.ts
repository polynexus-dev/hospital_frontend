import type { ColumnDef, FieldDef } from "../../components/resource/ResourceTable"

// Shared field/column building blocks for the NABH module configs.

export const patientLabel = (r: Record<string, any>) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() + (r.uhid ? ` · ${r.uhid}` : "")

export const patientField = (required = true): FieldDef => ({ key: "patient", label: "Patient", type: "fk", source: "/patients/", sourceLabel: patientLabel, required })
export const admissionField = (required = false): FieldDef => ({
  key: "admission", label: "Admission", type: "fk", source: "/ipd/admissions/?status=admitted", required,
  sourceLabel: (r) => `#${r.id} ${r.patient_name ?? ""} ${r.bed_label ?? ""}`,
})
export const userField = (key: string, label: string, required = false): FieldDef => ({
  key, label, type: "fk", source: "/users/", required, sourceLabel: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || String(r.email ?? ""),
})
export const doctorField = (key = "doctor", label = "Doctor", required = true): FieldDef => ({ key, label, type: "fk", source: "/doctors/", required })

export const patientCol: ColumnDef = { key: "patient_name", label: "Patient", render: (r) => `${r.patient_name ?? "—"}${r.patient_uhid ? ` (${r.patient_uhid})` : ""}` }
export const col = (key: string, label: string): ColumnDef => ({ key, label })

export const opts = (...values: string[]) => values
