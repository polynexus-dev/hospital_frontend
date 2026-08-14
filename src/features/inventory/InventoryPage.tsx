import React, { useEffect, useState } from "react"
import { addPOItem, createItem, createItemCategory, createPurchaseOrder, createStockLevel, listItemCategories, listItems, listPurchaseOrders, listStockLevels, listStockTransactions, recordStockTransaction } from "../../api/inventory"
import type { Item, ItemCategory, PurchaseOrder, StockLevel, StockTransaction } from "../../types/api"

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
  const [poItemId, setPoItemId] = useState("")
  const [poQty, setPoQty] = useState("")
  const [poCost, setPoCost] = useState("")

  // Stock Tx Modal
  const [showTxModal, setShowTxModal] = useState(false)
  const [txItemId, setTxItemId] = useState("")
  const [txType, setTxType] = useState("receipt")
  const [txQty, setTxQty] = useState("")
  const [txRef, setTxRef] = useState("")

  const loadData = async () => {
    try {
      setLoading(true)
      const [cRes, iRes, sRes, pRes, tRes] = await Promise.all([
        listItemCategories(),
        listItems(),
        listStockLevels(),
        listPurchaseOrders(),
        listStockTransactions(),
      ])
      setCategories(cRes.results)
      setItems(iRes.results)
      setStockLevels(sRes.results)
      setOrders(pRes.results)
      setTransactions(tRes.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createItemCategory({ name: catName, code: catCode })
      setShowCatModal(false)
      setCatName("")
      setCatCode("")
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
      await createPurchaseOrder({ po_number: poNo, vendor_name: vendor })
      setShowPoModal(false)
      setPoNo("")
      setVendor("")
      loadData()
    } catch (err: any) {
      alert("Failed to create PO: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleAddPoItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPo || !poItemId) return
    try {
      await addPOItem(selectedPo.id, {
        item: Number(poItemId),
        ordered_quantity: Number(poQty),
        unit_cost: Number(poCost),
      })
      setSelectedPo(null)
      setPoQty("")
      setPoCost("")
      loadData()
    } catch (err: any) {
      alert("Failed to add PO item: " + (err.response?.data?.detail || err.message))
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Inventory & Procurement
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Item catalog, stock batches, purchase order procurement, and inventory movements.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCatModal(true)}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
          >
            + Category
          </button>
          <button
            onClick={() => setShowItemModal(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            + New Item
          </button>
          <button
            onClick={() => setShowPoModal(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
          >
            + New PO
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-4">
        <button
          onClick={() => setActiveTab("items")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "items"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Item Catalog ({items.length})
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "stock"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Stock Levels ({stockLevels.length})
        </button>
        <button
          onClick={() => setActiveTab("po")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "po"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Purchase Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "transactions"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Stock Movements ({transactions.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading inventory data...</div>
      ) : activeTab === "items" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3">Min Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No items found in catalog.
                  </td>
                </tr>
              ) : (
                items.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-semibold text-indigo-600">{i.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{i.name}</td>
                    <td className="px-4 py-3 text-slate-500">{i.category_name || `Cat #${i.category}`}</td>
                    <td className="px-4 py-3 text-slate-500 uppercase text-xs">{i.unit_of_measure}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{i.min_stock_level}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === "stock" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowStockModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700"
            >
              + Log Batch Stock
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Batch No</th>
                  <th className="px-4 py-3">Qty On Hand</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {stockLevels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No active stock batches recorded.
                    </td>
                  </tr>
                ) : (
                  stockLevels.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium">{s.item_name || `Item #${s.item}`}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{s.batch_number}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{s.quantity_on_hand}</td>
                      <td className="px-4 py-3 font-semibold">₹{s.unit_cost}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{s.expiry_date || "N/A"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "po" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ordered At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No purchase orders.
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-semibold text-indigo-600">{po.po_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{po.vendor_name}</td>
                    <td className="px-4 py-3 capitalize text-xs font-semibold text-emerald-600">{po.status}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(po.ordered_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedPo(po)}
                        className="px-2.5 py-1 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200"
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
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowTxModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700"
            >
              + Record Movement
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No stock movement logs.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium">{tx.item_name || `Item #${tx.item}`}</td>
                      <td className="px-4 py-3 capitalize text-xs font-semibold">{tx.transaction_type}</td>
                      <td className="px-4 py-3 font-bold">{tx.quantity}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{tx.reference || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(tx.transaction_date).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create Item Category</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category Name</label>
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PHARM"
                  value={catCode}
                  onChange={(e) => setCatCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCatModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Item to Catalog</h2>
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Item Code</label>
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
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Min Stock Level</label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Log Batch Stock</h2>
            <form onSubmit={handleCreateStock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Item</label>
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Batch Number</label>
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
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    value={qtyOnHand}
                    onChange={(e) => setQtyOnHand(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Unit Cost (₹)</label>
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowStockModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create Purchase Order</h2>
            <form onSubmit={handleCreatePO} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">PO Number</label>
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MedSurge Pharma Ltd"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowPoModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg">
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Item to {selectedPo.po_number}</h2>
            <form onSubmit={handleAddPoItem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Item</label>
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
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Ordered Quantity</label>
                  <input
                    type="number"
                    required
                    value={poQty}
                    onChange={(e) => setPoQty(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    required
                    value={poCost}
                    onChange={(e) => setPoCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedPo(null)} className="px-4 py-2 text-sm text-slate-500">
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

      {/* Stock Tx Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Record Stock Movement</h2>
            <form onSubmit={handleRecordTx} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Item</label>
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Transaction Type</label>
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                <input
                  type="number"
                  required
                  value={txQty}
                  onChange={(e) => setTxQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Reference / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Issued to OT-2"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowTxModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
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
