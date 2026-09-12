import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "../store/auth"

// Route-level enforcement — the actual security boundary. hasNavAccess in
// navConfig.ts only decides whether to *show* a nav link; without this,
// an unauthorized user's browser could still render the page shell (and
// briefly show data before an API 403 arrives) by navigating to the URL
// directly. See docs/erp/06-navigation-and-dashboards.md §5.
//
// `permission` accepts an array for screens that legitimately have more
// than one entry path — e.g. Diagnostics needs either the lab or the
// radiology view permission, since a lab technician has one and a
// radiology technician has the other, never both. `moduleKey` gates on
// the hospital's subscribed modules (Hospital.enabled_modules) the same
// way — any of the listed keys being enabled is enough.
export function RequirePermission({ permission, moduleKey }: { permission: string | string[]; moduleKey?: string | string[] }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return null // ProtectedRoute (outer) already handles "not logged in"

  const perms = Array.isArray(permission) ? permission : [permission]
  if (!perms.some((p) => user.permissions?.includes(p))) return <Navigate to="/dashboard" replace />

  if (moduleKey) {
    const keys = Array.isArray(moduleKey) ? moduleKey : [moduleKey]
    const mods = user.hospital_enabled_modules
    if (mods && mods.length > 0 && !keys.some((k) => mods.includes(k))) return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
