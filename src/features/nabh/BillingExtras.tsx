import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { ResourceTable } from "../../components/resource/ResourceTable"
import { col, opts } from "./fields"

// Automatic bed / room-rent billing and doctor payouts (revenue share).

const inputCls = "w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10) }
const monthEnd = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10) }
const inr = (n: number | string | null | undefined) => (n === null || n === undefined ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`)

interface Policy { cycle: string; grace_hours: number; checkout_hour: number; transfer_day_rule: string; auto_post: boolean }

function BedPolicyCard() {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get<Policy>("/billing/bed-billing-policy/").then(setPolicy).catch((e) => setError(extractApiError(e))) }, [])
  const save = async () => {
    setError(null)
    setNotice(null)
    try {
      setPolicy(await api.put<Policy>("/billing/bed-billing-policy/", policy))
      setNotice("Saved. It applies from the next posting run.")
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  if (!policy) return error ? <div className="text-sm text-rose-700">{error}</div> : null
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">How bed-days are counted</h2>
        <p className="text-sm text-slate-500">Charges are posted to the patient's running bill every night, at discharge and when an interim bill is made. Re-posting never double-charges.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="text-xs font-semibold text-slate-600">Day counting
          <select className={`${inputCls} mt-1`} value={policy.cycle} onChange={(e) => setPolicy({ ...policy, cycle: e.target.value })}>
            <option value="24h">24-hour cycle from admission</option>
            <option value="calendar_day">Calendar day</option>
          </select>
        </label>
        {policy.cycle === "24h" ? (
          <label className="text-xs font-semibold text-slate-600">Grace hours before a new day
            <input type="number" min={0} max={23} className={`${inputCls} mt-1`} value={policy.grace_hours} onChange={(e) => setPolicy({ ...policy, grace_hours: Number(e.target.value) })} />
          </label>
        ) : (
          <label className="text-xs font-semibold text-slate-600">Checkout hour (discharge after it = extra day)
            <input type="number" min={0} max={23} className={`${inputCls} mt-1`} value={policy.checkout_hour} onChange={(e) => setPolicy({ ...policy, checkout_hour: Number(e.target.value) })} />
          </label>
        )}
        <label className="text-xs font-semibold text-slate-600">On a transfer day, charge
          <select className={`${inputCls} mt-1`} value={policy.transfer_day_rule} onChange={(e) => setPolicy({ ...policy, transfer_day_rule: e.target.value })}>
            <option value="higher">the higher-rate bed</option>
            <option value="longest">the bed occupied longest</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 flex items-end gap-2 pb-2">
          <input type="checkbox" checked={policy.auto_post} onChange={(e) => setPolicy({ ...policy, auto_post: e.target.checked })} />
          Post automatically
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white">Save policy</button>
        {notice && <span className="text-sm text-emerald-700">{notice}</span>}
        {error && <span className="text-sm text-rose-700">{error}</span>}
      </div>
    </section>
  )
}

export function BedBillingPanel() {
  return (
    <div className="space-y-6">
      <BedPolicyCard />
      <ResourceTable config={{
        title: "Bed charge rules",
        description: "Which tariff each bed-day attracts. Rules for a specific ward win over rules for a bed type, which win over catch-all rules. Several rules at the same level are all charged — e.g. room rent + nursing + RMO.",
        endpoint: "/billing/bed-charge-rules/", createLabel: "Add rule",
        columns: [col("name", "Rule"), { key: "ward_name", label: "Ward", render: (r) => r.ward_name || "Any" }, { key: "bed_type", label: "Bed type", render: (r) => r.bed_type || "Any" }, col("tariff_name", "Tariff"), col("is_active", "Active")],
        fields: [
          { key: "name", label: "Name", required: true, placeholder: "e.g. Private room rent" },
          { key: "tariff", label: "Tariff (rate, GST, category rates)", type: "fk", source: "/finance/tariff/", sourceLabel: (r) => `${r.code} — ${r.name} (₹${r.rate})`, required: true },
          { key: "ward", label: "Ward (blank = any)", type: "fk", source: "/facilities/wards/" },
          { key: "bed_type", label: "Bed type (blank = any)", type: "select", options: opts("general", "semi_private", "private", "icu", "ventilator") },
          { key: "is_active", label: "Active", type: "boolean", defaultValue: true },
        ],
      }} />
    </div>
  )
}

interface BedChargeResult {
  bill: number | null
  bill_number: string | null
  bed_days: number
  lines: { description: string; days: number; unit_price: number; amount: number }[]
  total: number
  unpriced_beds: string[]
}

/** Bed charges for one admission — preview and post. Used in the IPD admission panel. */
export function BedChargesCard({ admissionId }: { admissionId: number }) {
  const [data, setData] = useState<BedChargeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => api.get<BedChargeResult>(`/billing/bills/bed-charges/${admissionId}/`).then(setData).catch((e) => setError(extractApiError(e)))
  useEffect(() => { load() }, [admissionId]) // eslint-disable-line react-hooks/exhaustive-deps
  const post = async () => {
    setBusy(true)
    setError(null)
    try {
      setData(await api.post<BedChargeResult>(`/billing/bills/bed-charges/${admissionId}/post/`, {}))
    } catch (e) {
      setError(extractApiError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4">Bed charges</div>
        <button onClick={post} disabled={busy} className="text-[11px] font-semibold text-brand disabled:opacity-50">{busy ? "Posting…" : "Post to bill"}</button>
      </div>
      {error && <div className="text-[12px] text-rose-600">{error}</div>}
      {data && (
        <div className="text-[12.5px] space-y-0.5">
          {data.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-2"><span>{l.description} × {l.days}</span><span>{inr(l.amount)}</span></div>
          ))}
          <div className="flex justify-between font-semibold pt-1 border-t border-border-soft">
            <span>{data.bed_days} bed-day{data.bed_days === 1 ? "" : "s"}{data.bill_number ? ` · bill ${data.bill_number}` : " · not posted yet"}</span>
            <span>{inr(data.total)}</span>
          </div>
          {data.unpriced_beds.length > 0 && <div className="text-[12px] text-amber-700">No charge rule for: {data.unpriced_beds.join(", ")} — add one under Accounts › Bed charges.</div>}
        </div>
      )}
    </div>
  )
}

function PayoutPreview() {
  const [start, setStart] = useState(monthStart())
  const [end, setEnd] = useState(monthEnd())
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = async () => {
    setError(null)
    try {
      setRows((await api.get<any>(`/finance/doctor-payouts/preview/?period_start=${start}&period_end=${end}`)).doctors)
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
      <div>
        <h2 className="text-lg font-bold">What's due</h2>
        <p className="text-sm text-slate-500">Services with a rendering doctor that aren't on a statement yet. Use “Generate statements” below to create drafts for approval.</p>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-600">From<input type="date" className={`${inputCls} mt-1`} value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-600">To<input type="date" className={`${inputCls} mt-1`} value={end} max={today()} onChange={(e) => setEnd(e.target.value)} /></label>
        <button onClick={run} className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-700">Preview</button>
      </div>
      {error && <div className="text-sm text-rose-700">{error}</div>}
      {rows && (rows.length ? (
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500 uppercase text-left"><th className="py-2">Doctor</th><th>Services</th><th>Net billed</th><th>Payout (before TDS)</th></tr></thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {rows.map((r) => <tr key={r.doctor}><td className="py-2">Dr. {r.doctor_name}</td><td>{r.lines}</td><td>{inr(r.base_amount)}</td><td className="font-semibold">{inr(r.gross_payout)}</td></tr>)}
          </tbody>
        </table>
      ) : <div className="text-sm text-slate-500">Nothing due in this period — check that bill lines have a rendering doctor and that a payout rule matches.</div>)}
    </section>
  )
}

export function DoctorPayoutsPanel() {
  return (
    <div className="space-y-6">
      <PayoutPreview />
      <ResourceTable config={{
        title: "Payout statements",
        description: "Draft → approved → paid. Paying posts the voucher (professional fees, bank, TDS payable) to the journal and the Tally export. A service can only ever be on one live statement; cancelling a statement frees its services for the next run.",
        endpoint: "/finance/doctor-payouts/", searchable: false,
        filters: [{ key: "status", label: "Status", type: "select", options: opts("draft", "approved", "paid", "cancelled") }],
        columns: [col("doctor_name", "Doctor"), { key: "period", label: "Period", render: (r) => `${r.period_start} → ${r.period_end}` }, col("line_count", "Services"),
          { key: "gross_payout", label: "Gross", render: (r) => inr(r.gross_payout) }, { key: "tds_amount", label: "TDS", render: (r) => `${inr(r.tds_amount)} (${Number(r.tds_percent)}%)` },
          { key: "net_payable", label: "Net payable", render: (r) => inr(r.net_payable) }, { key: "status", label: "Status" }, col("payment_reference", "Reference")],
        toolbar: [{
          label: "Generate statements", path: "generate/", method: "post", prompt: [
            { key: "period_start", label: "From", type: "date", required: true, defaultValue: monthStart() },
            { key: "period_end", label: "To", type: "date", required: true, defaultValue: monthEnd() },
            { key: "doctor", label: "Only this doctor (optional)", type: "fk", source: "/doctors/" },
            { key: "tds_percent", label: "TDS % (Sec 194J)", type: "number", defaultValue: 10 },
          ],
        }],
        actions: [
          { label: "Lines", path: "lines/", method: "get" },
          { label: "Excel", path: "lines/?output=xlsx", method: "get", download: "payout-statement.xlsx" },
          { label: "Approve", path: "approve/", tone: "primary", confirm: "Approve this statement for payment?", show: (r) => r.status === "draft" },
          { label: "Mark paid", path: "mark-paid/", tone: "primary", show: (r) => r.status === "approved", prompt: [
            { key: "payment_mode", label: "Mode", type: "select", options: opts("neft", "upi", "cheque", "cash"), defaultValue: "neft", required: true },
            { key: "payment_reference", label: "UTR / cheque no." },
            { key: "paid_on", label: "Paid on", type: "date", defaultValue: today() },
          ] },
          { label: "Cancel", path: "cancel/", tone: "danger", confirm: "Cancel this statement? Its services become payable again on the next run.", show: (r) => ["draft", "approved"].includes(r.status) },
        ],
      }} />
    </div>
  )
}

export const payoutRulesResource = {
  title: "Doctor payout rules",
  description: "What share of a service the rendering doctor earns. The most specific matching rule wins: doctor › service › service department › patient category › doctor's department. % is on the line's net value after discount, before GST.",
  endpoint: "/finance/doctor-payout-rules/", createLabel: "Add rule",
  filters: [{ key: "earned_on", label: "Earned", type: "select" as const, options: opts("billed", "collected") }],
  columns: [col("name", "Rule"), { key: "doctor_name", label: "Doctor", render: (r: any) => r.doctor_name || "Any" }, { key: "tariff_name", label: "Service", render: (r: any) => r.tariff_name || r.service_department || "Any" },
    { key: "patient_category", label: "Category", render: (r: any) => r.patient_category || "Any" },
    { key: "value", label: "Share", render: (r: any) => (r.basis === "percent" ? `${Number(r.value)}%` : `${inr(r.value)} / unit`) }, col("earned_on", "Earned"), col("is_active", "Active")],
  fields: [
    { key: "name", label: "Name", required: true, placeholder: "e.g. Cardiology consultants — echo" },
    { key: "doctor", label: "Doctor (blank = any)", type: "fk" as const, source: "/doctors/" },
    { key: "doctor_department", label: "Doctor's department (blank = any)", type: "fk" as const, source: "/departments/" },
    { key: "tariff", label: "Service (blank = any)", type: "fk" as const, source: "/finance/tariff/", sourceLabel: (r: any) => `${r.code} — ${r.name}` },
    { key: "service_department", label: "Service department (tariff department, blank = any)" },
    { key: "patient_category", label: "Patient category", type: "select" as const, options: opts("general", "private", "insurance", "corporate") },
    { key: "basis", label: "Basis", type: "select" as const, options: [{ value: "percent", label: "% of net amount" }, { value: "fixed", label: "Fixed ₹ per unit" }], defaultValue: "percent", required: true },
    { key: "value", label: "Value (% or ₹)", type: "number" as const, required: true },
    { key: "earned_on", label: "Earned", type: "select" as const, options: [{ value: "billed", label: "When billed" }, { value: "collected", label: "When the bill is fully paid" }], defaultValue: "billed" },
    { key: "priority", label: "Priority (tie-break)", type: "number" as const, defaultValue: 0 },
    { key: "effective_from", label: "Effective from", type: "date" as const },
    { key: "effective_to", label: "Effective to", type: "date" as const },
    { key: "is_active", label: "Active", type: "boolean" as const, defaultValue: true },
  ],
}
