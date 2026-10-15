import React, { useEffect, useState } from "react"
import { addPOItem, createItem, createItemCategory, createPurchaseOrder, createStockLevel, listItemCategories, listItems, listPurchaseOrders, listStockLevels, listStockTransactions, recordStockTransaction } from "../../api/inventory"
import type { Item, ItemCategory, PurchaseOrder, StockLevel, StockTransaction } from "../../types/api"
import { api, extractApiError } from "../../api/client"
import { FieldInput } from "../../components/resource/ResourceTable"
import { viewRecord } from "../../store/recordViewer"
import { Pager } from "../../components/ui/Pager"

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<"items" | "stock" | "po" | "transactions">("items")
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [loading, setLoading] = useState(true)

  // New Category Modal
  const [showCatModal, setShowCatModal] = useState(false)
  const [catName, setCatName] = useState("")
  const [catCode, setCatCode] = useState("")
  const [catParent, setCatParent] = useState("")

  // New Item Modal
  const [showItemModal, setShowItemModal] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState("")
  const [itemName, setItemName] = useState("")
  const [itemCode, setItemCode] = useState("")
  const [uom, setUom] = useState("pcs")
  const [minStock, setMinStock] = useState("10")

  // Stock Batch Modal
  const [showStockModal, setShowStockModal] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState("")
  const [batchNo, setBatchNo] = useState("")
  const [qtyOnHand, setQtyOnHand] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [expDate, setExpDate] = useState("")

  // Purchase Order Modal
  const [showPoModal, setShowPoModal] = useState(false)
  const [poNo, setPoNo] = useState("")
  const [vendor, setVendor] = useState("")

  // Add Item to PO Modal
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null)
  const [overrideReason, setOverrideReason] = useState("")
  const [contract, setContract] = useState<{ contract: string | null; rate?: string } | null>(null)
  const [poItemId, setPoItemId] = useState("")
  const [poQty, setPoQty] = useState("")
  const [poCost, setPoCost] = useState("")

  // Stock Tx Modal
  const [showTxModal, setShowTxModal] = useState(false)
  const [txItemId, setTxItemId] = useState("")
  const [txType, setTxType] = useState("receipt")
  const [txQty, setTxQty] = useState("")
  const [txRef, setTxRef] = useState("")

  const [pages, setPages] = useState<Record<string, number>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const pageOf = (k: string) => ({ page: String(pages[k] ?? 1) })
  const goTo = (k: string) => (n: number) => setPages((s) => ({ ...s, [k]: n }))

  const loadData = async () => {
    try {
      setLoading(true)
      const [cRes, iRes, sRes, pRes, tRes] = await Promise.all([
        listItemCategories(),
        listItems(pageOf("items")),
        listStockLevels(pageOf("stock")),
        listPurchaseOrders(pageOf("po")),
        listStockTransactions(pageOf("transactions")),
      ])
      setCategories(cRes.results)
      setItems(iRes.results)
      setStockLevels(sRes.results)
      setOrders(pRes.results)
      setTransactions(tRes.results)
      setCounts({ items: iRes.count, stock: sRes.count, po: pRes.count, transactions: tRes.count })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages])

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createItemCategory({ name: catName, code: catCode, parent: catParent ? Number(catParent) : null })
      setShowCatModal(false)
      setCatName("")
      setCatCode("")
      setCatParent("")
      loadData()
    } catch (err: any) {
      alert("Failed to create category: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCatId) return
    try {
      await createItem({
        category: Number(selectedCatId),
        name: itemName,
        code: itemCode,
        unit_of_measure: uom,
        min_stock_level: Number(minStock),
      })
      setShowItemModal(false)
      setItemName("")
      setItemCode("")
      loadData()
    } catch (err: any) {
      alert("Failed to create item: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItemId) return
    try {
      await createStockLevel({
        item: Number(selectedItemId),
        batch_number: batchNo,
        quantity_on_hand: Number(qtyOnHand),
        unit_cost: Number(unitCost),
        expiry_date: expDate || undefined,
      })
      setShowStockModal(false)
      setBatchNo("")
      setQtyOnHand("")
      setUnitCost("")
      loadData()
    } catch (err: any) {
      alert("Failed to record stock batch: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createPurchaseOrder({ po_number: poNo, vendor: vendor ? Number(vendor) : null })
      setShowPoModal(false)
      setPoNo("")
      setVendor("")
      loadData()
    } catch (err: any) {
      alert("Failed to create PO: " + extractApiError(err))
    }
  }

  // PRC-1: the vendor's rate-contract rate for the chosen item.
  useEffect(() => {
    setContract(null)
    if (!selectedPo?.vendor || !poItemId) return
    api.get<{ contract: string | null; rate?: string }>(`/inventory/rate-contracts/rate/?vendor=${selectedPo.vendor}&item=${poItemId}`).then(setContract).catch(() => setContract(null))
  }, [selectedPo, poItemId])
  const aboveContract = !!(contract?.rate && poCost && Number(poCost) > Number(contract.rate))

  const handleAddPoItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPo || !poItemId) return
    try {
      await addPOItem(selectedPo.id, {
        item: Number(poItemId),
        ordered_quantity: Number(poQty),
        ...(poCost ? { unit_cost: poCost } : {}),
        ...(overrideReason ? { rate_override_reason: overrideReason } : {}),
      })
      setSelectedPo(null)
      setPoQty("")
      setPoCost("")
      setOverrideReason("")
      loadData()
    } catch (err: any) {
      alert("Failed to add PO item: " + extractApiError(err))
    }
  }

  const handleRecordTx = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!txItemId) return
    try {
      await recordStockTransaction({
        item: Number(txItemId),
        transaction_type: txType,
        quantity: Number(txQty),
        reference: txRef,
      })
      setShowTxModal(false)
      setTxQty("")
      setTxRef("")
      loadData()
    } catch (err: any) {
      alert("Failed to record stock movement: " + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-slate-100">
            Inventory & Procurement
          </h1>
          <p className="text-sm text-ink-4 dark:text-slate-400">
            Item catalog, stock batches, purchase order procurement, and inventory movements.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCatModal(true)}
            className="px-3 py-2 text-sm font-medium text-ink-2 bg-white border border-border-strong rounded-lg hover:bg-page dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
          >
            + Category
          </button>
          <button
            onClick={() => setShowItemModal(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-dark rounded-lg shadow-sm"
          >
            + New Item
          </button>
          <button
            onClick={() => setShowPoModal(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-success hover:bg-success-text rounded-lg shadow-sm"
          >
            + New PO
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border dark:border-slate-700 flex gap-4">
        <button
          onClick={() => setActiveTab("items")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "items"
              ? "border-brand text-brand dark:text-indigo-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          Item Catalog ({counts.items ?? items.length})
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "stock"
              ? "border-brand text-brand dark:text-indigo-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          Stock Levels ({counts.stock ?? stockLevels.length})
        </button>
        <button
          onClick={() => setActiveTab("po")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "po"
              ? "border-brand text-brand dark:text-indigo-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          Purchase Orders ({counts.po ?? orders.length})
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "transactions"
              ? "border-brand text-brand dark:text-indigo-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          Stock Movements ({counts.transactions ?? transactions.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-ink-4">Loading inventory data...</div>
      ) : activeTab === "items" ? (
        <div className="space-y-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-border dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border dark:border-slate-700 bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase">
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3">Min Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-700">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-4">
                    No items found in catalog.
                  </td>
                </tr>
              ) : (
                items.map((i) => (
                  <tr key={i.id} onClick={(ev) => viewRecord(ev, i, { subtitle: "Inventory item" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-brand">{i.code}</td>
                    <td className="px-4 py-3 font-medium text-ink dark:text-slate-100">{i.name}</td>
                    <td className="px-4 py-3 text-ink-4">{i.category_name || `Cat #${i.category}`}</td>
                    <td className="px-4 py-3 text-ink-4 uppercase text-xs">{i.unit_of_measure}</td>
                    <td className="px-4 py-3 font-semibold text-ink-2">{i.min_stock_level}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager page={pages.items ?? 1} count={counts.items ?? 0} onPage={goTo("items")} />
        </div>
      ) : activeTab === "stock" ? (
        <div className="space-y-3">
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowStockModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-brand rounded hover:bg-brand-dark"
            >
              + Log Batch Stock
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-border dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border dark:border-slate-700 bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Batch No</th>
                  <th className="px-4 py-3">Qty On Hand</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-slate-700">
                {stockLevels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-4">
                      No active stock batches recorded.
                    </td>
                  </tr>
                ) : (
                  stockLevels.map((s) => (
                    <tr key={s.id} onClick={(ev) => viewRecord(ev, s, { subtitle: "Stock level" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-700/50 cursor-pointer">
                      <td className="px-4 py-3 font-medium">{s.item_name || `Item #${s.item}`}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-ink-2">{s.batch_number}</td>
                      <td className="px-4 py-3 font-bold text-success">{s.quantity_on_hand}</td>
                      <td className="px-4 py-3 font-semibold">₹{s.unit_cost}</td>
                      <td className="px-4 py-3 text-xs text-ink-4">{s.expiry_date || "N/A"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Pager page={pages.stock ?? 1} count={counts.stock ?? 0} onPage={goTo("stock")} />
        </div>
      ) : activeTab === "po" ? (
        <div className="space-y-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-border dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border dark:border-slate-700 bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase">
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ordered At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-700">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-4">
                    No purchase orders.
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id} onClick={(ev) => viewRecord(ev, po, { subtitle: "Purchase order" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-brand">{po.po_number}</td>
                    <td className="px-4 py-3 font-medium text-ink dark:text-slate-100">{po.vendor_name}</td>
                    <td className="px-4 py-3 capitalize text-xs font-semibold text-success">{po.status}</td>
                    <td className="px-4 py-3 text-xs text-ink-4">{new Date(po.ordered_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedPo(po)}
                        className="px-2.5 py-1 text-xs font-semibold bg-brand-tint text-brand-dark rounded hover:bg-brand-border"
                      >
                        + Add PO Item
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager page={pages.po ?? 1} count={counts.po ?? 0} onPage={goTo("po")} />
        </div>
      ) : (
        <div className="space-y-3">
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowTxModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-brand rounded hover:bg-brand-dark"
            >
              + Record Movement
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-border dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border dark:border-slate-700 bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-slate-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-4">
                      No stock movement logs.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} onClick={(ev) => viewRecord(ev, tx, { subtitle: "Stock transaction" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-700/50 cursor-pointer">
                      <td className="px-4 py-3 font-medium">{tx.item_name || `Item #${tx.item}`}</td>
                      <td className="px-4 py-3 capitalize text-xs font-semibold">{tx.transaction_type}</td>
                      <td className="px-4 py-3 font-bold">{tx.quantity}</td>
                      <td className="px-4 py-3 text-xs text-ink-4">{tx.reference || "-"}</td>
                      <td className="px-4 py-3 text-xs text-ink-4">{new Date(tx.transaction_date).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Pager page={pages.transactions ?? 1} count={counts.transactions ?? 0} onPage={goTo("transactions")} />
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Create Item Category</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pharmaceuticals / Surgical Consumables"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PHARM"
                  value={catCode}
                  onChange={(e) => setCatCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Sub-category of (optional)</label>
                <select value={catParent} onChange={(e) => setCatParent(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700">
                  <option value="">— top-level category —</option>
                  {categories.filter((c) => !c.parent).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCatModal(false)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg">
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Add Item to Catalog</h2>
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Category</label>
                <select
                  required
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Item Code</label>
                <input
                  type="text"
                  required
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Min Stock Level</label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg">
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Batch Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Log Batch Stock</h2>
            <form onSubmit={handleCreateStock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Item</label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="">Select Item</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} [{i.code}]
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Batch Number</label>
                <input
                  type="text"
                  required
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    value={qtyOnHand}
                    onChange={(e) => setQtyOnHand(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowStockModal(false)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg">
                  Save Stock Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Modal */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Create Purchase Order</h2>
            <form onSubmit={handleCreatePO} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">PO Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PO-2026-001"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Vendor</label>
                <FieldInput field={{ key: "vendor", label: "Vendor", type: "fk", source: "/finance/vendors/?is_active=true", required: true }} value={vendor} onChange={(v) => setVendor(v ? String(v) : "")} />
                <p className="text-xs text-ink-4 mt-1">Lines take this vendor's rate-contract rate where there is one.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowPoModal(false)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-success rounded-lg">
                  Create PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item to PO Modal */}
      {selectedPo && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Add Item to {selectedPo.po_number}</h2>
            <form onSubmit={handleAddPoItem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Item</label>
                <select
                  required
                  value={poItemId}
                  onChange={(e) => setPoItemId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="">Select Item</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} [{i.code}]
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Ordered Quantity</label>
                  <input
                    type="number"
                    required
                    value={poQty}
                    onChange={(e) => setPoQty(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required={!contract?.rate}
                    placeholder={contract?.rate ? `Contract ₹${contract.rate}` : ""}
                    value={poCost}
                    onChange={(e) => setPoCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
              {contract?.rate ? (
                <p className="text-xs text-ink-3">Rate contract {contract.contract}: ₹{contract.rate}. Leave the cost blank to use it.</p>
              ) : poItemId ? (
                <p className="text-xs text-ink-4">No rate contract with this vendor for the item.</p>
              ) : null}
              {aboveContract && (
                <div>
                  <label className="block text-xs font-medium text-warning-text mb-1" htmlFor="rate-override">Above the contract rate — reason</label>
                  <input id="rate-override" required value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700" />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedPo(null)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Tx Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Record Stock Movement</h2>
            <form onSubmit={handleRecordTx} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Item</label>
                <select
                  required
                  value={txItemId}
                  onChange={(e) => setTxItemId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="">Select Item</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} [{i.code}]
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Transaction Type</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="receipt">Receipt (+)</option>
                  <option value="issue">Issue (-)</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="return">Return (+)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Quantity</label>
                <input
                  type="number"
                  required
                  value={txQty}
                  onChange={(e) => setTxQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Reference / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Issued to OT-2"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowTxModal(false)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg">
                  Submit Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
