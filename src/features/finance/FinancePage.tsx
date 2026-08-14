import React, { useEffect, useState } from "react"
import { approveExpense, createExpense, createReceivable, listExpenses, listLedger, listReceivables } from "../../api/finance"
import type { Expense, LedgerEntry, Receivable } from "../../types/api"

export function FinancePage() {
  const [activeTab, setActiveTab] = useState<"ledger" | "expenses" | "receivables">("ledger")
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)

  // New Expense Modal
  const [showExpModal, setShowExpModal] = useState(false)
  const [expCategory, setExpCategory] = useState("Medical Supplies")
  const [expAmount, setExpAmount] = useState("")
  const [expPaidTo, setExpPaidTo] = useState("")

  // New Receivable Modal
  const [showRecModal, setShowRecModal] = useState(false)
  const [recSourceType, setRecSourceType] = useState<Receivable["source_type"]>("insurance_claim")
  const [recSourceId, setRecSourceId] = useState("")
  const [recAmount, setRecAmount] = useState("")
  const [recDueDate, setRecDueDate] = useState("")

  const loadData = async () => {
    try {
      setLoading(true)
      const [lRes, eRes, rRes] = await Promise.all([listLedger(), listExpenses(), listReceivables()])
      setLedger(lRes.results)
      setExpenses(eRes.results)
      setReceivables(rRes.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createExpense({ category: expCategory, amount: expAmount, paid_to: expPaidTo })
      setShowExpModal(false)
      setExpAmount("")
      setExpPaidTo("")
      loadData()
    } catch (err: any) {
      alert("Failed to submit expense: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleApproveExpense = async (id: number) => {
    try {
      await approveExpense(id)
      loadData()
    } catch (err: any) {
      alert("Failed to approve expense: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateReceivable = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createReceivable({
        source_type: recSourceType,
        source_id: recSourceId,
        amount: recAmount,
        due_date: recDueDate,
      })
      setShowRecModal(false)
      setRecSourceId("")
      setRecAmount("")
      loadData()
    } catch (err: any) {
      alert("Failed to log receivable: " + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Finance & Operational Ledger
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor revenue streams, hospital operational expenses, and corporate/insurance receivables aging.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExpModal(true)}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg"
          >
            + Log Expense
          </button>
          <button
            onClick={() => setShowRecModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
          >
            + New Receivable
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-4">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "ledger"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          General Ledger ({ledger.length})
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "expenses"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Expenses ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab("receivables")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "receivables"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Receivables Aging ({receivables.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading financial records...</div>
      ) : activeTab === "ledger" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Entry Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No ledger entries recorded.
                  </td>
                </tr>
              ) : (
                ledger.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-semibold uppercase text-xs">
                      {l.entry_type === "revenue" ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Revenue</span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">Expense</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{l.category}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">₹{l.amount}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{l.reference_type ? `${l.reference_type} #${l.reference_id}` : "N/A"}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(l.entry_date).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === "expenses" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Paid To</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Expense Date</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{e.category}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{e.paid_to}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">₹{e.amount}</td>
                    <td className="px-4 py-3 text-slate-500">{e.expense_date}</td>
                    <td className="px-4 py-3">
                      {e.approved_by ? (
                        <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded-full">
                          Approved
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full">
                          Pending Approval
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!e.approved_by && (
                        <button
                          onClick={() => handleApproveExpense(e.id)}
                          className="px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded hover:bg-emerald-200"
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Source Type</th>
                <th className="px-4 py-3">Source ID / Claim #</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {receivables.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No receivables outstanding.
                  </td>
                </tr>
              ) : (
                receivables.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 uppercase text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {r.source_type.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{r.source_id}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">₹{r.amount}</td>
                    <td className="px-4 py-3 text-slate-500">{r.due_date}</td>
                    <td className="px-4 py-3 capitalize font-semibold text-indigo-600 dark:text-indigo-400">{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Expense Modal */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Record Operational Expense</h2>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Paid To / Vendor</label>
                <input
                  type="text"
                  required
                  value={expPaidTo}
                  onChange={(e) => setExpPaidTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowExpModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-slate-800 dark:bg-slate-700 rounded-lg">
                  Submit Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receivable Modal */}
      {showRecModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Log Outstanding Receivable</h2>
            <form onSubmit={handleCreateReceivable} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Source Type</label>
                <select
                  value={recSourceType}
                  onChange={(e) => setRecSourceType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="insurance_claim">Insurance Claim</option>
                  <option value="corporate_billing">Corporate Billing</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Source Reference / Claim #</label>
                <input
                  type="text"
                  required
                  value={recSourceId}
                  onChange={(e) => setRecSourceId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={recAmount}
                  onChange={(e) => setRecAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={recDueDate}
                  onChange={(e) => setRecDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRecModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg">
                  Save Receivable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
