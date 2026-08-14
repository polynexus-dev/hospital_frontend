import { api } from "./client"
import type { Expense, LedgerEntry, Paginated, Receivable } from "../types/api"

export function listLedger(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<LedgerEntry>>(`/finance/ledger/${qs ? `?${qs}` : ""}`)
}

export function listExpenses(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Expense>>(`/finance/expenses/${qs ? `?${qs}` : ""}`)
}

export function createExpense(data: { category: string; amount: string; paid_to: string; expense_date?: string }) {
  return api.post<Expense>("/finance/expenses/", data)
}

export function approveExpense(id: number) {
  return api.post<Expense>(`/finance/expenses/${id}/approve/`)
}

export function listReceivables(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Receivable>>(`/finance/receivables/${qs ? `?${qs}` : ""}`)
}

export function createReceivable(data: {
  source_type: Receivable["source_type"]
  source_id: string
  amount: string
  due_date: string
}) {
  return api.post<Receivable>("/finance/receivables/", data)
}
