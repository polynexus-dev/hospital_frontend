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
  { key: "saas-console", path: "/saas", labelKey: "SaaS Console", subKey: "Tenants · subscriptions · invoices · usage" },
]

export const dailyWorkNav: NavItem[] = [
  { key: "console", path: "/console", labelKey: "nav.console", subKey: "screenSub.console" },
  { key: "callbacks", path: "/callbacks", labelKey: "nav.callbacks", subKey: "screenSub.callbacks" },
  { key: "enquiries", path: "/enquiries", labelKey: "nav.enquiries", subKey: "screenSub.enquiries" },
  { key: "patients", path: "/patients", labelKey: "nav.patients", subKey: "screenSub.patients" },
  { key: "appointments", path: "/appointments", labelKey: "nav.appointments", subKey: "screenSub.appointments" },
  { key: "inbox", path: "/inbox", labelKey: "nav.inbox", subKey: "screenSub.inbox" },
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

export const growthNav: NavItem[] = [
  { key: "referrals", path: "/referrals", labelKey: "nav.referrals", subKey: "screenSub.referrals" },
  { key: "packages", path: "/packages", labelKey: "nav.packages", subKey: "screenSub.packages" },
  { key: "tpa", path: "/tpa", labelKey: "nav.tpa", subKey: "screenSub.tpa" },
  { key: "feedback", path: "/feedback", labelKey: "nav.feedback", subKey: "screenSub.feedback" },
  { key: "workflows", path: "/workflows", labelKey: "nav.workflows", subKey: "screenSub.workflows" },
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
  { key: "settings", path: "/settings", labelKey: "nav.settings", subKey: "screenSub.settings" },
]

export const allNav = [...saasNav, ...dailyWorkNav, ...growthNav, ...careNav, ...erpOpsNav, ...administrationNav]

// The real set of ERP module keys, derived from the nav items that
// actually gate on one — not hardcoded, so it can't drift from
// careNav/erpOpsNav. Hospital.enabled_modules can hold non-module flags
// too (e.g. a CRM-only tier stores `["crm"]`, no ERP keys at all), so
// "the array is non-empty" is not the same question as "this hospital's
// subscription includes at least one ERP module" — this answers the
// second question precisely.
export const erpModuleKeys: string[] = Array.from(
  new Set(
    [...careNav, ...erpOpsNav].flatMap((item) => (item.moduleKey ? (Array.isArray(item.moduleKey) ? item.moduleKey : [item.moduleKey]) : [])),
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

