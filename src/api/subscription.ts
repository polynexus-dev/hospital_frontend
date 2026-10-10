import { api } from "./client"
import type { MySubscription } from "../types/api"

// The requesting hospital's own SaaS plan, usage against its limits, and invoices.

export function getMySubscription() {
  return api.get<MySubscription>("/subscription/")
}

export function downloadMyInvoice(id: number) {
  return api.getBlob(`/subscription/invoices/${id}/pdf/`)
}
