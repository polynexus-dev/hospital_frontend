import { useEffect, useState, type ReactNode } from "react"
import { api, extractApiError } from "../../api/client"
import { Drawer } from "../ui/Drawer"
import { RecordDetails, type RecordDetailsOptions } from "./RecordDetails"
import { StatusPill, isStatusKey } from "./format"

type Row = Record<string, any>

/** Best human title for a record: its name, patient, title or number. */
export function recordTitle(r: Row): string {
  const personOf = (o: Row | null | undefined): string =>
    o && typeof o === "object" && !Array.isArray(o)
      ? o.full_name || [o.first_name, o.last_name].filter(Boolean).join(" ") || o.name || o.patient_name || o.employee_name || ""
      : ""
  // the person a record is about often sits in a nested *_detail object (admission_detail.patient_name, user_detail, …)
  const nested = Object.entries(r)
    .filter(([k, v]) => (k.endsWith("_detail") || k === "user" || k === "patient") && v && typeof v === "object")
    .map(([, v]) => personOf(v as Row))
    .find(Boolean)
  const label = (v: unknown) => (typeof v === "string" ? v.replace(/_/g, " ") : "")
  return (
    // things that aren't about one person first, so a blood unit isn't titled with its donor's name
    r.unit_number || (r.blood_group && r.component ? `${r.blood_group} · ${label(r.component).toUpperCase()}` : "") ||
    (r.medicine_name ? `${r.quantity ? `${r.quantity} × ` : ""}${r.medicine_name}` : "") || r.workflow_name ||
    personOf(r) || r.user_name || r.donor_name || r.caller_name || nested || r.title || r.subject || r.bill_number ||
    r.order_number || r.employee_code || r.number || r.code || r.phone_number ||
    (r.category ? `${r.category}${r.reference_id ? ` · ${r.reference_id}` : ""}` : "") ||
    (typeof r.description === "string" && r.description.length <= 80 ? r.description : "") ||
    (r.id !== undefined ? `#${r.id}` : "Details")
  )
}

/**
 * Click-a-row detail view: shows every field of `record`. With `fetchUrl`
 * it also loads the full record from the API (list rows are often trimmed)
 * and shows that once it arrives.
 */
export function RecordDrawer({
  record,
  fetchUrl,
  title,
  subtitle,
  onClose,
  options,
  actions,
  children,
  wide,
}: {
  record?: Row | null
  fetchUrl?: string
  title?: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  options?: RecordDetailsOptions
  actions?: ReactNode
  children?: ReactNode
  wide?: boolean
}) {
  const [full, setFull] = useState<Row | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFull(null)
    setError(null)
    if (!fetchUrl) return
    let live = true
    api
      .get<Row>(fetchUrl)
      .then((r) => live && setFull(r))
      .catch((e) => live && setError(extractApiError(e)))
    return () => {
      live = false
    }
  }, [fetchUrl])

  const data: Row = { ...(record ?? {}), ...(full ?? {}) }
  const statusKey = Object.keys(data).find((k) => isStatusKey(k) && typeof data[k] === "string" && /^(status|stage|state)$/.test(k))

  return (
    <Drawer
      title={title ?? recordTitle(data)}
      subtitle={subtitle ?? (data.id !== undefined ? `Record #${data.id}` : undefined)}
      badges={statusKey ? <StatusPill value={data[statusKey]} /> : undefined}
      actions={actions}
      onClose={onClose}
      wide={wide}
    >
      {fetchUrl && !full && !error && !record && <div className="py-8 text-center text-ink-4">Loading…</div>}
      {error && <div className="text-sm text-danger-text bg-danger-bg rounded-control px-3 py-2">Couldn't load the full record: {error}</div>}
      {children}
      {Object.keys(data).length > 0 && <RecordDetails record={data} options={options} />}
    </Drawer>
  )
}
