import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { extractApiError } from "../../api/client"
import { getBill, listBillCreditNotes, type BillCreditNote } from "../../api/billing"
import type { Bill } from "../../types/api"
import { Drawer, DrawerSection } from "../../components/ui/Drawer"
import { StatusPill, dateTime, money } from "../../components/record/format"

const th = "px-3 py-2 font-semibold whitespace-nowrap"
const td = "px-3 py-2 align-top"
const btn = "px-2.5 py-1 text-xs font-semibold rounded-control"

/** Everything about one bill: patient, line items, totals, payments, claim, credit notes, actions. */
export function BillDrawer({
  billId,
  refreshKey,
  highlightPaymentId,
  onClose,
  onDownload,
  onAddItem,
  onPay,
  onClaim,
  onAdjust,
}: {
  billId: number
  /** bump to reload after an action taken from the page's modals */
  refreshKey: number
  highlightPaymentId?: number
  onClose: () => void
  onDownload: (b: Bill) => void
  onAddItem: (b: Bill) => void
  onPay: (b: Bill) => void
  onClaim: (b: Bill) => void
  onAdjust: (b: Bill) => void
}) {
  const [bill, setBill] = useState<Bill | null>(null)
  const [creditNotes, setCreditNotes] = useState<BillCreditNote[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [b, notes] = await Promise.all([getBill(billId), listBillCreditNotes(billId).catch(() => [])])
      setBill(b)
      setCreditNotes(Array.isArray(notes) ? notes : [])
    } catch (e) {
      setError(extractApiError(e))
    }
  }, [billId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const p = bill?.patient_detail
  const patientName = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : bill ? `Patient #${bill.patient}` : ""
  const items = bill?.items ?? []
  const payments = bill?.payments ?? []
  const paid = payments.reduce((s, x) => s + Number(x.amount), 0)
  const credited = creditNotes.reduce((s, x) => s + Number(x.total_amount), 0)
  const balance = bill ? Math.max(0, Number(bill.net_amount) - paid - credited) : 0
  const claim = bill?.insurance_claim

  return (
    <Drawer
      wide
      onClose={onClose}
      title={bill ? (bill.bill_number ? `Bill ${bill.bill_number}` : `Bill #${bill.id}`) : `Bill #${billId}`}
      subtitle={bill ? `${patientName} · ${dateTime(bill.created_at)}` : "Loading…"}
      badges={
        bill && (
          <>
            <StatusPill value={bill.status} />
            {bill.on_hold && <span className="px-2 py-0.5 text-xs font-semibold rounded bg-warning-bg text-warning-text" title={bill.hold_reason}>On hold</span>}
            {bill.is_locked && <span className="px-2 py-0.5 text-xs font-semibold rounded bg-chip-bg text-ink-2" title={`Locked by ${bill.locked_by_name || ""}`}>🔒 Locked</span>}
            {bill.is_interim && <span className="px-2 py-0.5 text-xs font-semibold rounded bg-chip-bg text-ink-2">Interim</span>}
            {bill.admission && <span className="px-2 py-0.5 text-xs font-semibold rounded bg-brand-tint text-brand-dark">IPD · admission #{bill.admission}</span>}
            {bill.patient_category && <span className="px-2 py-0.5 text-xs font-semibold rounded bg-chip-bg text-ink-2 capitalize">{bill.patient_category.replace(/_/g, " ")}</span>}
          </>
        )
      }
      actions={
        bill && (
          <>
            <button className={`${btn} bg-chip-bg dark:bg-slate-700 text-ink dark:text-slate-200 hover:bg-border-soft`} onClick={() => onDownload(bill)}>📄 PDF</button>
            <button className={`${btn} bg-brand-tint text-brand-dark hover:bg-brand-border disabled:opacity-50`} disabled={bill.on_hold || bill.is_locked} onClick={() => onAddItem(bill)}>+ Add item</button>
            <button className={`${btn} bg-success-bg text-success-text hover:bg-success/25 disabled:opacity-50`} disabled={bill.on_hold || balance <= 0} onClick={() => onPay(bill)}>+ Pay</button>
            {!claim && <button className={`${btn} bg-accent-tint text-accent-hover hover:bg-accent/25`} onClick={() => onClaim(bill)}>+ Claim</button>}
            <button className={`${btn} border border-border-strong hover:bg-page`} onClick={() => onAdjust(bill)}>Hold / lock / credit / category</button>
          </>
        )
      }
    >
      {error && <div className="text-sm text-danger-text bg-danger-bg rounded-control px-3 py-2">{error}</div>}
      {!bill && !error && <div className="py-10 text-center text-ink-4">Loading bill…</div>}
      {bill && (
        <>
          {bill.on_hold && (
            <div className="text-sm text-warning-text bg-warning-bg rounded-control px-3 py-2">
              On hold{bill.held_at ? ` since ${dateTime(bill.held_at)}` : ""}: {bill.hold_reason || "no reason given"}
            </div>
          )}

          <DrawerSection
            title="Patient"
            aside={<Link to={`/patients/${bill.patient}`} className="text-xs font-semibold text-brand hover:underline">Open patient profile →</Link>}
          >
            <div className="rounded-card border border-border dark:border-slate-700 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Info label="Name" value={patientName} />
              <Info label="Mobile" value={p?.mobile} />
              <Info label="UHID / MRN" value={(p?.uhid ?? p?.mrn ?? p?.patient_code) as string | undefined} />
              <Info label="Insurance" value={[p?.insurance_provider, p?.insurance_policy_number].filter(Boolean).join(" · ") || undefined} />
            </div>
          </DrawerSection>

          <DrawerSection title={`Line items (${items.length})`}>
            {items.length === 0 ? (
              <div className="text-sm text-ink-4">No items on this bill yet.</div>
            ) : (
              <div className="overflow-x-auto border border-border dark:border-slate-700 rounded-card">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="bg-page dark:bg-slate-800 text-[11px] uppercase text-ink-4">
                      <th className={th}>Description</th>
                      <th className={th}>Date</th>
                      <th className={`${th} text-right`}>Qty</th>
                      <th className={`${th} text-right`}>Rate</th>
                      <th className={`${th} text-right`}>GST</th>
                      <th className={`${th} text-right`}>Amount (excl. GST)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-slate-700">
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className={td}>
                          <div className="text-ink dark:text-slate-100">{it.description}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {it.source && <span className="text-[10.5px] px-1.5 rounded bg-chip-bg text-ink-3 capitalize">{it.source.replace(/_/g, " ")}</span>}
                            {it.hsn_sac && <span className="text-[10.5px] text-ink-5">HSN/SAC {it.hsn_sac}</span>}
                            {it.non_payable && <span className="text-[10.5px] px-1.5 rounded bg-warning-bg text-warning-text" title={it.non_payable_reason}>Not covered by insurer</span>}
                          </div>
                        </td>
                        <td className={`${td} whitespace-nowrap text-ink-3`}>{it.service_date ? dateTime(it.service_date) : "—"}</td>
                        <td className={`${td} text-right tabular-nums`}>{it.quantity}</td>
                        <td className={`${td} text-right tabular-nums`}>{money(it.unit_price)}</td>
                        <td className={`${td} text-right tabular-nums text-ink-3`}>
                          {Number(it.gst_rate ?? 0) > 0 ? `${Number(it.gst_rate)}% · ${money(it.tax_amount)}` : "—"}
                        </td>
                        <td className={`${td} text-right tabular-nums font-semibold`}>{money(it.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Summary">
            <div className="rounded-card border border-border dark:border-slate-700 p-3 text-sm space-y-1.5 max-w-sm ml-auto">
              <Line label="Subtotal (before GST)" value={money(bill.total_amount)} />
              {Number(bill.tax_amount ?? 0) > 0 && <Line label="GST" value={`+ ${money(bill.tax_amount)}`} />}
              {Number(bill.discount_amount) > 0 && <Line label="Discount" value={`− ${money(bill.discount_amount)}`} />}
              <Line label="Net amount" value={money(bill.net_amount)} strong />
              {Number(bill.non_payable_amount ?? 0) > 0 && <Line label="Not covered by insurer (patient pays)" value={money(bill.non_payable_amount)} muted />}
              <Line label="Paid" value={money(paid)} />
              {credited > 0 && <Line label="Credit notes" value={`− ${money(credited)}`} />}
              <div className="border-t border-border dark:border-slate-700 pt-1.5">
                <Line label="Balance due" value={money(balance)} strong tone={balance > 0 ? "text-danger-text" : "text-success-text"} />
              </div>
            </div>
          </DrawerSection>

          <DrawerSection title={`Payments (${payments.length})`}>
            {payments.length === 0 ? (
              <div className="text-sm text-ink-4">No payments recorded.</div>
            ) : (
              <div className="overflow-x-auto border border-border dark:border-slate-700 rounded-card">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="bg-page dark:bg-slate-800 text-[11px] uppercase text-ink-4">
                      <th className={th}>Paid at</th>
                      <th className={th}>Method</th>
                      <th className={th}>Transaction ID</th>
                      <th className={`${th} text-right`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-slate-700">
                    {payments.map((pm) => (
                      <tr key={pm.id} className={pm.id === highlightPaymentId ? "bg-brand-tint/60 dark:bg-slate-800" : ""}>
                        <td className={`${td} whitespace-nowrap`}>{dateTime(pm.paid_at)}</td>
                        <td className={`${td} uppercase`}>{pm.payment_method.replace(/_/g, " ")}</td>
                        <td className={`${td} font-mono text-xs`}>{pm.transaction_id || "—"}</td>
                        <td className={`${td} text-right tabular-nums font-semibold`}>{money(pm.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DrawerSection>

          <DrawerSection title="Insurance / TPA claim">
            {claim ? (
              <div className="rounded-card border border-border dark:border-slate-700 p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Info label="Insurer / TPA" value={claim.insurance_company} />
                <Info label="Policy number" value={claim.policy_number} />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-4">Status</div>
                  <StatusPill value={claim.status} />
                </div>
                <Info label="Claimed" value={money(claim.claimed_amount)} />
                <Info label="Approved" value={money(claim.approved_amount)} />
                <Info label="Claim #" value={String(claim.id)} />
              </div>
            ) : (
              <div className="text-sm text-ink-4">No claim raised for this bill.</div>
            )}
          </DrawerSection>

          {creditNotes.length > 0 && (
            <DrawerSection title={`Credit notes (${creditNotes.length})`}>
              <div className="overflow-x-auto border border-border dark:border-slate-700 rounded-card">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="bg-page dark:bg-slate-800 text-[11px] uppercase text-ink-4">
                      <th className={th}>Note</th>
                      <th className={th}>Date</th>
                      <th className={th}>Reason</th>
                      <th className={th}>Settlement</th>
                      <th className={`${th} text-right`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-slate-700">
                    {creditNotes.map((n) => (
                      <tr key={n.id}>
                        <td className={td}>{n.note_number || `#${n.id}`}</td>
                        <td className={`${td} whitespace-nowrap`}>{dateTime(n.created_at)}</td>
                        <td className={td}>{n.reason}{n.created_by_name ? <div className="text-[11px] text-ink-5">by {n.created_by_name}</div> : null}</td>
                        <td className={`${td} capitalize`}>{n.settlement?.replace(/_/g, " ")}{Number(n.refund_amount) > 0 ? ` · refund ${money(n.refund_amount)}` : ""}</td>
                        <td className={`${td} text-right tabular-nums font-semibold`}>{money(n.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DrawerSection>
          )}
        </>
      )}
    </Drawer>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-4">{label}</div>
      <div className="text-ink dark:text-slate-100 break-words">{value || "—"}</div>
    </div>
  )
}

function Line({ label, value, strong, muted, tone }: { label: string; value: string; strong?: boolean; muted?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between gap-4 ${muted ? "text-ink-4" : "text-ink-2 dark:text-slate-200"}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${strong ? "font-bold" : ""} ${tone ?? ""}`}>{value}</span>
    </div>
  )
}
