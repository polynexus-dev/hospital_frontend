import { useCallback, useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { ResourceTable } from "../../components/resource/ResourceTable"
import { col, opts } from "../nabh/fields"
import { btnCls, cardCls, download, inputCls, inr, today, useAccounts } from "./ui"

// Accounts books: manual vouchers (maker-checker), the day book, and the
// hospital's supplier details for tax invoices.

interface VoucherLine { account: string; debit: string; credit: string }

const VOUCHER_TYPES = [
  { value: "journal", label: "Journal" }, { value: "payment", label: "Payment" }, { value: "receipt", label: "Receipt" },
  { value: "contra", label: "Contra (cash ↔ bank)" }, { value: "debit_note", label: "Debit note" }, { value: "credit_note", label: "Credit note" },
]

function NewVoucherCard({ onSaved }: { onSaved: () => void }) {
  const accounts = useAccounts()
  const blank = (): VoucherLine => ({ account: "", debit: "", credit: "" })
  const [type, setType] = useState("journal")
  const [date, setDate] = useState(today())
  const [party, setParty] = useState("")
  const [narration, setNarration] = useState("")
  const [lines, setLines] = useState<VoucherLine[]>([blank(), blank()])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const dr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const cr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const setLine = (i: number, patch: Partial<VoucherLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const save = async () => {
    setError(null)
    setNotice(null)
    try {
      const v = await api.post<any>("/finance/journal/", {
        voucher_type: type, entry_date: date, party_name: party, narration,
        lines: lines.filter((l) => l.account).map((l) => ({ account: l.account, debit: l.debit || 0, credit: l.credit || 0 })),
      })
      setNotice(v.status === "pending" ? `${v.voucher_number} saved — waiting for approval.` : `${v.voucher_number} posted.`)
      setLines([blank(), blank()])
      setNarration("")
      setParty("")
      onSaved()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <section className={cardCls}>
      <div>
        <h2 className="text-lg font-bold">New voucher</h2>
        <p className="text-sm text-ink-4">Debits must equal credits. When approval is required (Accounts settings), the voucher posts only after someone else approves it.</p>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <label className="text-xs font-semibold text-ink-3">Type
          <select className={`${inputCls} mt-1`} value={type} onChange={(e) => setType(e.target.value)}>{VOUCHER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </label>
        <label className="text-xs font-semibold text-ink-3">Date<input type="date" className={`${inputCls} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="text-xs font-semibold text-ink-3 md:col-span-2">Party<input className={`${inputCls} mt-1`} value={party} onChange={(e) => setParty(e.target.value)} /></label>
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_110px_32px] gap-2 items-center">
            <select aria-label={`Ledger ${i + 1}`} className={inputCls} value={l.account} onChange={(e) => setLine(i, { account: e.target.value })}>
              <option value="">Ledger…</option>
              {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
            </select>
            <input aria-label={`Debit ${i + 1}`} type="number" min={0} placeholder="Debit" className={inputCls} value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
            <input aria-label={`Credit ${i + 1}`} type="number" min={0} placeholder="Credit" className={inputCls} value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
            <button aria-label="Remove line" className="text-ink-4 hover:text-danger-text" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length <= 2}>×</button>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_110px_110px_32px] gap-2 text-sm font-semibold">
          <button className="text-left text-brand text-sm" onClick={() => setLines([...lines, blank()])}>+ Add line</button>
          <span>{inr(dr)}</span><span>{inr(cr)}</span><span />
        </div>
        {dr !== cr && <div className="text-xs text-warning-text">Difference {inr(Math.abs(dr - cr))}</div>}
      </div>
      <label className="text-xs font-semibold text-ink-3 block">Narration<input className={`${inputCls} mt-1`} value={narration} onChange={(e) => setNarration(e.target.value)} /></label>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!dr || dr !== cr} className={`${btnCls} bg-success text-white disabled:opacity-50`}>Save voucher</button>
        {notice && <span className="text-sm text-success-text">{notice}</span>}
        {error && <span className="text-sm text-danger-text">{error}</span>}
      </div>
    </section>
  )
}

export function VouchersPanel() {
  const [key, setKey] = useState(0)
  return (
    <div className="space-y-6">
      <NewVoucherCard onSaved={() => setKey((k) => k + 1)} />
      <ResourceTable key={key} config={{
        title: "Vouchers",
        description: "Every voucher — posted automatically from bills, receipts, purchases and payouts, or entered by hand. Manual vouchers wait for approval by someone other than the person who entered them; only posted vouchers count in the day book, trial balance and Tally.",
        endpoint: "/finance/journal/", searchable: false,
        filters: [
          { key: "status", label: "Status", type: "select", options: [{ value: "pending", label: "Pending approval" }, { value: "approved", label: "Posted" }, { value: "rejected", label: "Rejected" }] },
          { key: "voucher_type", label: "Voucher", type: "select", options: opts("sales", "receipt", "purchase", "payment", "journal", "contra", "debit_note", "credit_note") },
          { key: "is_manual", label: "Manual only", type: "boolean" },
        ],
        columns: [col("entry_date", "Date"), col("voucher_type", "Voucher"), col("voucher_number", "No."), col("party_name", "Party"), col("narration", "Narration"),
          { key: "lines", label: "Dr / Cr", render: (r) => (r.lines ?? []).map((l: any) => `${l.account}: ${l.debit ? `Dr ${l.debit}` : `Cr ${l.credit}`}`).join(" · ") },
          { key: "status", label: "Status", render: (r) => (r.status === "approved" ? "Posted" : r.status === "pending" ? "Pending approval" : `Rejected: ${r.rejection_reason}`) },
          { key: "created_by_name", label: "Entered / approved by", render: (r) => [r.created_by_name, r.approved_by_name].filter(Boolean).join(" → ") || "System" },
          col("exported_to_tally_at", "Tally export")],
        actions: [
          { label: "Approve", path: "approve/", tone: "primary", confirm: "Post this voucher to the books?", show: (r) => r.status === "pending" },
          { label: "Reject", path: "reject/", tone: "danger", prompt: [{ key: "reason", label: "Reason (the maker sees it)", required: true }], show: (r) => r.status === "pending" },
          { label: "Resubmit", path: "", method: "patch", prompt: [{ key: "narration", label: "Narration" }], show: (r) => r.status === "rejected" },
          { label: "Delete", path: "", method: "delete", tone: "danger", confirm: "Delete this unposted voucher?", show: (r) => r.is_manual && r.status !== "approved" },
        ],
        toolbar: [
          { label: "Tally vouchers XML", path: "../tally-export/", method: "get", download: "tally-vouchers.xml" },
          { label: "Tally ledgers XML", path: "../tally-export/?masters=1", method: "get", download: "tally-ledgers.xml" },
          { label: "GST outward (xlsx)", path: "../gst/?export=xlsx", method: "get", download: "gst-outward.xlsx" },
          { label: "GST HSN summary (csv)", path: "../gst/?export=csv&section=hsn", method: "get", download: "gst-hsn.csv" },
          { label: "GST inward / ITC (csv)", path: "../gst/?kind=inward&export=csv", method: "get", download: "gst-inward.csv" },
        ],
      }} />
    </div>
  )
}

interface DayBookRow {
  id: number; date: string; voucher_type: string; voucher_number: string; party: string; narration: string; status: string
  lines: { account_code: string; account: string; debit: string; credit: string }[]; debit: string; credit: string
}
interface DayBook {
  count: number; page: number; pages: number; results: DayBookRow[]
  page_totals: { debit: string; credit: string }; totals: { debit: string; credit: string; vouchers: number; by_type: Record<string, number> }
}

export function DayBookPanel() {
  const accounts = useAccounts()
  const [f, setF] = useState({ start: today(), end: today(), voucher_type: "", account: "", party: "", search: "", status: "approved" })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<DayBook | null>(null)
  const [error, setError] = useState<string | null>(null)
  const query = (extra: Record<string, string> = {}) => new URLSearchParams(Object.entries({ ...f, ...extra }).filter(([, v]) => v)).toString()
  const load = useCallback(async (p: number) => {
    setError(null)
    try {
      setData(await api.get<DayBook>(`/finance/day-book/?${query({ page: String(p), page_size: "50" })}`))
      setPage(p)
    } catch (e) {
      setError(extractApiError(e))
    }
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  return (
    <section className={cardCls}>
      <div>
        <h2 className="text-lg font-bold">Day book</h2>
        <p className="text-sm text-ink-4">Every voucher in the period with its ledger lines, page totals and period totals.</p>
      </div>
      <div className="grid md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
        <label className="text-xs font-semibold text-ink-3">From<input type="date" className={`${inputCls} mt-1`} value={f.start} onChange={(e) => set({ start: e.target.value })} /></label>
        <label className="text-xs font-semibold text-ink-3">To<input type="date" className={`${inputCls} mt-1`} value={f.end} onChange={(e) => set({ end: e.target.value })} /></label>
        <label className="text-xs font-semibold text-ink-3">Voucher
          <select className={`${inputCls} mt-1`} value={f.voucher_type} onChange={(e) => set({ voucher_type: e.target.value })}>
            <option value="">All</option>{["sales", "receipt", "purchase", "payment", "journal", "contra", "debit_note", "credit_note"].map((v) => <option key={v} value={v}>{v.replace("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-3 lg:col-span-2">Ledger
          <select className={`${inputCls} mt-1`} value={f.account} onChange={(e) => set({ account: e.target.value })}>
            <option value="">All ledgers</option>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-3">Party<input className={`${inputCls} mt-1`} value={f.party} onChange={(e) => set({ party: e.target.value })} /></label>
        <label className="text-xs font-semibold text-ink-3">Status
          <select className={`${inputCls} mt-1`} value={f.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="approved">Posted</option><option value="pending">Pending approval</option><option value="rejected">Rejected</option><option value="all">All</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-3">Voucher no. / narration<input className={`${inputCls} mt-1`} value={f.search} onChange={(e) => set({ search: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => load(1)} className={`${btnCls} bg-chip-bg dark:bg-slate-700`}>Show</button>
        <button onClick={() => download(`/finance/day-book/?${query({ output: "xlsx" })}`, `day-book-${f.start}-to-${f.end}.xlsx`, setError)} className={`${btnCls} border border-border-strong`}>Excel</button>
        <button onClick={() => download(`/finance/day-book/?${query({ output: "csv" })}`, `day-book-${f.start}-to-${f.end}.csv`, setError)} className={`${btnCls} border border-border-strong`}>CSV</button>
      </div>
      {error && <div className="text-sm text-danger-text">{error}</div>}
      {data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-ink-4 uppercase text-left"><th className="py-2 pr-3">Date</th><th className="pr-3">Voucher</th><th className="pr-3">Party / narration</th><th className="pr-3">Ledger</th><th className="pr-3 text-right">Debit</th><th className="pr-3 text-right">Credit</th></tr></thead>
              <tbody>
                {data.results.map((v) => v.lines.map((l, i) => (
                  <tr key={`${v.id}-${i}`} className={i === 0 ? "border-t border-border dark:border-slate-700" : ""}>
                    <td className="py-1 pr-3 whitespace-nowrap align-top">{i === 0 ? v.date : ""}</td>
                    <td className="pr-3 whitespace-nowrap align-top">{i === 0 ? <>{v.voucher_number} <span className="text-ink-4">{v.voucher_type.replace("_", " ")}{v.status !== "approved" ? ` · ${v.status}` : ""}</span></> : ""}</td>
                    <td className="pr-3 align-top text-ink-3">{i === 0 ? [v.party, v.narration].filter(Boolean).join(" — ") : ""}</td>
                    <td className="pr-3">{l.account_code} {l.account}</td>
                    <td className="pr-3 text-right whitespace-nowrap">{Number(l.debit) ? inr(l.debit) : ""}</td>
                    <td className="pr-3 text-right whitespace-nowrap">{Number(l.credit) ? inr(l.credit) : ""}</td>
                  </tr>
                )))}
                {data.results.length === 0 && <tr><td colSpan={6} className="py-3 text-ink-4">No vouchers.</td></tr>}
              </tbody>
              <tfoot className="font-semibold border-t-2 border-border-strong">
                <tr><td colSpan={4} className="py-1.5">Page total</td><td className="text-right pr-3">{inr(data.page_totals.debit)}</td><td className="text-right pr-3">{inr(data.page_totals.credit)}</td></tr>
                <tr><td colSpan={4} className="py-1.5">Period total ({data.count} voucher{data.count === 1 ? "" : "s"})</td><td className="text-right pr-3">{inr(data.totals.debit)}</td><td className="text-right pr-3">{inr(data.totals.credit)}</td></tr>
              </tfoot>
            </table>
          </div>
          {data.pages > 1 && (
            <div className="flex items-center gap-3 text-sm">
              <button className={`${btnCls} border border-border-strong disabled:opacity-40`} disabled={page <= 1} onClick={() => load(page - 1)}>Previous</button>
              <span>Page {data.page} of {data.pages}</span>
              <button className={`${btnCls} border border-border-strong disabled:opacity-40`} disabled={page >= data.pages} onClick={() => load(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

interface AccountsSettings {
  legal_name: string; gstin: string; pan: string; state_code: string; invoice_prefix: string; bank_details: string; invoice_terms: string; voucher_approval_required: boolean
}

export function AccountsSettingsPanel() {
  const [s, setS] = useState<AccountsSettings | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get<AccountsSettings>("/finance/accounts-settings/").then(setS).catch((e) => setError(extractApiError(e))) }, [])
  if (!s) return error ? <div className="text-sm text-danger-text">{error}</div> : null
  const set = (patch: Partial<AccountsSettings>) => setS({ ...s, ...patch })
  const save = async () => {
    setError(null)
    setNotice(null)
    try {
      setS(await api.put<AccountsSettings>("/finance/accounts-settings/", s))
      setNotice("Saved.")
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const field = (k: keyof AccountsSettings, label: string, placeholder = "") => (
    <label className="text-xs font-semibold text-ink-3">{label}<input className={`${inputCls} mt-1`} placeholder={placeholder} value={String(s[k] ?? "")} onChange={(e) => set({ [k]: e.target.value } as Partial<AccountsSettings>)} /></label>
  )
  return (
    <section className={cardCls}>
      <div>
        <h2 className="text-lg font-bold">Accounts settings</h2>
        <p className="text-sm text-ink-4">Printed on customer tax invoices. The state code decides CGST + SGST (same state) or IGST (another state).</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {field("legal_name", "Legal name (blank = hospital name)")}
        {field("gstin", "GSTIN", "27ABCDE1234F1Z5")}
        {field("pan", "PAN")}
        {field("state_code", "GST state code", "27")}
        {field("invoice_prefix", "Invoice number prefix", "INV")}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-xs font-semibold text-ink-3">Bank details on invoices<textarea rows={3} className={`${inputCls} mt-1`} value={s.bank_details} onChange={(e) => set({ bank_details: e.target.value })} /></label>
        <label className="text-xs font-semibold text-ink-3">Invoice terms<textarea rows={3} className={`${inputCls} mt-1`} value={s.invoice_terms} onChange={(e) => set({ invoice_terms: e.target.value })} /></label>
      </div>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={s.voucher_approval_required} onChange={(e) => set({ voucher_approval_required: e.target.checked })} />
        Manual vouchers need approval by a second person before they post
      </label>
      <div className="flex items-center gap-3">
        <button onClick={save} className={`${btnCls} bg-success text-white`}>Save</button>
        {notice && <span className="text-sm text-success-text">{notice}</span>}
        {error && <span className="text-sm text-danger-text">{error}</span>}
      </div>
    </section>
  )
}
