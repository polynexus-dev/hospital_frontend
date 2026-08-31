import { useQuery } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { StatTile } from "../../components/ui/StatTile"
import { DonutChart } from "../../components/ui/DonutChart"
import { BarChart } from "../../components/ui/BarChart"
import { LoadingState, ErrorState } from "../../components/ui/QueryStates"
import {
  callPerformance,
  dailyMisPreview,
  departmentDoctorVolume,
  doctorRevenue,
  enquiriesByDepartment,
  enquiryFunnel,
  noShowEffectiveness,
  revenueBySource,
} from "../../api/analytics"

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

function formatINRCompact(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`
  if (n >= 1000) return `₹${Math.round(n / 1000)}k`
  return `₹${Math.round(n)}`
}

const DEPT_COLORS = ["#1d4e89", "#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b"]

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  scheduled: "Scheduled",
  visited: "Visited",
  completed: "Completed",
  follow_up: "Follow-up",
  lost: "Lost",
}

export function DashboardPage() {
  const calls = useQuery({ queryKey: ["reports", "call-performance"], queryFn: callPerformance })
  const funnel = useQuery({ queryKey: ["reports", "enquiry-funnel"], queryFn: enquiryFunnel })
  const deptVolume = useQuery({ queryKey: ["reports", "department-doctor-volume"], queryFn: departmentDoctorVolume })
  const deptLeads = useQuery({ queryKey: ["reports", "enquiries-by-department"], queryFn: enquiriesByDepartment })
  const noShow = useQuery({ queryKey: ["reports", "no-show-effectiveness"], queryFn: noShowEffectiveness })
  const mis = useQuery({ queryKey: ["reports", "daily-mis-preview"], queryFn: dailyMisPreview })
  const revenue = useQuery({ queryKey: ["reports", "revenue-by-source"], queryFn: revenueBySource })
  const docRevenue = useQuery({ queryKey: ["reports", "doctor-revenue"], queryFn: doctorRevenue })

  if (calls.isLoading || funnel.isLoading) return <LoadingState />
  if (calls.isError || funnel.isError) return <ErrorState />

  const c = calls.data!
  const answeredPct = c.received ? Math.round((c.answered / c.received) * 100) : 0
  const enquiryTotal = funnel.data ? Object.values(funnel.data).reduce((a, b) => a + b, 0) : 0
  const funnelEntries = funnel.data ? Object.entries(funnel.data) : []

  const deptRows = deptVolume.data?.rows ?? []
  const byDept = new Map<string, number>()
  for (const row of deptRows) {
    const key = row.doctor__department__name ?? "Unassigned"
    byDept.set(key, (byDept.get(key) ?? 0) + row.booked)
  }
  const deptEntries = [...byDept.entries()].sort((a, b) => b[1] - a[1])

  const totalBooked = deptRows.reduce((sum, r) => sum + r.booked, 0)
  const totalCompleted = deptRows.reduce((sum, r) => sum + r.completed, 0)
  const conversionPct = totalBooked ? Math.round((totalCompleted / totalBooked) * 100) : 0

  const topDepts = deptEntries.slice(0, 4)
  const otherDeptTotal = deptEntries.slice(4).reduce((sum, [, n]) => sum + n, 0)
  const deptDonutData = [
    ...topDepts.map(([name, n], i) => ({ label: name, value: n, color: DEPT_COLORS[i % DEPT_COLORS.length] })),
    ...(otherDeptTotal > 0 ? [{ label: "Other", value: otherDeptTotal, color: "#c7ccd1" }] : []),
  ]

  const funnelBars = funnelEntries.map(([stage, n]) => ({ label: STAGE_LABELS[stage] ?? stage, value: n }))
  const revenueBars = (revenue.data?.rows ?? []).map((r) => ({ label: r.source, value: Number(r.billed_amount) }))

  const deptLeadRows = deptLeads.data?.rows ?? []
  const deptLeadBars = deptLeadRows
    .map((r) => ({ label: r.department__name ?? "Unassigned", value: r.enquiry_count }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-6 gap-3 min-w-[1020px]">
        <StatTile label="Calls received" value={c.received} sub="last 7 days" />
        <StatTile label="Answered" value={`${answeredPct}%`} sub={`${c.answered} of ${c.received}`} valueClassName={answeredPct >= 80 ? "text-success" : ""} />
        <StatTile label="Missed" value={c.missed} valueClassName={c.missed > 0 ? "text-danger" : ""} />
        <StatTile label="Enquiries captured" value={enquiryTotal} sub="current pipeline" />
        <StatTile label="Booked → completed" value={`${conversionPct}%`} valueClassName="text-success" />
        <StatTile label="No-shows" value={noShow.data?.no_shows ?? "—"} sub={noShow.data ? `${noShow.data.recall_tasks_done} recalled` : undefined} />
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-3.5 items-start">
        <Card padded>
          <div className="flex items-baseline gap-2.5 mb-3.5">
            <div className="text-[13px] font-semibold">Enquiry status</div>
            <div className="text-[12px] text-ink-4">current pipeline</div>
          </div>
          <BarChart data={funnelBars} height={170} />
        </Card>

        <Card padded>
          <div className="text-[13px] font-semibold mb-3">Department volume</div>
          <DonutChart data={deptDonutData} centerValue={totalBooked} centerLabel="Total bookings" />
        </Card>
      </div>

      <Card padded>
        <div className="flex items-baseline gap-2.5 mb-3.5">
          <div className="text-[13px] font-semibold">Leads by department</div>
          <div className="text-[12px] text-ink-4">enquiries this window, incl. Diagnostics/Lab</div>
        </div>
        <BarChart data={deptLeadBars} height={160} />
        <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr] gap-2 pb-2 mt-4 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold">
          <div>Department</div>
          <div className="text-right">Enq</div>
          <div className="text-right">Conv</div>
        </div>
        {deptLeadRows.map((r) => (
          <div key={r.department__name ?? "unassigned"} className="grid grid-cols-[1.6fr_0.7fr_0.7fr] gap-2 py-2 border-b border-border-faint text-[13px] items-center">
            <div>{r.department__name ?? "Unassigned"}</div>
            <div className="text-right text-ink-3">{r.enquiry_count}</div>
            <div className="text-right text-ink-3">{r.conversion_count}</div>
          </div>
        ))}
        {!deptLeadRows.length && <div className="text-[13px] text-ink-4 py-2">No department-tagged enquiries yet.</div>}
        <div className="text-[11.5px] text-ink-4 mt-2 leading-relaxed">
          Counts enquiries tagged to a department — not a confirmed lab/OPD booking, since there's no direct link from a lab order back to the enquiry that led to it yet.
        </div>
      </Card>

      <Card padded>
        <div className="text-[13px] font-semibold mb-3.5">Revenue by source</div>
        <BarChart data={revenueBars} height={180} formatValue={formatINRCompact} />
        <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr] gap-2 pb-2 mt-4 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold">
          <div>Source</div>
          <div className="text-right">Enq</div>
          <div className="text-right">Conv</div>
          <div className="text-right">Billed</div>
        </div>
        {revenue.data?.rows.map((r) => (
          <div key={r.source} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr] gap-2 py-2 border-b border-border-faint text-[13px] items-center">
            <div>{r.source}</div>
            <div className="text-right text-ink-3">{r.enquiry_count}</div>
            <div className="text-right text-ink-3">{r.conversion_count}</div>
            <div className="text-right font-semibold">{INR.format(Number(r.billed_amount))}</div>
          </div>
        ))}
        {!revenue.data?.rows.length && <div className="text-[13px] text-ink-4 py-2">No source data yet.</div>}
        {revenue.data?.note && <div className="text-[11.5px] text-ink-4 mt-2 leading-relaxed">{revenue.data.note}</div>}
      </Card>

      <Card padded>
        <div className="text-[13px] font-semibold mb-3">Revenue by doctor</div>
        <div className="grid grid-cols-[1.6fr_0.7fr_1fr] gap-2 pb-2 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold">
          <div>Doctor</div>
          <div className="text-right">Completed</div>
          <div className="text-right">Billed</div>
        </div>
        {docRevenue.data?.rows.map((r) => (
          <div key={r.doctor_id} className="grid grid-cols-[1.6fr_0.7fr_1fr] gap-2 py-2 border-b border-border-faint text-[13px] items-center">
            <div>{r.doctor_name}</div>
            <div className="text-right text-ink-3">{r.completed_appointments}</div>
            <div className="text-right font-semibold">{INR.format(Number(r.billed_amount))}</div>
          </div>
        ))}
        {!docRevenue.data?.rows.length && <div className="text-[13px] text-ink-4 py-2">No doctor revenue data yet.</div>}
        {docRevenue.data?.note && <div className="text-[11.5px] text-ink-4 mt-2 leading-relaxed">{docRevenue.data.note}</div>}
      </Card>

      <div className="grid grid-cols-3 gap-3.5 items-start">
        <Card padded>
          <div className="text-[13px] font-semibold mb-3">Call performance</div>
          <div className="flex flex-col gap-2.5 text-[13px]">
            <div className="flex justify-between"><span className="text-ink-3">Received</span><span className="font-semibold">{c.received}</span></div>
            <div className="flex justify-between"><span className="text-ink-3">Answered</span><span className="font-semibold">{c.answered} · {answeredPct}%</span></div>
            <div className="flex justify-between"><span className="text-ink-3">Missed</span><span className="font-semibold">{c.missed}</span></div>
            <div className="flex justify-between"><span className="text-ink-3">Avg talk time</span><span className="font-semibold">{c.avg_duration_seconds ? `${Math.round(c.avg_duration_seconds)}s` : "—"}</span></div>
          </div>
        </Card>

        <Card padded>
          <div className="text-[13px] font-semibold mb-3">No-show recall</div>
          {noShow.data ? (
            <div className="flex flex-col gap-2.5 text-[13px]">
              <div className="flex justify-between"><span className="text-ink-3">No-shows</span><span className="font-semibold">{noShow.data.no_shows}</span></div>
              <div className="flex justify-between"><span className="text-ink-3">Recall tasks done</span><span className="font-semibold text-success">{noShow.data.recall_tasks_done}</span></div>
            </div>
          ) : (
            <div className="text-[13px] text-ink-4">Loading…</div>
          )}
        </Card>

        <Card padded>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[13px] font-semibold">Owner's daily MIS</div>
            <div className="text-[11px] px-1.5 py-0.5 rounded-tag bg-chip-bg text-chip-text font-semibold">WhatsApp 9:00 pm</div>
          </div>
          <div className="border border-border rounded-control bg-page p-3 text-[12.5px] leading-relaxed text-ink-2 whitespace-pre-wrap">
            {mis.data?.text ?? "Loading…"}
          </div>
        </Card>
      </div>
    </div>
  )
}
