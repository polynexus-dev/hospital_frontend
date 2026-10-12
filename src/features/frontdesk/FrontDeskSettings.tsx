import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import type { ResourceConfig } from "../../components/resource/ResourceTable"
import { Button } from "../../components/ui/Button"

const tariffLabel = (r: any) => `${r.code} — ${r.name} (₹${r.rate})`

/** Finance → Consultation fees: what each doctor or department charges, and the follow-up windows. */
export const consultationFeesResource: ResourceConfig = {
  title: "Consultation fees", endpoint: "/frontdesk/fee-rules/", createLabel: "Add fee rule",
  description: "The most specific rule wins: a doctor's own, else their department's, else the hospital default (no doctor, no department). Follow-ups within the free window are free (up to the limit); later ones within the follow-up window pay the follow-up fee; after that it's a new visit.",
  columns: [
    { key: "doctor", label: "Doctor" }, { key: "department", label: "Department" }, { key: "new_visit_tariff", label: "New-visit tariff" },
    { key: "follow_up_tariff", label: "Follow-up tariff" }, { key: "free_follow_up_days", label: "Free within (days)" },
    { key: "max_free_follow_ups", label: "Free follow-ups" }, { key: "follow_up_valid_days", label: "Follow-up valid (days)" }, { key: "is_active", label: "Active" },
  ],
  fields: [
    { key: "doctor", label: "Doctor (blank = department or hospital default)", type: "fk", source: "/doctors/", sourceLabel: (r: any) => `Dr. ${r.name}` },
    { key: "department", label: "Department (blank = hospital default)", type: "fk", source: "/departments/" },
    { key: "new_visit_tariff", label: "New-visit fee (tariff)", type: "fk", source: "/finance/tariff/", sourceLabel: tariffLabel, required: true },
    { key: "follow_up_tariff", label: "Paid follow-up fee (blank = new-visit fee)", type: "fk", source: "/finance/tariff/", sourceLabel: tariffLabel },
    { key: "free_follow_up_days", label: "Free follow-up within (days)", type: "number", defaultValue: 7 },
    { key: "max_free_follow_ups", label: "Free follow-ups per paid visit", type: "number", defaultValue: 1 },
    { key: "follow_up_valid_days", label: "Counts as follow-up within (days)", type: "number", defaultValue: 30 },
    { key: "is_active", label: "Active", type: "boolean", defaultValue: true },
  ],
}

/** Billing → discounts above the counter's limit, for approvers. */
export const discountApprovalsResource: ResourceConfig = {
  title: "Discount approvals", endpoint: "/frontdesk/discount-approvals/",
  description: "Discounts the counter gave above the front-desk limit. Approving lets the bill be paid with the discount; rejecting removes it.",
  filters: [{ key: "status", label: "Status", type: "select", options: ["pending", "approved", "rejected"] }],
  columns: [
    { key: "created_at", label: "Requested" }, { key: "bill_number", label: "Bill" }, { key: "patient_name", label: "Patient" },
    { key: "gross", label: "Bill total" }, { key: "amount", label: "Discount" }, { key: "percent", label: "%" }, { key: "reason", label: "Reason" },
    { key: "requested_by_name", label: "Asked by" }, { key: "status", label: "Status" },
  ],
  actions: [
    { label: "Approve", path: "approve/", method: "post", tone: "primary", show: (r) => r.status === "pending" },
    { label: "Reject", path: "reject/", method: "post", tone: "danger", confirm: "Reject this discount? The bill goes back to its full amount.", show: (r) => r.status === "pending" },
  ],
}

const PAYERS = [["corporate", "Corporate"], ["tpa", "TPA"], ["insurance", "Insurance"], ["scheme", "Govt scheme"], ["health_camp", "Health camp"], ["self", "Self-pay"]]

/** Finance → Front-desk rules: registration fee, discount limit, credit, rounding. */
export function FrontDeskPolicyForm() {
  const [policy, setPolicy] = useState<Record<string, any> | null>(null)
  const [tariffs, setTariffs] = useState<any[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    api.get<Record<string, any>>("/frontdesk/policy/").then(setPolicy).catch((e) => setMsg({ ok: false, text: extractApiError(e) }))
    api.get<{ results: any[] }>("/finance/tariff/?page_size=500").then((r) => setTariffs(r.results ?? [])).catch(() => setTariffs([]))
  }, [])
  if (!policy) return <div className="text-sm text-ink-4">{msg?.text ?? "Loading…"}</div>

  const set = (k: string, v: unknown) => setPolicy({ ...policy, [k]: v })
  const save = async () => {
    try {
      setPolicy(await api.patch<Record<string, any>>("/frontdesk/policy/", policy))
      setMsg({ ok: true, text: "Saved." })
    } catch (e) {
      setMsg({ ok: false, text: extractApiError(e) })
    }
  }
  const field = "w-full px-3 py-2 border border-border-strong rounded-control bg-surface text-[13px]"

  return (
    <div className="max-w-xl space-y-3 text-[13px]">
      <label className="block"><span className="block text-xs font-semibold text-ink-3 mb-1">Registration fee for new patients</span>
        <select className={field} value={policy.registration_fee_tariff ?? ""} onChange={(e) => set("registration_fee_tariff", e.target.value ? Number(e.target.value) : null)}>
          <option value="">No registration fee</option>
          {tariffs.map((t) => <option key={t.id} value={t.id}>{tariffLabel(t)}</option>)}
        </select>
      </label>
      <label className="block"><span className="block text-xs font-semibold text-ink-3 mb-1">Discounts above this % need an approver</span>
        <input type="number" min={0} max={100} className={field} value={policy.discount_limit_percent} onChange={(e) => set("discount_limit_percent", e.target.value)} />
      </label>
      <fieldset><legend className="text-xs font-semibold text-ink-3 mb-1">May be billed on credit</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {PAYERS.map(([value, text]) => (
            <label key={value} className="flex items-center gap-1.5"><input type="checkbox" checked={(policy.credit_payer_types ?? []).includes(value)}
              onChange={(e) => set("credit_payer_types", e.target.checked ? [...(policy.credit_payer_types ?? []), value] : (policy.credit_payer_types ?? []).filter((x: string) => x !== value))} /> {text}</label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!policy.round_down_to_rupee} onChange={(e) => set("round_down_to_rupee", e.target.checked)} /> Round bills down to the rupee</label>
      <label className="block"><span className="block text-xs font-semibold text-ink-3 mb-1">Default rate category</span>
        <select className={field} value={policy.default_rate_category} onChange={(e) => set("default_rate_category", e.target.value)}>
          {["general", "private", "insurance", "corporate"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save}>Save</Button>
        {msg && <span className={msg.ok ? "text-success-text" : "text-danger-text"}>{msg.text}</span>}
      </div>
    </div>
  )
}
