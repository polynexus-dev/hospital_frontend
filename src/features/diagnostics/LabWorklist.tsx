import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardHeader, Eyebrow } from "../../components/ui/Card"
import { Pill } from "../../components/ui/Pill"
import type { Tone } from "../../components/ui/tone"
import { LAB_DEPARTMENTS, labWorklist, type WorklistStatus } from "../../api/laboratory"

const STATUS: Record<WorklistStatus, { label: string; tone: Tone }> = {
  pending_collection: { label: "To collect", tone: "neutral" },
  collected: { label: "Collected", tone: "info" },
  in_process: { label: "In process", tone: "info" },
  outsourced: { label: "Outsourced", tone: "info" },
  resulted: { label: "Resulted", tone: "warn" },
  verified: { label: "Verified", tone: "ok" },
}
const FLAG_TONE: Record<string, Tone> = { normal: "ok", high: "warn", low: "warn", critical: "bad" }
const selectCls = "h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] bg-surface"
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Investigation view: one row per test across orders, filterable by department and stage. */
export function LabWorklist({ onOpenOrder }: { onOpenOrder: (orderId: number) => void }) {
  const [department, setDepartment] = useState("")
  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  const query = useQuery({
    queryKey: ["lab-worklist", department, status, priority],
    queryFn: () => labWorklist({ department, status, priority }),
    refetchInterval: 60_000,
  })
  const rows = query.data ?? []
  return (
    <Card padded>
      <CardHeader>
        <Eyebrow>Investigations</Eyebrow>
      </CardHeader>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <select aria-label="Department" className={selectCls} value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All departments</option>
          {LAB_DEPARTMENTS.map((d) => <option key={d} value={d}>{cap(d)}</option>)}
        </select>
        <select aria-label="Stage" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All stages</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select aria-label="Priority" className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Any priority</option>
          <option value="stat">STAT</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
        </select>
      </div>
      {query.isLoading ? (
        <div className="text-[12.5px] text-ink-4">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-[12.5px] text-ink-4">Nothing matches.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[.04em] text-ink-4">
                <th className="py-1.5 pr-3">Test</th><th className="pr-3">Patient</th><th className="pr-3">Order</th><th className="pr-3">Dept</th>
                <th className="pr-3">Stage</th><th className="pr-3">Result</th><th className="pr-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {rows.map((r) => (
                <tr key={`${r.order}-${r.test}`} className="hover:bg-page cursor-pointer" onClick={() => onOpenOrder(r.order)}>
                  <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                    {r.test_name}{r.calculated && <span className="ml-1 text-[10.5px] font-normal text-ink-4">calc</span>}
                    {r.priority !== "routine" && <span className="ml-1.5"><Pill tone="bad">{r.priority.toUpperCase()}</Pill></span>}
                  </td>
                  <td className="pr-3 whitespace-nowrap">{r.patient_name} <span className="text-ink-5">{r.uhid}</span></td>
                  <td className="pr-3 whitespace-nowrap">{r.order_number}</td>
                  <td className="pr-3">{cap(r.department)}</td>
                  <td className="pr-3"><Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill></td>
                  <td className="pr-3 whitespace-nowrap">{r.value ? <>{r.value} {r.unit} {r.flag && r.flag !== "normal" && <Pill tone={FLAG_TONE[r.flag]}>{r.flag}</Pill>}</> : "—"}</td>
                  <td className={`pr-3 whitespace-nowrap ${r.overdue ? "text-danger-text font-semibold" : ""}`}>
                    {r.due_at ? new Date(r.due_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    {r.overdue && " · overdue"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
