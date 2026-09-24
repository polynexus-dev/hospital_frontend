export interface NavItem {
  key: string
  moduleKey?: string | string[]
  path: string
  labelKey: string
  subKey: string
  requiredPermission?: string | string[]
}

// Platform-operator nav — rendered only for is_saas_admin/is_superuser
// accounts (see Shell.tsx) and route-guarded by RequireSaaSAdmin. These
// two entries pointed at /admin and /dashboard (ordinary hospital pages)
// for as long as there was no SaaS console to link to, and nothing
// rendered them; they now point at the real one. `requiredPermission` is
// deliberately unset — this surface is gated by a user flag, not a Django
// model permission (no role template grants one; see RequireSaaSAdmin).
export const saasNav: NavItem[] = [
  { key: "saas-overview", path: "/saas?tab=overview", labelKey: "Platform Overview", subKey: "Multi-tenant health & adoption" },
  { key: "saas-tenants", path: "/saas?tab=subscriptions", labelKey: "Tenants & Subscriptions", subKey: "Hospital onboarding & module flags" },
  { key: "saas-invoices", path: "/saas?tab=invoices", labelKey: "Billing & Invoices", subKey: "Platform subscription invoices" },
  { key: "saas-usage", path: "/saas?tab=usage", labelKey: "Usage & Telemetry", subKey: "API usage & database storage" },
  { key: "saas-tickets", path: "/saas?tab=tickets", labelKey: "Support Tickets", subKey: "Help requests from hospital tenants" },
]

export const dailyWorkNav: NavItem[] = [
  { key: "console", moduleKey: "telephony", path: "/console", labelKey: "nav.console", subKey: "screenSub.console" },
  { key: "callbacks", moduleKey: "telephony", path: "/callbacks", labelKey: "nav.callbacks", subKey: "screenSub.callbacks" },
  { key: "enquiries", moduleKey: "enquiries", path: "/enquiries", labelKey: "nav.enquiries", subKey: "screenSub.enquiries" },
  { key: "patients", path: "/patients", labelKey: "nav.patients", subKey: "screenSub.patients" },
  { key: "appointments", path: "/appointments", labelKey: "nav.appointments", subKey: "screenSub.appointments" },
  { key: "inbox", moduleKey: "inbox", path: "/inbox", labelKey: "nav.inbox", subKey: "screenSub.inbox" },
  { key: "dashboard", path: "/dashboard", labelKey: "nav.dashboard", subKey: "screenSub.dashboard" },
]

export const careNav: NavItem[] = [
  { key: "ipd", moduleKey: "ipd", path: "/ipd", labelKey: "nav.ipd", subKey: "screenSub.ipd", requiredPermission: "ipd.view_admission" },
  {
    key: "diagnostics",
    // Combined lab+radiology screen — gated on either module being
    // enabled and either role's view permission, not "diagnostics"
    // (never a real module key, so this was permanently hidden before).
    moduleKey: ["laboratory", "radiology"],
    path: "/diagnostics",
    labelKey: "Diagnostics",
    subKey: "Lab & Radiology Orders",
    requiredPermission: ["laboratory.view_laborder", "radiology.view_radiologyorder"],
  },
  { key: "pharmacy", moduleKey: "pharmacy", path: "/pharmacy", labelKey: "Pharmacy", subKey: "Medicines & Dispensing", requiredPermission: "pharmacy.view_medicine" },
  { key: "emergency", moduleKey: "emergency", path: "/emergency", labelKey: "Emergency / Triage", subKey: "Emergency Department", requiredPermission: "emergency.view_edvisit" },
  { key: "ot", moduleKey: "ot", path: "/ot", labelKey: "Operation Theatre", subKey: "OT Schedules & Notes", requiredPermission: "ot.view_surgeryrequest" },
  { key: "icu", moduleKey: "icu", path: "/icu", labelKey: "ICU Care", subKey: "ICU Monitoring", requiredPermission: "icu.view_icuadmission" },
  { key: "bloodbank", moduleKey: "bloodbank", path: "/bloodbank", labelKey: "Blood Bank", subKey: "Blood Units & Transfusion", requiredPermission: "bloodbank.view_bloodunit" },
]

// NABH HIS/EMR modules. Most follow a licensable module (moduleKey, switched
// per hospital in the SaaS console); Clinical Safety and Clinical Templates
// are always on — every clinical module depends on them.
export const nabhCareNav: NavItem[] = [
  { key: "inpatient-flow", moduleKey: "ipd", path: "/inpatient-flow", labelKey: "Inpatient Flow", subKey: "Bed board, discharge planning", requiredPermission: "ipd.view_admission" },
  { key: "clinical-safety", path: "/clinical-safety", labelKey: "Clinical Safety", subKey: "Alerts, CDSS, assessments, consent", requiredPermission: "clinical.view_clinicalalert" },
  { key: "infection-control", moduleKey: "infection_control", path: "/infection-control", labelKey: "Infection Control", subKey: "HAI, antimicrobials, exposures", requiredPermission: "infection_control.view_haiincident" },
  { key: "telemedicine", moduleKey: "telemedicine", path: "/telemedicine", labelKey: "Telemedicine", subKey: "Video consultations", requiredPermission: "telemedicine.view_teleconsultation" },
  { key: "queue", moduleKey: "queue", path: "/queue", labelKey: "Queue & Tokens", subKey: "Counters, tokens, TV display", requiredPermission: "queue_mgmt.view_queuetoken" },
  { key: "cathlab", moduleKey: "cathlab", path: "/cathlab", labelKey: "Cath Lab", subKey: "PCI, devices, door-to-device", requiredPermission: "cathlab.view_cathprocedure" },
  { key: "oncology", moduleKey: "oncology", path: "/oncology", labelKey: "Oncology", subKey: "Chemo, RT, tumour boards", requiredPermission: "oncology.view_cancercase" },
  { key: "dietary", moduleKey: "dietary", path: "/dietary", labelKey: "Dietary & Kitchen", subKey: "Diet orders, trays", requiredPermission: "dietary.view_dietorder" },
  { key: "pharmacy-safety", moduleKey: "pharmacy", path: "/pharmacy-safety", labelKey: "Medication Safety", subKey: "Recalls, reconciliation, emergency drugs", requiredPermission: "pharmacy.view_medicine" },
  { key: "diagnostics-setup", moduleKey: ["laboratory", "radiology"], path: "/diagnostics-setup", labelKey: "Diagnostics Setup", subKey: "Templates, analysers, imaging slots", requiredPermission: ["laboratory.view_labtest", "radiology.view_radiologyprocedure"] },
  { key: "clinical-templates", path: "/clinical-templates", labelKey: "Clinical Templates", subKey: "Specialty forms & builder", requiredPermission: "clinical.view_assessmenttemplate" },
  { key: "mrd", moduleKey: "mrd", path: "/mrd", labelKey: "Medical Records", subKey: "Files, ICD-10 coding", requiredPermission: "mrd.view_medicalrecordfile" },
]

export const nabhOpsNav: NavItem[] = [
  { key: "quality", moduleKey: "quality", path: "/quality", labelKey: "Quality & KPIs", subKey: "Incidents, NABH KPIs", requiredPermission: "quality.view_safetyincident" },
  { key: "schemes", moduleKey: "schemes", path: "/schemes", labelKey: "Govt Schemes", subKey: "PM-JAY, CGHS, ECHS claims", requiredPermission: "schemes.view_schemecase" },
  { key: "accounts", moduleKey: "finance", path: "/accounts", labelKey: "Accounts & Tally", subKey: "Payables, GST, insurance", requiredPermission: "finance.view_vendorinvoice" },
  { key: "procurement", moduleKey: "inventory", path: "/procurement", labelKey: "Procurement", subKey: "GRN, indents, suppliers", requiredPermission: "inventory.view_goodsreceiptnote" },
  { key: "hr-talent", moduleKey: "hr", path: "/hr-talent", labelKey: "Payroll & Talent", subKey: "Payroll, roster, training", requiredPermission: "hr.view_payrollrun" },
  { key: "support-services", moduleKey: "support_services", path: "/support-services", labelKey: "Support Services", subKey: "Ambulance, CSSD, housekeeping, equipment", requiredPermission: "support_services.view_ambulancetrip" },
  { key: "consultation-time", moduleKey: "opd", path: "/consultation-time", labelKey: "Consultation Time", subKey: "Minutes per patient, by doctor", requiredPermission: "appointments.view_appointment" },
  { key: "predictive", moduleKey: "predictive", path: "/predictive", labelKey: "Predictive Analytics", subKey: "Forecasts & risk", requiredPermission: "analytics.view_dailymislog" },
]

export const growthNav: NavItem[] = [
  { key: "referrals", moduleKey: "referrals", path: "/referrals", labelKey: "nav.referrals", subKey: "screenSub.referrals" },
  { key: "packages", moduleKey: "packages", path: "/packages", labelKey: "nav.packages", subKey: "screenSub.packages" },
  { key: "tpa", moduleKey: "tpa", path: "/tpa", labelKey: "nav.tpa", subKey: "screenSub.tpa" },
  { key: "feedback", moduleKey: "feedback", path: "/feedback", labelKey: "nav.feedback", subKey: "screenSub.feedback" },
  { key: "workflows", moduleKey: "workflows", path: "/workflows", labelKey: "nav.workflows", subKey: "screenSub.workflows" },
]

// Pure-ERP finance/ops group — deliberately does NOT spread growthNav in.
// It used to, which meant CRM's Referrals/Packages/TPA/Feedback/Workflows
// silently reappeared under what's supposed to be an ERP-only section.
export const erpOpsNav: NavItem[] = [
  { key: "finance", moduleKey: "finance", path: "/finance", labelKey: "Finance", subKey: "Ledger & Expenses", requiredPermission: "finance.view_ledger" },
  { key: "billing", moduleKey: "billing", path: "/billing", labelKey: "Billing & Claims", subKey: "Invoices & TPA Claims", requiredPermission: "billing.view_bill" },
  { key: "hr", moduleKey: "hr", path: "/hr", labelKey: "HR & Roster", subKey: "Staff Directory & Attendance", requiredPermission: "hr.view_employee" },
  { key: "inventory", moduleKey: "inventory", path: "/inventory", labelKey: "Inventory & PO", subKey: "Stock & Procurement", requiredPermission: "inventory.view_item" },
]

export const administrationNav: NavItem[] = [
  { key: "admin", path: "/admin", labelKey: "nav.admin", subKey: "screenSub.admin", requiredPermission: "accounts.view_role" },
  { key: "governance", path: "/governance", labelKey: "Security & Governance", subKey: "Policies, audit, backups", requiredPermission: "governance.view_auditrule" },
  { key: "help", path: "/help", labelKey: "Help Centre", subKey: "Guides, FAQs, tutorials" },
  { key: "settings", path: "/settings", labelKey: "nav.settings", subKey: "screenSub.settings" },
]

export const allNav = [...saasNav, ...dailyWorkNav, ...growthNav, ...careNav, ...nabhCareNav, ...erpOpsNav, ...nabhOpsNav, ...administrationNav]

// The real set of ERP module keys, derived from the nav items that
// actually gate on one — not hardcoded, so it can't drift from
// careNav/erpOpsNav. Hospital.enabled_modules can hold non-module flags
// too (e.g. a CRM-only tier stores `["crm"]`, no ERP keys at all), so
// "the array is non-empty" is not the same question as "this hospital's
// subscription includes at least one ERP module" — this answers the
// second question precisely.
export const erpModuleKeys: string[] = Array.from(
  new Set(
    [...careNav, ...erpOpsNav, ...nabhCareNav, ...nabhOpsNav].flatMap((item) => (item.moduleKey ? (Array.isArray(item.moduleKey) ? item.moduleKey : [item.moduleKey]) : [])),
  ),
)

export function hasNavAccess(item: NavItem, permissions: string[] | undefined, enabledModules?: string[] | undefined): boolean {
  if (item.moduleKey && enabledModules && enabledModules.length > 0) {
    const keys = Array.isArray(item.moduleKey) ? item.moduleKey : [item.moduleKey]
    if (!keys.some((k) => enabledModules.includes(k))) {
      return false
    }
  }
  if (!item.requiredPermission) return true
  const required = Array.isArray(item.requiredPermission) ? item.requiredPermission : [item.requiredPermission]
  return required.some((p) => (permissions ?? []).includes(p))
}

