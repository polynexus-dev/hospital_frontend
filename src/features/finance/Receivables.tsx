import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { ResourceTable } from "../../components/resource/ResourceTable"
import { col, opts } from "../nabh/fields"
import { btnCls, cardCls, download, fyStart, inputCls, inr, lineTotals, today, type InvoiceLine } from "./ui"

// Customer (B2B) invoicing: corporate clients, insurers, licensees.

interface Customer { id: number; name: string; state_code: string; credit_days: number; email: string }
interface Tariff { id: number; code: string; name: string; rate: string; gst_rate: string; hsn_sac: string }

const GST = ["0", "5", "12", "18", "28"]
const blankLine = (): InvoiceLine => ({ tariff: null, description: "", hsn_sac: "", quantity: "1", rate: "", discount: "", gst_rate: "0" })

function useList<T>(path: string) {
  const [rows, setRows] = useState<T[]>([])
  useEffect(() => { api.get<any>(path).then((r) => setRows(r.results ?? r)).catch(() => setRows([])) }, [path])
  return rows
}

/** Line editor shared by invoices and recurring invoices. */
export function InvoiceLinesEditor({ lines, onChange }: { lines: InvoiceLine[]; onChange: (lines: InvoiceLine[]) => void }) {
  const tariffs = useList<Tariff>("/finance/tariff/?is_active=true&page_size=500")
  const set = (i: number, patch: Partial<InvoiceLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const pick = (i: number, id: string) => {
    const t = tariffs.find((x) => String(x.id) === id)
    set(i, t ? { tariff: t.id, description: t.name, rate: String(t.rate), gst_rate: String(Number(t.gst_rate)), hsn_sac: t.hsn_sac } : { tariff: null })
  }
  const { taxable, tax, total } = lineTotals(lines)
  return (
    <div className="space-y-2">
      <div className="hidden md:grid grid-cols-[150px_1fr_80px_60px_90px_80px_70px_28px] gap-2 text-[11px] font-semibold uppercase text-ink-4">
        <span>Service</span><span>Description</span><span>HSN/SAC</span><span>Qty</span><span>Rate</span><span>Discount</span><span>GST %</span><span />
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-2 md:grid-cols-[150px_1fr_80px_60px_90px_80px_70px_28px] gap-2 items-center">
          <select aria-label={`Service ${i + 1}`} className={inputCls} value={l.tariff ?? ""} onChange={(e) => pick(i, e.target.value)}>
            <option value="">Free text</option>{tariffs.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
          </select>
          <input aria-label={`Description ${i + 1}`} className={inputCls} value={l.description} onChange={(e) => set(i, { description: e.target.value })} />
          <input aria-label={`HSN ${i + 1}`} className={inputCls} value={l.hsn_sac} onChange={(e) => set(i, { hsn_sac: e.target.value })} />
          <input aria-label={`Quantity ${i + 1}`} type="number" min={0} className={inputCls} value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />
          <input aria-label={`Rate ${i + 1}`} type="number" min={0} className={inputCls} value={l.rate} onChange={(e) => set(i, { rate: e.target.value })} />
          <input aria-label={`Discount ${i + 1}`} type="number" min={0} className={inputCls} value={l.discount} onChange={(e) => set(i, { discount: e.target.value })} />
          <select aria-label={`GST ${i + 1}`} className={inputCls} value={l.gst_rate} onChange={(e) => set(i, { gst_rate: e.target.value })}>{GST.map((g) => <option key={g} value={g}>{g}%</option>)}</select>
          <button aria-label="Remove line" className="text-ink-4 hover:text-danger-text disabled:opacity-30" disabled={lines.length <= 1} onClick={() => onChange(lines.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button className="text-brand font-semibold" onClick={() => onChange([...lines, blankLine()])}>+ Add line</button>
        <span>Taxable {inr(taxable)} · GST {inr(tax)} · <b>Total {inr(total)}</b></span>
      </div>
    </div>
  )
}

const toPayload = (lines: InvoiceLine[]) => lines.filter((l) => l.description || l.tariff).map((l) => ({ ...l, discount: l.discount || 0, quantity: l.quantity || 1 }))

function NewInvoiceCard({ onSaved }: { onSaved: () => void }) {
  const customers = useList<Customer>("/finance/customers/?is_active=true&page_size=500")
  const [customer, setCustomer] = useState("")
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<InvoiceLine[]>([blankLine()])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const chosen = customers.find((c) => String(c.id) === customer)
  const save = async (issue: boolean) => {
    setError(null)
    setNotice(null)
    try {
      const inv = await api.post<any>("/finance/customer-invoices/", { customer: Number(customer), invoice_date: date, notes, lines: toPayload(lines), issue })
      setNotice(issue ? `Invoice ${inv.invoice_number} issued for ${inr(inv.total_amount)}.` : `Draft saved (${inr(inv.total_amount)}).`)
      setLines([blankLine()])
      setNotes("")
      onSaved()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <section className={cardCls}>
      <div>
        <h2 className="text-lg font-bold">New customer invoice</h2>
        <p className="text-sm text-ink-4">For corporates, insurers billed directly, licensees and other organisations. Save as a draft to review, or issue it now — issuing numbers the invoice and posts it to the books.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-xs font-semibold text-ink-3">Customer
          <select className={`${inputCls} mt-1`} value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">Choose…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-3">Invoice date<input type="date" className={`${inputCls} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="text-xs text-ink-4 flex items-end pb-2">{chosen ? `Due in ${chosen.credit_days} days${chosen.state_code ? ` · state ${chosen.state_code}` : ""}` : ""}</div>
      </div>
      <InvoiceLinesEditor lines={lines} onChange={setLines} />
      <label className="text-xs font-semibold text-ink-3 block">Notes (PO number, period…)<input className={`${inputCls} mt-1`} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={!customer} onClick={() => save(false)} className={`${btnCls} border border-border-strong disabled:opacity-50`}>Save draft</button>
        <button disabled={!customer} onClick={() => save(true)} className={`${btnCls} bg-success text-white disabled:opacity-50`}>Issue invoice</button>
        {notice && <span className="text-sm text-success-text">{notice}</span>}
        {error && <span className="text-sm text-danger-text">{error}</span>}
      </div>
    </section>
  )
}

export function CustomerInvoicesPanel() {
  const [key, setKey] = useState(0)
  return (
    <div className="space-y-6">
      <NewInvoiceCard onSaved={() => setKey((k) => k + 1)} />
      <ResourceTable key={key} config={{
        title: "Customer invoices",
        description: "Drafts can be deleted; an issued invoice is cancelled instead (a credit note reverses it), and only while nothing has been received against it.",
        endpoint: "/finance/customer-invoices/",
        filters: [{ key: "status", label: "Status", type: "select", options: opts("draft", "issued", "partially_paid", "paid", "cancelled") }, { key: "customer", label: "Customer", type: "fk", source: "/finance/customers/" }],
        columns: [col("invoice_number", "Invoice"), col("invoice_date", "Date"), col("customer_name", "Customer"),
          { key: "total_amount", label: "Total", render: (r) => inr(r.total_amount) }, { key: "outstanding", label: "Outstanding", render: (r) => inr(r.outstanding) },
          col("due_date", "Due"), { key: "status", label: "Status" }, { key: "recurring_name", label: "Recurring", render: (r) => r.recurring_name || "—" }],
        actions: [
          { label: "PDF", path: "pdf/", method: "get", download: "invoice.pdf" },
          { label: "Issue", path: "issue/", tone: "primary", confirm: "Issue this invoice? It gets a number and posts to the books.", show: (r) => r.status === "draft",
            prompt: [{ key: "email", label: "Email it to the customer too", type: "boolean", defaultValue: true }] },
          { label: "Email", path: "email/", show: (r) => ["issued", "partially_paid", "paid"].includes(r.status), prompt: [{ key: "to", label: "To (blank = customer's email)" }] },
          { label: "Receive payment", path: "receive/", show: (r) => ["issued", "partially_paid"].includes(r.status), prompt: [
            { key: "amount", label: "Amount received", type: "number", required: true },
            { key: "tds_amount", label: "TDS deducted by customer", type: "number" },
            { key: "mode", label: "Mode", type: "select", options: opts("neft", "upi", "cheque", "cash"), defaultValue: "neft" },
            { key: "reference", label: "UTR / cheque no." },
            { key: "received_on", label: "Received on", type: "date", defaultValue: today() },
          ] },
          { label: "Cancel", path: "cancel/", tone: "danger", show: (r) => r.status !== "cancelled" && Number(r.amount_received) === 0, prompt: [{ key: "reason", label: "Reason", required: true }] },
          { label: "Delete", path: "", method: "delete", tone: "danger", confirm: "Delete this draft?", show: (r) => r.status === "draft" },
        ],
      }} />
    </div>
  )
}

export const customerReceiptsResource = {
  title: "Customer receipts",
  description: "Money received from customers — against an invoice, or on account (an advance). Posted to the books at once.",
  endpoint: "/finance/customer-receipts/", createLabel: "Record receipt", searchable: false,
  filters: [{ key: "customer", label: "Customer", type: "fk" as const, source: "/finance/customers/" }, { key: "mode", label: "Mode", type: "select" as const, options: opts("neft", "upi", "cheque", "cash") }],
  columns: [col("received_on", "Date"), col("customer_name", "Customer"), { key: "invoice_number", label: "Invoice", render: (r: any) => r.invoice_number || "On account" },
    { key: "amount", label: "Amount", render: (r: any) => inr(r.amount) }, { key: "tds_amount", label: "TDS", render: (r: any) => (Number(r.tds_amount) ? inr(r.tds_amount) : "—") }, col("mode", "Mode"), col("reference", "Reference")],
  fields: [
    { key: "customer", label: "Customer", type: "fk" as const, source: "/finance/customers/", required: true },
    { key: "invoice", label: "Against invoice (blank = on account)", type: "fk" as const, source: "/finance/customer-invoices/?status=issued", sourceLabel: (r: any) => `${r.invoice_number} — ${r.customer_name} (due ${inr(r.outstanding)})` },
    { key: "amount", label: "Amount received", type: "number" as const, required: true },
    { key: "tds_amount", label: "TDS deducted by customer", type: "number" as const },
    { key: "mode", label: "Mode", type: "select" as const, options: opts("neft", "upi", "cheque", "cash"), defaultValue: "neft" },
    { key: "reference", label: "UTR / cheque no." },
    { key: "received_on", label: "Received on", type: "date" as const, defaultValue: today() },
    { key: "notes", label: "Notes" },
  ],
}

export const customersResource = {
  title: "Customers",
  description: "Organisations you invoice. Credit days set the due date; the state code (taken from the GSTIN) decides CGST + SGST or IGST.",
  endpoint: "/finance/customers/", createLabel: "Add customer",
  filters: [{ key: "kind", label: "Kind", type: "select" as const, options: opts("corporate", "insurer", "government", "other") }],
  columns: [col("name", "Customer"), col("kind", "Kind"), col("gstin", "GSTIN"), col("state_code", "State"), col("credit_days", "Credit days"), col("contact_person", "Contact"), col("email", "Email"), col("is_active", "Active")],
  fields: [
    { key: "name", label: "Name", required: true },
    { key: "kind", label: "Kind", type: "select" as const, options: opts("corporate", "insurer", "government", "other"), defaultValue: "corporate" },
    { key: "gstin", label: "GSTIN" }, { key: "pan", label: "PAN" },
    { key: "state_code", label: "GST state code (blank = from GSTIN)" },
    { key: "billing_address", label: "Billing address", type: "textarea" as const },
    { key: "contact_person", label: "Contact person" }, { key: "email", label: "Email (invoices are sent here)" }, { key: "phone", label: "Phone" },
    { key: "credit_days", label: "Credit days", type: "number" as const, defaultValue: 30 },
    { key: "is_active", label: "Active", type: "boolean" as const, defaultValue: true },
  ],
}

interface LedgerRow { date: string; particulars: string; debit: string; credit: string; balance: string }
interface Ledger { customer: string; opening: string; rows: LedgerRow[]; closing: string; debit: string; credit: string }
interface AgeRow { customer: number; customer_name: string; current: string; "1_30": string; "31_60": string; "61_90": string; over_90: string; on_account: string; total: string }

export function CustomerLedgerPanel() {
  const customers = useList<Customer>("/finance/customers/?page_size=500")
  const [customer, setCustomer] = useState("")
  const [start, setStart] = useState(fyStart())
  const [end, setEnd] = useState(today())
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [ageing, setAgeing] = useState<{ rows: AgeRow[]; totals: Record<string, string> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get<any>("/finance/customers/ageing/").then(setAgeing).catch((e) => setError(extractApiError(e))) }, [])
  const show = async () => {
    setError(null)
    try {
      setLedger(await api.get<Ledger>(`/finance/customers/${customer}/ledger/?start=${start}&end=${end}`))
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const buckets: [keyof AgeRow, string][] = [["current", "Not yet due"], ["1_30", "1–30"], ["31_60", "31–60"], ["61_90", "61–90"], ["over_90", "Over 90"], ["on_account", "On account"], ["total", "Net outstanding"]]
  return (
    <div className="space-y-6">
      <section className={cardCls}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Receivables ageing</h2>
            <p className="text-sm text-ink-4">Outstanding per customer by days past the due date; advances received on account are shown separately and netted off.</p>
          </div>
          <button onClick={() => download("/finance/customers/ageing/?output=xlsx", "customer-ageing.xlsx", setError)} className={`${btnCls} border border-border-strong`}>Excel</button>
        </div>
        {ageing && (ageing.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-ink-4 uppercase text-left"><th className="py-2 pr-3">Customer</th>{buckets.map(([, l]) => <th key={l} className="pr-3 text-right whitespace-nowrap">{l}</th>)}</tr></thead>
              <tbody className="divide-y divide-border dark:divide-slate-700">
                {ageing.rows.map((r) => (
                  <tr key={r.customer} className="cursor-pointer hover:bg-page" onClick={() => setCustomer(String(r.customer))}>
                    <td className="py-1.5 pr-3">{r.customer_name}</td>
                    {buckets.map(([k]) => <td key={k} className={`pr-3 text-right whitespace-nowrap ${k === "over_90" && Number(r[k]) ? "text-danger-text font-semibold" : ""}`}>{Number(r[k]) ? inr(r[k]) : "—"}</td>)}
                  </tr>
                ))}
                <tr className="font-semibold"><td className="py-1.5 pr-3">Total</td>{buckets.map(([k]) => <td key={k} className="pr-3 text-right whitespace-nowrap">{inr(ageing.totals[k])}</td>)}</tr>
              </tbody>
            </table>
          </div>
        ) : <div className="text-sm text-ink-4">Nothing outstanding.</div>)}
      </section>

      <section className={cardCls}>
        <div>
          <h2 className="text-lg font-bold">Customer ledger</h2>
          <p className="text-sm text-ink-4">Invoices, receipts, TDS and cancellations with the running balance.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs font-semibold text-ink-3 min-w-[220px]">Customer
            <select className={`${inputCls} mt-1`} value={customer} onChange={(e) => setCustomer(e.target.value)}>
              <option value="">Choose…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-ink-3">From<input type="date" className={`${inputCls} mt-1`} value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="text-xs font-semibold text-ink-3">To<input type="date" className={`${inputCls} mt-1`} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <button disabled={!customer} onClick={show} className={`${btnCls} bg-chip-bg dark:bg-slate-700 disabled:opacity-50`}>Show</button>
          <button disabled={!customer} onClick={() => download(`/finance/customers/${customer}/ledger/?start=${start}&end=${end}&output=xlsx`, `ledger-${start}-to-${end}.xlsx`, setError)} className={`${btnCls} border border-border-strong disabled:opacity-50`}>Excel</button>
        </div>
        {error && <div className="text-sm text-danger-text">{error}</div>}
        {ledger && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-ink-4 uppercase text-left"><th className="py-2 pr-3">Date</th><th className="pr-3">Particulars</th><th className="pr-3 text-right">Debit</th><th className="pr-3 text-right">Credit</th><th className="pr-3 text-right">Balance</th></tr></thead>
              <tbody className="divide-y divide-border dark:divide-slate-700">
                <tr className="text-ink-3"><td className="py-1.5" /><td className="pr-3">Opening balance</td><td /><td /><td className="pr-3 text-right">{inr(ledger.opening)}</td></tr>
                {ledger.rows.map((r, i) => (
                  <tr key={i}><td className="py-1.5 pr-3 whitespace-nowrap">{r.date}</td><td className="pr-3">{r.particulars}</td>
                    <td className="pr-3 text-right">{Number(r.debit) ? inr(r.debit) : ""}</td><td className="pr-3 text-right">{Number(r.credit) ? inr(r.credit) : ""}</td><td className="pr-3 text-right">{inr(r.balance)}</td></tr>
                ))}
                <tr className="font-semibold"><td className="py-1.5" /><td className="pr-3">Closing balance</td><td className="pr-3 text-right">{inr(ledger.debit)}</td><td className="pr-3 text-right">{inr(ledger.credit)}</td><td className="pr-3 text-right">{inr(ledger.closing)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function NewRecurringCard({ onSaved }: { onSaved: () => void }) {
  const customers = useList<Customer>("/finance/customers/?is_active=true&page_size=500")
  const [f, setF] = useState({ customer: "", name: "", frequency: "monthly", start_date: today(), end_date: "", auto_issue: true, auto_email: false, notes: "" })
  const [lines, setLines] = useState<InvoiceLine[]>([blankLine()])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  const save = async () => {
    setError(null)
    setNotice(null)
    try {
      await api.post("/finance/recurring-invoices/", { ...f, customer: Number(f.customer), end_date: f.end_date || null, lines: toPayload(lines) })
      setNotice("Saved. The first invoice is raised on the start date (the job runs every morning).")
      setLines([blankLine()])
      onSaved()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <section className={cardCls}>
      <div>
        <h2 className="text-lg font-bold">New recurring invoice</h2>
        <p className="text-sm text-ink-4">Raised automatically every period — rent, AMC, retainers. Missed periods are caught up, and a period is never invoiced twice.</p>
      </div>
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        <label className="text-xs font-semibold text-ink-3 lg:col-span-2">Customer
          <select className={`${inputCls} mt-1`} value={f.customer} onChange={(e) => set({ customer: e.target.value })}>
            <option value="">Choose…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-3 lg:col-span-2">Name<input className={`${inputCls} mt-1`} placeholder="e.g. Pharmacy space rent" value={f.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="text-xs font-semibold text-ink-3">Every
          <select className={`${inputCls} mt-1`} value={f.frequency} onChange={(e) => set({ frequency: e.target.value })}>
            <option value="monthly">Month</option><option value="quarterly">Quarter</option><option value="half_yearly">6 months</option><option value="yearly">Year</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-3">First invoice on<input type="date" className={`${inputCls} mt-1`} value={f.start_date} onChange={(e) => set({ start_date: e.target.value })} /></label>
        <label className="text-xs font-semibold text-ink-3">Stop after (optional)<input type="date" className={`${inputCls} mt-1`} value={f.end_date} onChange={(e) => set({ end_date: e.target.value })} /></label>
        <label className="text-sm flex items-center gap-2 lg:col-span-2"><input type="checkbox" checked={f.auto_issue} onChange={(e) => set({ auto_issue: e.target.checked })} /> Issue automatically (otherwise leave a draft)</label>
        <label className="text-sm flex items-center gap-2 lg:col-span-2"><input type="checkbox" checked={f.auto_email} onChange={(e) => set({ auto_email: e.target.checked })} /> Email it to the customer</label>
      </div>
      <InvoiceLinesEditor lines={lines} onChange={setLines} />
      <div className="flex items-center gap-3">
        <button disabled={!f.customer || !f.name} onClick={save} className={`${btnCls} bg-success text-white disabled:opacity-50`}>Save recurring invoice</button>
        {notice && <span className="text-sm text-success-text">{notice}</span>}
        {error && <span className="text-sm text-danger-text">{error}</span>}
      </div>
    </section>
  )
}

export function RecurringInvoicesPanel() {
  const [key, setKey] = useState(0)
  return (
    <div className="space-y-6">
      <NewRecurringCard onSaved={() => setKey((k) => k + 1)} />
      <ResourceTable key={key} config={{
        title: "Recurring invoices", endpoint: "/finance/recurring-invoices/", searchable: false,
        filters: [{ key: "is_active", label: "Active", type: "boolean" }],
        columns: [col("name", "Name"), col("customer_name", "Customer"), col("frequency", "Every"), col("next_run_date", "Next invoice"), col("end_date", "Until"),
          { key: "lines", label: "Amount", render: (r) => inr(lineTotals((r.lines ?? []).map((l: any) => ({ ...l, quantity: String(l.quantity ?? 1), rate: String(l.rate ?? 0), discount: String(l.discount ?? 0), gst_rate: String(l.gst_rate ?? 0) }))).total) },
          col("invoice_count", "Raised"), col("auto_issue", "Auto-issue"), col("is_active", "Active")],
        actions: [
          { label: "Pause", path: "", method: "patch", confirm: "Stop raising this invoice?", show: (r) => r.is_active, prompt: [{ key: "is_active", label: "Active", type: "boolean", defaultValue: false }] },
          { label: "Resume", path: "", method: "patch", show: (r) => !r.is_active, prompt: [{ key: "is_active", label: "Active", type: "boolean", defaultValue: true }] },
        ],
        toolbar: [{ label: "Raise due invoices now", path: "run-now/", method: "post" }],
      }} />
    </div>
  )
}
