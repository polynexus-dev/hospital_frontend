import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { StatTile } from "../../components/ui/StatTile"
import { ProgressBar } from "../../components/ui/ProgressBar"
import { LoadingState, ErrorState } from "../../components/ui/QueryStates"
import {
  callPerformance,
  dailyMisPreview,
  departmentDoctorVolume,
  doctorRevenue,
  enquiryFunnel,
  noShowEffectiveness,
  revenueBySource,
  exportMISReport,
} from "../../api/analytics"

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  scheduled: "Scheduled",
  visited: "Visited",
  completed: "Completed",
  follow_up: "Follow-up",
  lost: "Lost",
}

type PresetKey = "today" | "yesterday" | "7d" | "mtd" | "last_month" | "custom"

interface DateRange {
  start: string
  end: string
}

function getPresetRange(preset: PresetKey): DateRange {
  const today = new Date()
  const toYmd = (d: Date) => d.toISOString().slice(0, 10)

  if (preset === "today") {
    const s = toYmd(today)
    return { start: s, end: s }
  }
  if (preset === "yesterday") {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    const s = toYmd(y)
    return { start: s, end: s }
  }
  if (preset === "mtd") {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return { start: toYmd(firstDay), end: toYmd(today) }
  }
  if (preset === "last_month") {
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
    return { start: toYmd(firstDayLastMonth), end: toYmd(lastDayLastMonth) }
  }
  // "7d" default
  const past7 = new Date(today)
  past7.setDate(past7.getDate() - 7)
  return { start: toYmd(past7), end: toYmd(today) }
}

export function DashboardPage() {
  const [preset, setPreset] = useState<PresetKey>("7d")
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange("7d"))
  const [isExporting, setIsExporting] = useState(false)

  const dateParams = useMemo(() => ({ start: dateRange.start, end: dateRange.end }), [dateRange.start, dateRange.end])

  const calls = useQuery({ queryKey: ["reports", "call-performance", dateParams], queryFn: () => callPerformance(dateParams) })
  const funnel = useQuery({ queryKey: ["reports", "enquiry-funnel", dateParams], queryFn: () => enquiryFunnel(dateParams) })
  const deptVolume = useQuery({ queryKey: ["reports", "department-doctor-volume", dateParams], queryFn: () => departmentDoctorVolume(dateParams) })
  const noShow = useQuery({ queryKey: ["reports", "no-show-effectiveness", dateParams], queryFn: () => noShowEffectiveness(dateParams) })
  const mis = useQuery({ queryKey: ["reports", "daily-mis-preview", dateParams], queryFn: () => dailyMisPreview(dateParams) })
  const revenue = useQuery({ queryKey: ["reports", "revenue-by-source", dateParams], queryFn: () => revenueBySource(dateParams) })
  const docRevenue = useQuery({ queryKey: ["reports", "doctor-revenue", dateParams], queryFn: () => doctorRevenue(dateParams) })

  const periodLabel = useMemo(() => {
    switch (preset) {
      case "today":
        return "Today"
      case "yesterday":
        return "Yesterday"
      case "7d":
        return "Last 7 days"
      case "mtd":
        return "This month (MTD)"
      case "last_month":
        return "Last month"
      default:
        return `${dateRange.start} → ${dateRange.end}`
    }
  }, [preset, dateRange.start, dateRange.end])

  const handleExport = async (format: "pdf" | "csv") => {
    try {
      setIsExporting(true)
      await exportMISReport(format, dateParams)
    } finally {
      setIsExporting(false)
    }
  }

  if (calls.isLoading || funnel.isLoading) return <LoadingState />
  if (calls.isError || funnel.isError) return <ErrorState />

  const c = calls.data ?? { received: 0, answered: 0, missed: 0, avg_duration_seconds: null }
  const answeredPct = c.received ? Math.round((c.answered / c.received) * 100) : 0
  const enquiryTotal = funnel.data ? Object.values(funnel.data).reduce((a, b) => a + b, 0) : 0
  const funnelEntries = funnel.data ? Object.entries(funnel.data) : []
  const funnelMax = Math.max(1, ...funnelEntries.map(([, n]) => n))

  const deptRows = deptVolume.data?.rows ?? []
  const byDept = new Map<string, number>()
  for (const row of deptRows) {
    const key = row.doctor__department__name ?? "Unassigned"
    byDept.set(key, (byDept.get(key) ?? 0) + row.booked)
  }
  const deptEntries = [...byDept.entries()].sort((a, b) => b[1] - a[1])
  const deptMax = Math.max(1, ...deptEntries.map(([, n]) => n))

  const totalBooked = deptRows.reduce((sum, r) => sum + r.booked, 0)
  const totalCompleted = deptRows.reduce((sum, r) => sum + r.completed, 0)
  const conversionPct = totalBooked ? Math.round((totalCompleted / totalBooked) * 100) : 0

  return (
    <div className="flex flex-col gap-3.5">
      {/* Date Range & MIS Export Toolbar */}
      <Card className="p-3 bg-surface border border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-ink-4 uppercase tracking-wider mr-1">MIS Period:</span>
          {[
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Yesterday" },
            { key: "7d", label: "Last 7 Days" },
            { key: "mtd", label: "This Month (MTD)" },
            { key: "last_month", label: "Last Month" },
            { key: "custom", label: "Custom 📅" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                const k = item.key as PresetKey
                setPreset(k)
                if (k !== "custom") {
                  setDateRange(getPresetRange(k))
                }
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                preset === item.key
                  ? "bg-brand text-white shadow-xs"
                  : "bg-page border border-border text-ink-3 hover:text-ink hover:border-border-strong"
              }`}
            >
              {item.label}
            </button>
          ))}

          {preset === "custom" && (
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border text-xs">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="h-7 px-2 border border-border-strong rounded bg-page text-ink text-xs outline-none focus:border-brand"
              />
              <span className="text-ink-4">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="h-7 px-2 border border-border-strong rounded bg-page text-ink text-xs outline-none focus:border-brand"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleExport("csv")}
            disabled={isExporting}
          >
            📊 Export CSV
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
          >
            {isExporting ? "Generating…" : "📄 Export MIS (PDF)"}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-6 gap-3 min-w-[1020px]">
        <StatTile label="Calls received" value={c.received} sub={periodLabel} />
        <StatTile label="Answered" value={`${answeredPct}%`} sub={`${c.answered} of ${c.received}`} valueClassName={answeredPct >= 80 ? "text-success" : ""} />
        <StatTile label="Missed" value={c.missed} valueClassName={c.missed > 0 ? "text-danger" : ""} />
        <StatTile label="Enquiries captured" value={enquiryTotal} sub={periodLabel} />
        <StatTile label="Booked → completed" value={`${conversionPct}%`} valueClassName="text-success" />
        <StatTile label="No-shows" value={noShow.data?.no_shows ?? "—"} sub={noShow.data ? `${noShow.data.recall_tasks_done} recalled` : undefined} />
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-3.5 items-start">
        <Card padded>
          <div className="flex items-baseline gap-2.5 mb-3.5">
            <div className="text-[13px] font-semibold">Enquiry pipeline by stage</div>
            <div className="text-[12px] text-ink-4">{periodLabel}</div>
          </div>
          <div className="flex flex-col gap-2.5">
            {funnelEntries.map(([stage, n]) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="flex-none w-[132px] text-[12.5px] text-ink-3">{STAGE_LABELS[stage] ?? stage}</div>
                <div className="flex-1">
                  <ProgressBar pct={(n / funnelMax) * 100} height={22} color="var(--color-brand)" />
                </div>
                <div className="flex-none w-[44px] text-right text-[13px] font-semibold">{n}</div>
              </div>
            ))}
            {funnelEntries.length === 0 && <div className="text-[13px] text-ink-4">No enquiries in this period.</div>}
          </div>
        </Card>

        <Card padded>
          <div className="flex items-baseline gap-2.5 mb-3">
            <div className="text-[13px] font-semibold">Department volume</div>
            <div className="text-[12px] text-ink-4">{periodLabel}</div>
          </div>
          <div className="flex flex-col gap-2.5">
            {deptEntries.map(([name, n]) => (
              <div key={name}>
                <div className="flex justify-between text-[12.5px] mb-1">
                  <span className="text-ink-3">{name}</span>
                  <span className="font-semibold">{n}</span>
                </div>
                <ProgressBar pct={(n / deptMax) * 100} color="var(--color-brand)" />
              </div>
            ))}
            {deptEntries.length === 0 && <div className="text-[13px] text-ink-4">No appointment data in this period.</div>}
          </div>
        </Card>
      </div>

      <Card padded>
        <div className="flex items-baseline gap-2.5 mb-3">
          <div className="text-[13px] font-semibold">Revenue by source</div>
          <div className="text-[12px] text-ink-4">{periodLabel}</div>
        </div>
        <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr] gap-2 pb-2 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold">
          <div>Source</div>
          <div className="text-right">Enq</div>
          <div className="text-right">Conv</div>
          <div className="text-right">Billed</div>
        </div>
        {revenue.data?.rows.map((r) => (
          <div key={r.source} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr] gap-2 py-2 border-b border-border-faint text-[13px] items-center">
            <div className="capitalize">{r.source.replace("_", " ")}</div>
            <div className="text-right text-ink-3">{r.enquiry_count}</div>
            <div className="text-right text-ink-3">{r.conversion_count}</div>
            <div className="text-right font-semibold">{INR.format(Number(r.billed_amount))}</div>
          </div>
        ))}
        {!revenue.data?.rows.length && <div className="text-[13px] text-ink-4 py-2">No source data in this period.</div>}
        {revenue.data?.note && <div className="text-[11.5px] text-ink-4 mt-2 leading-relaxed">{revenue.data.note}</div>}
      </Card>

      <Card padded>
        <div className="flex items-baseline gap-2.5 mb-3">
          <div className="text-[13px] font-semibold">Revenue by doctor</div>
          <div className="text-[12px] text-ink-4">{periodLabel}</div>
        </div>
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
        {!docRevenue.data?.rows.length && <div className="text-[13px] text-ink-4 py-2">No doctor revenue data in this period.</div>}
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-semibold">{preset === "mtd" ? "Monthly Executive MIS" : "Management MIS"}</div>
              <div className="text-[11px] px-1.5 py-0.5 rounded-tag bg-chip-bg text-chip-text font-semibold">
                {periodLabel}
              </div>
            </div>
            <button
              onClick={() => handleExport("pdf")}
              className="text-[11.5px] font-semibold text-brand hover:underline"
            >
              Download PDF ↓
            </button>
          </div>
          <div className="border border-border rounded-control bg-page p-3 text-[12.5px] leading-relaxed text-ink-2 whitespace-pre-wrap font-mono">
            {mis.data?.text ?? "Loading…"}
          </div>
        </Card>
      </div>
    </div>
  )
}
