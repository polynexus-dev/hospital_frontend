import { useEffect, useState } from "react"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"

// Shared bits for the accounts screens.

export const inputCls = "w-full px-3 py-2 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
export const cardCls = "bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4"
export const btnCls = "px-4 py-2 text-sm font-semibold rounded-lg"
export const today = () => new Date().toISOString().slice(0, 10)
export const fyStart = () => { const d = new Date(); return `${d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1}-04-01` }
export const inr = (n: number | string | null | undefined) => (n === null || n === undefined || n === "" ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

export async function download(path: string, filename: string, onError: (m: string) => void) {
  try {
    triggerBlobDownload(await api.getBlob(path), filename)
  } catch (e) {
    onError(extractApiError(e))
  }
}

export interface Account { code: string; name: string }

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  useEffect(() => { api.get<any>("/finance/accounts/?page_size=500").then((r) => setAccounts(r.results ?? r)).catch(() => setAccounts([])) }, [])
  return accounts
}

export interface InvoiceLine { tariff: number | null; description: string; hsn_sac: string; quantity: string; rate: string; discount: string; gst_rate: string }

export function lineTotals(lines: InvoiceLine[]) {
  let taxable = 0
  let tax = 0
  for (const l of lines) {
    const t = Math.max((Number(l.quantity) || 0) * (Number(l.rate) || 0) - (Number(l.discount) || 0), 0)
    taxable += t
    tax += Math.round(t * (Number(l.gst_rate) || 0)) / 100
  }
  return { taxable, tax, total: taxable + tax }
}

