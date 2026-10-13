import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { getLicenseStatus } from "../../api/licensing"
import { Pill } from "../../components/ui/Pill"
import { daysLeftInfo } from "./licenceUsage"

/** Dashboard tile for hospital owners/admins on on-premise installs:
 *  licence status, days left and users used, so renewal isn't missed. */
export function LicenseTile() {
  const { data } = useQuery({ queryKey: ["license-status"], queryFn: getLicenseStatus })
  if (!data || data.mode !== "on_premise" || data.machine_fingerprint === undefined) return null
  const days = daysLeftInfo(data)
  const users = data.usage?.active_users
  const limit = data.max_active_users
  return (
    <Link to="/settings#license" className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-2.5 text-[13px] hover:border-brand-border">
      <span className="font-semibold">Licence</span>
      {days && <Pill tone={days.tone}>{days.text}</Pill>}
      {data.expires_at && <span className="text-ink-4">until {new Date(data.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
      {users !== undefined && <span className="text-ink-4">· users {users}{limit ? ` of ${limit}` : ""}</span>}
      <span className="ml-auto text-brand text-[12px] font-semibold">Details & renewal →</span>
    </Link>
  )
}
