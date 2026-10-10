// Mirrors apps/licensing/features.py (FEATURES) in the backend.
export const LICENCE_FEATURES = [
  { key: "hms_core", label: "HMS core (OPD, IPD, beds, billing)" },
  { key: "crm", label: "CRM (enquiries, call queue, callbacks, follow-ups)" },
  { key: "erp", label: "ERP (inventory, pharmacy, procurement, accounts)" },
  { key: "mis", label: "MIS (dashboards, reports)" },
  { key: "whatsapp", label: "WhatsApp messaging" },
  { key: "ivr", label: "IVR integration" },
  { key: "ai_assist", label: "AI assist (local models)" },
  { key: "nabh", label: "NABH reporting" },
  { key: "multi_branch", label: "Multi-branch" },
  { key: "patient_portal", label: "Patient portal" },
  { key: "api_access", label: "API access" },
] as const

export function featureLabel(key: string) {
  return LICENCE_FEATURES.find((f) => f.key === key)?.label ?? key
}
