import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "../store/auth"

export function RequireHospitalContext() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  // DPDP Act 2023 Zero-Trust Privacy Guard:
  // SaaS Vendor Superadmins are prohibited from accessing individual hospital clinical/patient PHI routes.
  if (user.email === "saas_owner@hospital-crm.com") {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
