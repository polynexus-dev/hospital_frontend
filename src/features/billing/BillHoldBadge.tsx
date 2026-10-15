import { useQuery } from "@tanstack/react-query"
import { api } from "../../api/client"

interface HoldStatus {
  on_hold: boolean
  bills: { id: number; bill_number: string; reason: string; held_at: string | null }[]
}

/** "Bill on hold" badge shown wherever staff act on a patient (reception,
 *  EMR, pharmacy, IPD, insurance) — while a bill is on hold no charges,
 *  orders (except STAT), payments or discharge go through. Renders nothing
 *  when the patient has no held bill. */
export function BillHoldBadge({ patientId, className = "" }: { patientId: number | string | null | undefined; className?: string }) {
  const q = useQuery({
    queryKey: ["bill-hold-status", String(patientId)],
    queryFn: () => api.get<HoldStatus>(`/billing/hold-status/?patient=${patientId}`),
    enabled: !!patientId,
    staleTime: 30_000,
    retry: false,
  })
  const held = q.data?.bills?.[0]
  if (!q.data?.on_hold || !held) return null
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-md border border-danger-text/40 bg-danger-bg px-2 py-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-danger-text ${className}`}
      title={`Bill ${held.bill_number} is on hold: ${held.reason}. Charges, orders (except STAT), payments and discharge are blocked until it is released.`}
    >
      ⦸ Bill on hold · {held.bill_number}
    </span>
  )
}
