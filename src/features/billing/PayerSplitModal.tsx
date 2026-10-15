import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"

// Insurance bills: lines on the insurer's non-payable lists are the
// patient's to pay; the rest is claimable from the insurer.

interface Split {
  payer: string | null
  patient_category: string
  gross: string
  patient_payable: string
  payer_payable: string
  lines: { id: number; description: string; amount: string; non_payable: boolean; reason: string }[]
}

const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PayerSplitModal({ billId, onClose }: { billId: number; onClose: () => void }) {
  const [data, setData] = useState<Split | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get<Split>(`/billing/bills/${billId}/payer-split/`).then(setData).catch((e) => setError(extractApiError(e))) }, [billId])
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-lg w-full rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-ink dark:text-slate-100">Insurer / patient split</h2>
          {data && <p className="text-sm text-ink-4">{data.payer ? `Insurer: ${data.payer}` : "No insurer found for this patient"} · category {data.patient_category}</p>}
        </div>
        {error && <div className="text-sm text-danger-text">{error}</div>}
        {data && (
          <>
            <div className="text-sm divide-y divide-border-soft dark:divide-slate-700">
              {data.lines.map((l) => (
                <div key={l.id} className="flex justify-between gap-3 py-1.5">
                  <div>
                    <div className={l.non_payable ? "font-medium text-warning-text" : ""}>{l.description}</div>
                    {l.non_payable && <div className="text-xs text-ink-4">Not covered — {l.reason}</div>}
                  </div>
                  <span>{inr(l.amount)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border dark:border-slate-700 px-3 py-2"><div className="text-xs text-ink-4">Claimable from insurer</div><div className="text-lg font-bold">{inr(data.payer_payable)}</div></div>
              <div className="rounded-lg border border-warning-text/40 bg-warning-bg px-3 py-2"><div className="text-xs text-ink-4">Payable by patient</div><div className="text-lg font-bold">{inr(data.patient_payable)}</div></div>
            </div>
          </>
        )}
        <div className="flex justify-end"><button onClick={onClose} className="px-4 py-2 text-sm text-ink-4">Close</button></div>
      </div>
    </div>
  )
}
