export interface NavItem {
  key: string
  path: string
  labelKey: string
  subKey: string
}

export const dailyWorkNav: NavItem[] = [
  { key: "console", path: "/console", labelKey: "nav.console", subKey: "screenSub.console" },
  { key: "callbacks", path: "/callbacks", labelKey: "nav.callbacks", subKey: "screenSub.callbacks" },
  { key: "enquiries", path: "/enquiries", labelKey: "nav.enquiries", subKey: "screenSub.enquiries" },
  { key: "patients", path: "/patients", labelKey: "nav.patients", subKey: "screenSub.patients" },
  { key: "appointments", path: "/appointments", labelKey: "nav.appointments", subKey: "screenSub.appointments" },
  { key: "inbox", path: "/inbox", labelKey: "nav.inbox", subKey: "screenSub.inbox" },
  { key: "dashboard", path: "/dashboard", labelKey: "nav.dashboard", subKey: "screenSub.dashboard" },
]

export const growthNav: NavItem[] = [
  { key: "referrals", path: "/referrals", labelKey: "nav.referrals", subKey: "screenSub.referrals" },
  { key: "packages", path: "/packages", labelKey: "nav.packages", subKey: "screenSub.packages" },
  { key: "tpa", path: "/tpa", labelKey: "nav.tpa", subKey: "screenSub.tpa" },
  { key: "feedback", path: "/feedback", labelKey: "nav.feedback", subKey: "screenSub.feedback" },
  { key: "workflows", path: "/workflows", labelKey: "nav.workflows", subKey: "screenSub.workflows" },
  { key: "admin", path: "/admin", labelKey: "nav.admin", subKey: "screenSub.admin" },
]


export const allNav = [...dailyWorkNav, ...growthNav]
