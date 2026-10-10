import { useQuery } from "@tanstack/react-query"
import { getLicenseStatus } from "../api/licensing"
import { useAuthStore } from "../store/auth"

/** Whether the installation's licence includes `feature` (apps/licensing/features.py).
 *  Always true in SaaS mode, where the subscription governs; module-backed
 *  menus are already filtered through hospital_enabled_modules. */
export function useLicensedFeature(feature: string): boolean {
  const user = useAuthStore((s) => s.user)
  const { data } = useQuery({ queryKey: ["license-status"], queryFn: getLicenseStatus, enabled: Boolean(user), staleTime: 10 * 60 * 1000 })
  if (!data || data.mode !== "on_premise" || !data.features) return true
  return data.features.includes(feature)
}
