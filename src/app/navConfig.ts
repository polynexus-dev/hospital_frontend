export interface NavItem {
  key: string
  moduleKey?: string
  path: string
  labelKey: string
  subKey: string
  requiredPermission?: string
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
  { key: "diagnostics", moduleKey: "diagnostics", path: "/diagnostics", labelKey: "Diagnostics", subKey: "Lab & Radiology Orders", requiredPermission: "laboratory.view_laborder" },
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

export const businessNav: NavItem[] = [
  ...growthNav,
  { key: "finance", moduleKey: "finance", path: "/finance", labelKey: "Finance", subKey: "Ledger & Expenses", requiredPermission: "finance.view_ledger" },
  { key: "billing", moduleKey: "billing", path: "/billing", labelKey: "Billing & Claims", subKey: "Invoices & TPA Claims", requiredPermission: "billing.view_bill" },
  { key: "hr", moduleKey: "hr", path: "/hr", labelKey: "HR & Roster", subKey: "Staff Directory & Attendance", requiredPermission: "hr.view_employee" },
  { key: "inventory", moduleKey: "inventory", path: "/inventory", labelKey: "Inventory & PO", subKey: "Stock & Procurement", requiredPermission: "inventory.view_item" },
]

export const administrationNav: NavItem[] = [
  { key: "admin", path: "/admin", labelKey: "nav.admin", subKey: "screenSub.admin" },
  { key: "settings", path: "/settings", labelKey: "nav.settings", subKey: "screenSub.settings" },
]

export const allNav = [...saasNav, ...dailyWorkNav, ...careNav, ...businessNav, ...administrationNav]

export function hasNavAccess(item: NavItem, permissions: string[] | undefined, enabledModules?: string[] | undefined): boolean {
  if (item.moduleKey && enabledModules && enabledModules.length > 0) {
    if (!enabledModules.includes(item.moduleKey)) {
      return false
    }
  }
  return !item.requiredPermission || (permissions ?? []).includes(item.requiredPermission)
}

