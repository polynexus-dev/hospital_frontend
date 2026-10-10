import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getLicenseStatus } from "../api/licensing"
import { useAuthStore } from "../store/auth"
import type { LicenseStatus } from "../types/api"

const BLOCKING = new Set(["expired", "tampered", "invalid_machine", "missing"])

function headline(s: LicenseStatus) {
  switch (s.state) {
    case "expiring_soon":
      return `License expires in ${s.days_left} day${s.days_left === 1 ? "" : "s"}.`
    case "grace_period":
      return "License expired — grace period in effect. The system becomes read-only soon."
    case "expired":
      return "License expired. The system is in read-only archive mode: records can be viewed but not changed."
    case "missing":
      return "No license is installed. The system is read-only until one is uploaded."
    default:
      return `License problem: ${s.message} The system is read-only.`
  }
}

/** On-premise installations: license warnings across the top of every page.
 *  Expiry warnings go to hospital admins; read-only notices go to everyone,
 *  since everyone's saves will fail. */
export function LicenseBanner() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = Boolean(user?.permissions?.includes("accounts.change_user"))
  const { data } = useQuery({
    queryKey: ["license-status"],
    queryFn: getLicenseStatus,
    enabled: Boolean(user),
    staleTime: 10 * 60 * 1000,
  })

  if (!data || data.mode !== "on_premise" || !data.state || data.state === "valid") return null
  const blocking = BLOCKING.has(data.state)
  if (!blocking && !isAdmin) return null

  const support = [data.support?.email, data.support?.phone].filter(Boolean).join(" · ")
  return (
    <div
      role="alert"
      className={`px-5 py-2.5 text-[13px] flex flex-wrap items-center gap-x-3 gap-y-1 border-b ${
        blocking || data.state === "grace_period"
          ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900"
          : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900"
      }`}
    >
      <span className="font-semibold">{headline(data)}</span>
      {support && <span>Renew with support: {support}</span>}
      {isAdmin && <Link to="/settings#license" className="underline font-semibold">License settings</Link>}
    </div>
  )
}
