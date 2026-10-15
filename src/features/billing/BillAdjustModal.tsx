import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import type { Bill } from "../../types/api"
import { useAuthStore } from "../../store/auth"

// Hold / release, lock / unlock (final bill), change patient category (re-price), and credit notes for one bill.

const inputCls = "w-full px-3 py-2 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const btn = "px-3 py-1.5 text-sm font-semibold rounded-lg disabled:opacity-50"
const inr = (n: number | string) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const CATEGORIES = ["general", "private", "insurance", "corporate", "staff"]

type Tab = "hold" | "lock" | "category" | "credit"

interface Preview { net_before: string; net_after: string; lines: { item: number; description: string; quantity: number; old_rate: string; new_rate: string }[] }
interface HoldEvent { action: string; reason: string; by: string; at: string }
interface CreditNote { id: number; note_number: string; reason: string; total_amount: string; settlement: string; refund_amount: string; created_at: string; created_by_name: string }

export function BillAdjustModal({ bill, onClose, onChanged }: { bill: Bill; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>(bill.is_locked ? "lock" : bill.on_hold ? "hold" : "credit")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<Bill>(bill)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError(extractApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 max-w-2xl w-full rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Bill {current.bill_number || `#${current.id}`}</h2>
            <div className="text-sm text-ink-4">Net {inr(current.net_amount)} · {current.status.replace("_", " ")} · category {current.patient_category}</div>
          </div>
          {current.on_hold && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-warning-bg text-warning-text">On hold</span>}
          {current.is_locked && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-chip-bg text-ink-2">🔒 Locked</span>}
        </div>
        <div className="flex gap-1.5" role="tablist">
          {([["credit", "Credit note"], ["category", "Change category"], ["hold", current.on_hold ? "Release hold" : "Put on hold"], ["lock", current.is_locked ? "Unlock" : "Lock bill"]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(null); setNotice(null) }}
              className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-lg ${tab === k ? "bg-brand text-white" : "border border-border-strong"}`}>{label}</button>
          ))}
        </div>
        {current.on_hold && tab !== "hold" && tab !== "lock" && (
          <div className="text-sm text-warning-text">On hold: {current.hold_reason}. Release it before changing the bill.</div>
        )}
        {current.is_locked && tab !== "lock" && (
          <div className="text-sm text-ink-3">This bill is locked (final). Unlock it before changing it; payments of any balance are still accepted.</div>
        )}
        {tab === "hold" && <HoldTab bill={current} busy={busy} run={run} setBill={setCurrent} setNotice={setNotice} />}
        {tab === "lock" && <LockTab bill={current} busy={busy} run={run} setBill={setCurrent} setNotice={setNotice} />}
        {tab === "category" && <CategoryTab bill={current} busy={busy} run={run} setBill={setCurrent} setNotice={setNotice} />}
        {tab === "credit" && <CreditTab bill={current} busy={busy} run={run} setBill={setCurrent} setNotice={setNotice} />}
        {notice && <div className="text-sm text-success-text" role="status">{notice}</div>}
        {error && <div className="text-sm text-danger-text" role="alert">{error}</div>}
        <div className="flex justify-end"><button className={`${btn} border border-border-strong`} onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

interface TabProps {
  bill: Bill
  busy: boolean
  run: (fn: () => Promise<void>) => Promise<void>
  setBill: (b: Bill) => void
  setNotice: (s: string | null) => void
}

function HoldTab({ bill, busy, run, setBill, setNotice }: TabProps) {
  const [text, setText] = useState("")
  const [history, setHistory] = useState<HoldEvent[]>([])
  const load = () => api.get<HoldEvent[]>(`/billing/bills/${bill.id}/hold-history/`).then(setHistory).catch(() => setHistory([]))
  useEffect(() => { load() }, [bill.id, bill.on_hold]) // eslint-disable-line react-hooks/exhaustive-deps
  const submit = () => run(async () => {
    const path = bill.on_hold ? "release" : "hold"
    const updated = await api.post<Bill>(`/billing/bills/${bill.id}/${path}/`, bill.on_hold ? { note: text } : { reason: text })
    setBill({ ...bill, ...updated })
    setText("")
    setNotice(bill.on_hold ? "Released." : "The bill is on hold.")
  })
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-4">
        {bill.on_hold
          ? `On hold since ${bill.held_at ? new Date(bill.held_at).toLocaleString("en-IN") : ""}: ${bill.hold_reason}`
          : "While a bill is on hold, nobody can add charges, take payments or payment links, change discounts, issue credit notes, re-price it, or discharge the patient (leaving against advice and deaths aren't held back)."}
      </p>
      <label className="text-xs font-semibold text-ink-3 block">{bill.on_hold ? "How was it resolved?" : "Reason"}
        <input className={`${inputCls} mt-1`} value={text} onChange={(e) => setText(e.target.value)} placeholder={bill.on_hold ? "e.g. Insurer approved the room category" : "e.g. Insurer query on room category"} />
      </label>
      <button disabled={busy || !text.trim()} onClick={submit} className={`${btn} ${bill.on_hold ? "bg-success text-white" : "bg-warning text-white"}`}>
        {bill.on_hold ? "Release hold" : "Put on hold"}
      </button>
      {history.length > 0 && (
        <ul className="text-[12.5px] text-ink-3 space-y-0.5 border-t border-border pt-2">
          {history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString("en-IN")} · {EVENT_LABEL[h.action] ?? h.action} by {h.by || "system"}: {h.reason}</li>)}
        </ul>
      )}
    </div>
  )
}

const EVENT_LABEL: Record<string, string> = { hold: "Held", release: "Released", lock: "Locked", unlock: "Unlocked" }

function LockTab({ bill, busy, run, setBill, setNotice }: TabProps) {
  const perms = useAuthStore((s) => s.user?.permissions ?? [])
  const canLock = perms.includes("billing.lock_bill")
  const canUnlock = perms.includes("billing.unlock_bill")
  const [text, setText] = useState("")
  const submit = () => run(async () => {
    const path = bill.is_locked ? "unlock" : "lock"
    const updated = await api.post<Bill>(`/billing/bills/${bill.id}/${path}/`, bill.is_locked ? { reason: text } : { note: text })
    setBill(updated)
    setText("")
    setNotice(bill.is_locked ? "Unlocked." : "The bill is locked (final).")
  })
  if (bill.is_locked && !canUnlock) {
    return <div className="text-sm text-ink-3">Locked by {bill.locked_by_name || "—"}{bill.locked_at ? ` on ${new Date(bill.locked_at).toLocaleString("en-IN")}` : ""}. Only billing managers can unlock it.</div>
  }
  if (!bill.is_locked && !canLock) return <div className="text-sm text-ink-3">You don't have permission to lock bills.</div>
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-3">
        {bill.is_locked
          ? `Locked by ${bill.locked_by_name || "—"}${bill.locked_at ? ` on ${new Date(bill.locked_at).toLocaleString("en-IN")}` : ""}. Unlocking lets the bill be changed again and is recorded.`
          : "Locking makes this the final bill: no charges, discounts, credit notes, re-pricing or edits until it is unlocked. Payments of any balance are still accepted. A hold on the bill is released. An admitted patient's running bill can be locked after discharge."}
      </p>
      <label className="text-xs font-semibold text-ink-3 block">{bill.is_locked ? "Why is it being reopened?" : "Note (optional)"}
        <input className={`${inputCls} mt-1`} value={text} onChange={(e) => setText(e.target.value)} placeholder={bill.is_locked ? "e.g. Insurer revised the approval" : "e.g. Final bill after discharge"} />
      </label>
      <button disabled={busy || (bill.is_locked && !text.trim())} onClick={submit} className={`${btn} ${bill.is_locked ? "border border-border-strong" : "bg-ink text-white"}`}>
        {bill.is_locked ? "Unlock bill" : "Lock bill"}
      </button>
    </div>
  )
}

function CategoryTab({ bill, busy, run, setBill, setNotice }: TabProps) {
  const [category, setCategory] = useState(CATEGORIES.find((c) => c !== bill.patient_category) ?? "general")
  const [preview, setPreview] = useState<Preview | null>(null)
  const call = (previewOnly: boolean) => run(async () => {
    const res = await api.post<Preview & { applied: boolean }>(`/billing/bills/${bill.id}/change-category/`, { category, preview: previewOnly })
    setPreview(res)
    if (res.applied) {
      setBill({ ...bill, patient_category: category, net_amount: res.net_after })
      setNotice(`Re-priced as ${category}: ${res.lines.length} line${res.lines.length === 1 ? "" : "s"} changed.`)
    }
  })
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-4">Re-prices the bill's tariff lines at the new category's rates. Lines entered with a manual price are kept. A fully paid bill isn't re-priced — issue a credit note instead.</p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs font-semibold text-ink-3">New category
          <select className={`${inputCls} mt-1`} value={category} onChange={(e) => { setCategory(e.target.value); setPreview(null) }}>
            {CATEGORIES.filter((c) => c !== bill.patient_category).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button disabled={busy} onClick={() => call(true)} className={`${btn} border border-border-strong`}>Preview</button>
        <button disabled={busy || !preview} onClick={() => call(false)} className={`${btn} bg-brand text-white`}>Apply</button>
      </div>
      {preview && (
        <div className="text-sm">
          {preview.lines.length === 0 ? <div className="text-ink-4">No tariff line changes price.</div> : (
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-left text-ink-4"><th className="py-1">Service</th><th>Qty</th><th>Rate now</th><th>New rate</th></tr></thead>
              <tbody>{preview.lines.map((l) => <tr key={l.item}><td className="py-0.5">{l.description}</td><td>{l.quantity}</td><td>{inr(l.old_rate)}</td><td>{inr(l.new_rate)}</td></tr>)}</tbody>
            </table>
          )}
          <div className="mt-1 font-semibold">Net {inr(preview.net_before)} → {inr(preview.net_after)}</div>
        </div>
      )}
    </div>
  )
}

function CreditTab({ bill, busy, run, setBill, setNotice }: TabProps) {
  const [mode, setMode] = useState<"spread" | "lines">("spread")
  const [amount, setAmount] = useState("")
  const [lineAmounts, setLineAmounts] = useState<Record<number, string>>({})
  const [reason, setReason] = useState("")
  const [settlement, setSettlement] = useState("reduce_due")
  const [refundMethod, setRefundMethod] = useState("cash")
  const [refundRef, setRefundRef] = useState("")
  const [notes, setNotes] = useState<CreditNote[]>([])
  const load = () => api.get<CreditNote[]>(`/billing/bills/${bill.id}/credit-notes/`).then(setNotes).catch(() => setNotes([]))
  useEffect(() => { load() }, [bill.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const lines = (bill.items ?? []).filter((i) => Number(i.total_price) > 0 && i.source !== "credit_note")
  const paidSoFar = (bill.payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const submit = () => run(async () => {
    const body: Record<string, unknown> = { reason, settlement, refund_method: refundMethod, refund_reference: refundRef }
    if (mode === "spread") body.amount = amount
    else body.items = Object.entries(lineAmounts).filter(([, v]) => Number(v) > 0).map(([item, v]) => ({ item: Number(item), amount: v }))
    const res = await api.post<{ credit_note: CreditNote; bill: Bill }>(`/billing/bills/${bill.id}/credit-note/`, body)
    setBill(res.bill)
    setNotice(`${res.credit_note.note_number}: ${inr(res.credit_note.total_amount)} credited${Number(res.credit_note.refund_amount) ? `, ${inr(res.credit_note.refund_amount)} ${settlement === "refund" ? "refunded" : "kept as advance"}` : ""}.`)
    setAmount("")
    setLineAmounts({})
    setReason("")
    load()
  })
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-4">Amounts are before GST; GST is credited with them. Paid so far: {inr(paidSoFar)}. If more has been paid than the new total, refund the difference or keep it as the patient's advance.</p>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "spread"} onChange={() => setMode("spread")} /> One amount, spread across the services</label>
        <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "lines"} onChange={() => setMode("lines")} /> Per service</label>
      </div>
      {mode === "spread" ? (
        <label className="text-xs font-semibold text-ink-3 block">Amount to credit (before GST)<input type="number" min={0} className={`${inputCls} mt-1`} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      ) : (
        <div className="space-y-1.5">
          {lines.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_120px] gap-2 items-center text-sm">
              <span>{l.description} <span className="text-ink-4">({inr(l.total_price)})</span></span>
              <input aria-label={`Credit for ${l.description}`} type="number" min={0} className={inputCls} value={lineAmounts[l.id] ?? ""} onChange={(e) => setLineAmounts({ ...lineAmounts, [l.id]: e.target.value })} />
            </div>
          ))}
        </div>
      )}
      <label className="text-xs font-semibold text-ink-3 block">Reason<input className={`${inputCls} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="text-xs font-semibold text-ink-3">If already paid beyond the new total
          <select className={`${inputCls} mt-1`} value={settlement} onChange={(e) => setSettlement(e.target.value)}>
            <option value="reduce_due">Nothing paid beyond it (reduce the due)</option>
            <option value="advance">Keep as the patient's advance</option>
            <option value="refund">Refund to the patient</option>
          </select>
        </label>
        {settlement === "refund" && (
          <>
            <label className="text-xs font-semibold text-ink-3">Refund by
              <select className={`${inputCls} mt-1`} value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                {["cash", "upi", "bank_transfer", "cheque", "card"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-ink-3">Reference<input className={`${inputCls} mt-1`} value={refundRef} onChange={(e) => setRefundRef(e.target.value)} /></label>
          </>
        )}
      </div>
      <button disabled={busy || !reason.trim() || (mode === "spread" ? !Number(amount) : !Object.values(lineAmounts).some((v) => Number(v) > 0))} onClick={submit} className={`${btn} bg-brand text-white`}>
        Issue credit note
      </button>
      {notes.length > 0 && (
        <ul className="text-[12.5px] text-ink-3 space-y-0.5 border-t border-border pt-2">
          {notes.map((n) => <li key={n.id}>{n.note_number} · {new Date(n.created_at).toLocaleDateString("en-IN")} · {inr(n.total_amount)} · {n.reason}{Number(n.refund_amount) ? ` · ${inr(n.refund_amount)} ${n.settlement === "refund" ? "refunded" : "to advance"}` : ""}</li>)}
        </ul>
      )}
    </div>
  )
}
