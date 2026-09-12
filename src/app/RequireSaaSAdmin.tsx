import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "../store/auth"

// Route-level enforcement for the platform-operator console, mirroring
// RequirePermission — but gated on the is_saas_admin/is_superuser flags
// rather than a Django model permission, because that's what the backend
// itself checks (apps.core.permissions.IsSaaSAdmin is
// `user.is_superuser or user.is_saas_admin`; the SaaS-admin surface is
// deliberately absent from apps.accounts.permission_templates, so no
// role template grants a `saas_admin.*` permission to match on).
//
// The API is the real boundary — every /saas-admin/ endpoint enforces
// this server-side regardless. This only stops the shell from rendering
// a console the caller's requests would all 403 on anyway.
export function RequireSaaSAdmin() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null // ProtectedRoute (outer) already handles "not logged in"
  if ((!user.is_saas_admin && !user.is_superuser) || user.hospital) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
