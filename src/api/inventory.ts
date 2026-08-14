import { api } from "./client"
import type { Item, ItemCategory, Paginated, POItem, PurchaseOrder, StockLevel, StockTransaction } from "../types/api"

export function listItemCategories() {
  return api.get<Paginated<ItemCategory>>("/inventory/categories/")
}

export function createItemCategory(data: { name: string; code: string }) {
  return api.post<ItemCategory>("/inventory/categories/", data)
}

export function listItems(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Item>>(`/inventory/items/${qs ? `?${qs}` : ""}`)
}

export function createItem(data: { category: number; name: string; code: string; unit_of_measure?: string; min_stock_level?: number }) {
  return api.post<Item>("/inventory/items/", data)
}

export function listStockLevels(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<StockLevel>>(`/inventory/stock-levels/${qs ? `?${qs}` : ""}`)
}

export function createStockLevel(data: { item: number; batch_number: string; quantity_on_hand: number; unit_cost: number; expiry_date?: string }) {
  return api.post<StockLevel>("/inventory/stock-levels/", data)
}

export function listPurchaseOrders(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<PurchaseOrder>>(`/inventory/purchase-orders/${qs ? `?${qs}` : ""}`)
}

export function createPurchaseOrder(data: { po_number: string; vendor_name: string }) {
  return api.post<PurchaseOrder>("/inventory/purchase-orders/", data)
}

export function addPOItem(poId: number, data: { item: number; ordered_quantity: number; unit_cost: number }) {
  return api.post<POItem>(`/inventory/purchase-orders/${poId}/add-item/`, data)
}

export function listStockTransactions(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<StockTransaction>>(`/inventory/stock-transactions/${qs ? `?${qs}` : ""}`)
}

export function recordStockTransaction(data: { item: number; transaction_type: string; quantity: number; reference?: string }) {
  return api.post<StockTransaction>("/inventory/stock-transactions/", data)
}
