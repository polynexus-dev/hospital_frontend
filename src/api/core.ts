import { api } from "./client"
import type { AuditLog, Paginated } from "../types/api"

export function listAuditLogs(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<AuditLog>>(`/audit-logs/${qs ? `?${qs}` : ""}`)
}
