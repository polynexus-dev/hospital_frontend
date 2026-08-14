import React, { useEffect, useState } from "react"
import { addBillItem, createBill, createInsuranceClaim, listBills, listInsuranceClaims, listPayments, recordPayment } from "../../api/billing"
import type { Bill, InsuranceClaim, Payment } from "../../types/api"

export function BillingPage() {
  const [activeTab, setActiveTab] = useState<"bills" | "payments" | "claims">("bills")
  const [bills, setBills] = useState<Bill[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [loading, setLoading] = useState(true)

  // New Bill Modal
  const [showBillModal, setShowBillModal] = useState(false)
  const [patientId, setPatientId] = useState("")
  const [discountAmt, setDiscountAmt] = useState("0")

  // Add Item Modal
  const [selectedBillForAddItem, setSelectedBillForAddItem] = useState<Bill | null>(null)
  const [itemDesc, setItemDesc] = useState("")
  const [itemQty, setItemQty] = useState("1")
  const [itemPrice, setItemPrice] = useState("")

  // Payment Modal
  const [selectedBillForPay, setSelectedBillForPay] = useState<Bill | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("cash")
  const [txnId, setTxnId] = useState("")

  // Claim Modal
  const [selectedBillForClaim, setSelectedBillForClaim] = useState<Bill | null>(null)
  const [insComp, setInsComp] = useState("")
  const [policyNo, setPolicyNo] = useState("")
  const [claimAmt, setClaimAmt] = useState("")

  const loadData = async () => {
    try {
      setLoading(true)
      const [bRes, pRes, cRes] = await Promise.all([listBills(), listPayments(), listInsuranceClaims()])
      setBills(bRes.results)
      setPayments(pRes.results)
      setClaims(cRes.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createBill({ patient: Number(patientId), discount_amount: Number(discountAmt) })
      setShowBillModal(false)
      setPatientId("")
      loadData()
    } catch (err: any) {
      alert("Failed to create bill: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBillForAddItem || !itemDesc || !itemPrice) return
    try {
      await addBillItem(selectedBillForAddItem.id, {
        description: itemDesc,
        quantity: Number(itemQty),
        unit_price: Number(itemPrice),
      })
      setSelectedBillForAddItem(null)
      setItemDesc("")
      setItemPrice("")
      loadData()
    } catch (err: any) {
      alert("Failed to add line item: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBillForPay || !payAmount) return
    try {
      await recordPayment({
        bill: selectedBillForPay.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        transaction_id: txnId,
      })
      setSelectedBillForPay(null)
      setPayAmount("")
      setTxnId("")
      loadData()
    } catch (err: any) {
      alert("Failed to record payment: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBillForClaim || !insComp || !policyNo || !claimAmt) return
    try {
      await createInsuranceClaim({
        bill: selectedBillForClaim.id,
        insurance_company: insComp,
        policy_number: policyNo,
        claimed_amount: Number(claimAmt),
      })
      setSelectedBillForClaim(null)
      setInsComp("")
      setPolicyNo("")
      setClaimAmt("")
      loadData()
    } catch (err: any) {
      alert("Failed to submit claim: " + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Billing & Insurance Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Patient invoices, itemized billing, payments, and TPA insurance claim processing.
          </p>
        </div>
        <button
          onClick={() => setShowBillModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
        >
          + Generate Bill
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-4">
        <button
          onClick={() => setActiveTab("bills")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "bills"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Bills & Invoices ({bills.length})
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "payments"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Payment Transactions ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab("claims")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "claims"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          TPA Insurance Claims ({claims.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading billing data...</div>
      ) : activeTab === "bills" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Bill ID</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Net Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No bills generated.
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">Bill #{b.id}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {b.patient_detail ? `${b.patient_detail.first_name} ${b.patient_detail.last_name}` : `Patient #${b.patient}`}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">₹{b.net_amount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${
                          b.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : b.status === "partially_paid"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => setSelectedBillForAddItem(b)}
                        className="px-2 py-1 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200"
                      >
                        + Add Item
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBillForPay(b)
                          setPayAmount(b.net_amount)
                        }}
                        className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200"
                      >
                        + Pay
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBillForClaim(b)
                          setClaimAmt(b.net_amount)
                        }}
                        className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-800 rounded hover:bg-purple-200"
                      >
                        + Claim
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === "payments" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Bill ID</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Txn ID</th>
                <th className="px-4 py-3">Paid At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No payment transactions recorded.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-semibold">Bill #{p.bill}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">₹{p.amount}</td>
                    <td className="px-4 py-3 uppercase text-xs font-medium">{p.payment_method}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.transaction_id || "-"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.paid_at).toLocaleString()}</td>
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
                <th className="px-4 py-3">Bill ID</th>
                <th className="px-4 py-3">Insurance Company</th>
                <th className="px-4 py-3">Policy No</th>
                <th className="px-4 py-3">Claimed</th>
                <th className="px-4 py-3">Approved</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No insurance claims submitted.
                  </td>
                </tr>
              ) : (
                claims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-semibold">Bill #{c.bill}</td>
                    <td className="px-4 py-3 font-medium">{c.insurance_company}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.policy_number}</td>
                    <td className="px-4 py-3 font-bold">₹{c.claimed_amount}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">₹{c.approved_amount}</td>
                    <td className="px-4 py-3 capitalize text-xs font-semibold text-purple-600">{c.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Bill Modal */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Generate New Bill</h2>
            <form onSubmit={handleCreateBill} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Patient ID</label>
                <input
                  type="number"
                  required
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Discount Amount (₹)</label>
                <input
                  type="number"
                  value={discountAmt}
                  onChange={(e) => setDiscountAmt(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowBillModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
                  Create Draft Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {selectedBillForAddItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Line Item to Bill #{selectedBillForAddItem.id}</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Doctor Consultation / ICU Charge"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                <input
                  type="number"
                  required
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Unit Price (₹)</label>
                <input
                  type="number"
                  required
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedBillForAddItem(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {selectedBillForPay && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Record Payment for Bill #{selectedBillForPay.id}</h2>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Transaction ID / Ref</label>
                <input
                  type="text"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedBillForPay(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg">
                  Submit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {selectedBillForClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Submit TPA Claim for Bill #{selectedBillForClaim.id}</h2>
            <form onSubmit={handleCreateClaim} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Insurance Company</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Star Health / HDFC ERGO"
                  value={insComp}
                  onChange={(e) => setInsComp(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Policy Number</label>
                <input
                  type="text"
                  required
                  value={policyNo}
                  onChange={(e) => setPolicyNo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Claimed Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={claimAmt}
                  onChange={(e) => setClaimAmt(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedBillForClaim(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg">
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
