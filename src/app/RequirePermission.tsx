import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "../store/auth"

// Route-level enforcement — the actual security boundary. hasNavAccess in
// navConfig.ts only decides whether to *show* a nav link; without this,
// an unauthorized user's browser could still render the page shell (and
// briefly show data before an API 403 arrives) by navigating to the URL
// directly. See docs/erp/06-navigation-and-dashboards.md §5.
export function RequirePermission({ permission }: { permission: string }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return null // ProtectedRoute (outer) already handles "not logged in"
  if (!user.permissions?.includes(permission)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
