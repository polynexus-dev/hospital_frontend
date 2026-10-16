import { useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { LicenseTile } from "../settings/LicenseTile"
import { LoadingState, ErrorState } from "../../components/ui/QueryStates"
import { dailyMisPreview, exportMISReport, liveDashboard, noShowEffectiveness, type Trend } from "../../api/analytics"
import { listDoctors } from "../../api/appointments"

// Owner dashboard. Every figure comes from /reports/live-dashboard/ (or the
// report endpoints below), refreshes every 30 s, and each card opens the
// screen where that work happens.

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const REFRESH_MS = 30_000

type PresetKey = "today" | "yesterday" | "7d" | "mtd" | "last_month"

/** Local calendar date (toISOString would give the UTC date, a day early before 05:30 IST). */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function presetRange(preset: PresetKey): { start: string; end: string } {
  const today = new Date()
  const day = (offset: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
  switch (preset) {
    case "today":
      return { start: ymd(today), end: ymd(today) }
    case "yesterday":
      return { start: ymd(day(-1)), end: ymd(day(-1)) }
    case "7d":
      return { start: ymd(day(-6)), end: ymd(today) }
    case "last_month":
      return { start: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)), end: ymd(new Date(today.getFullYear(), today.getMonth(), 0)) }
    default:
      return { start: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), end: ymd(today) }
  }
}

const selectCls = "bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-ink-2 font-medium focus:outline-none focus:border-brand"
const cardCls = "bg-white border border-border rounded-xl shadow-2xs text-left transition-all hover:border-brand-border hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"

/** ↑/↓ with the percentage; green when the move is good (`upIsGood` says which way that is). */
function TrendBadge({ change, unit = "%", upIsGood = true }: { change: number | null | undefined; unit?: string; upIsGood?: boolean }) {
  if (change === null || change === undefined) return <span className="text-[11px] text-ink-5" title="No data for the previous period">—</span>
  if (change === 0) return <span className="text-[11px] font-bold text-ink-4">0{unit}</span>
  const good = change > 0 === upIsGood
  return (
    <span className={`text-[11px] font-bold flex items-center gap-0.5 ${good ? "text-success" : "text-danger-text"}`} title="vs the previous period of the same length">
      <span>{change > 0 ? "↑" : "↓"}</span>
      <span>
        {Math.abs(change)}
        {unit}
      </span>
    </span>
  )
}

function Kpi({ label, value, trend, to, danger, hint }: { label: string; value: ReactNode; trend?: ReactNode; to: string; danger?: boolean; hint: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)} title={hint} className={`${cardCls} p-3.5 flex flex-col justify-between`}>
      <div className={`text-[10px] font-bold tracking-wider uppercase ${danger ? "text-danger-text" : "text-slate-400"}`}>{label}</div>
      <div className="flex items-baseline justify-between mt-2 w-full">
        <div className="text-xl font-bold text-ink tabular-nums">{value}</div>
        {trend}
      </div>
    </button>
  )
}

function StatusCard({ icon, value, label, to, tone, hint }: { icon: ReactNode; value: number; label: string; to: string; tone: "brand" | "warning" | "danger"; hint: string }) {
  const navigate = useNavigate()
  const accent = { brand: "", warning: "bg-warning", danger: "bg-danger" }[tone]
  const box = { brand: "bg-brand-tint/90 text-brand-dark", warning: "bg-warning-bg/80 text-warning-text", danger: "bg-danger-bg/80 text-danger-text" }[tone]
  const text = { brand: "text-slate-400", warning: "text-warning-text", danger: "text-danger-text" }[tone]
  return (
    <button type="button" onClick={() => navigate(to)} title={hint} className={`${cardCls} p-4 flex items-center gap-4 relative overflow-hidden`}>
      {accent && <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent} rounded-l-xl`} />}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent ? "ml-1" : ""} ${box}`}>{icon}</div>
      <div>
        <div className="text-2xl font-extrabold text-ink leading-tight tabular-nums">{value}</div>
        <div className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${text}`}>{label}</div>
      </div>
    </button>
  )
}

const icon = (d: ReactNode) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

export function DashboardPage() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState<PresetKey>("mtd")
  const [department, setDepartment] = useState("all")
  const [doctor, setDoctor] = useState("all")
  const [isExporting, setIsExporting] = useState(false)
  const [showDetailedMIS, setShowDetailedMIS] = useState(false)

  const range = useMemo(() => presetRange(preset), [preset])
  const live = useQuery({
    queryKey: ["reports", "live-dashboard", range, department, doctor],
    queryFn: () => liveDashboard({ ...range, department, doctor }),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  })
  const mis = useQuery({ queryKey: ["reports", "daily-mis-preview", range], queryFn: () => dailyMisPreview(range), refetchInterval: REFRESH_MS })
  const noShow = useQuery({ queryKey: ["reports", "no-show-effectiveness", range], queryFn: () => noShowEffectiveness(range), refetchInterval: REFRESH_MS })
  const doctorsQuery = useQuery({ queryKey: ["doctors", "dashboard"], queryFn: () => listDoctors({ page_size: "200" }) })

  const doctors = useMemo(() => {
    const all = doctorsQuery.data?.results ?? []
    return all
      .filter((d) => department === "all" || String(d.department) === department)
      .map((d) => ({ id: String(d.id), name: `Dr. ${(d.name || "").replace(/^Dr\.?\s*/i, "")}` }))
  }, [doctorsQuery.data, department])

  const handleExport = async (format: "pdf" | "csv") => {
    try {
      setIsExporting(true)
      await exportMISReport(format, range)
    } finally {
      setIsExporting(false)
    }
  }

  if (live.isLoading) return <LoadingState />
  if (live.isError || !live.data) return <ErrorState />
  const d = live.data

  const revenueMax = Math.max(1, ...d.revenue_by_service.map((r) => Number(r.amount)))
  const revenueTotal = d.revenue_by_service.reduce((s, r) => s + Number(r.amount), 0)
  const volumeMax = Math.max(1, ...d.department_volume.map((r) => r.count))
  const volumeTotal = d.department_volume.reduce((s, r) => s + r.count, 0)
  const enquiryMax = Math.max(1, d.enquiries.new, d.enquiries.contacted, d.enquiries.follow_up, d.enquiries.converted)
  const pct = (t: Trend) => t.change_pct
  const updated = new Date(d.generated_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })

  return (
    <div className="flex flex-col gap-3.5 bg-page/50 px-3.5 pb-3.5 pt-1 min-h-screen font-sans text-ink">
      <LicenseTile />

      {/* ── FILTERS + LIVE STATUS + EXPORT ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <select value={preset} onChange={(e) => setPreset(e.target.value as PresetKey)} className={selectCls} aria-label="Date range">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="mtd">This month</option>
            <option value="last_month">Last month</option>
          </select>
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value)
              setDoctor("all")
            }}
            className={selectCls}
            aria-label="Department"
          >
            <option value="all">All departments</option>
            {d.filters.departments.map((dep) => (
              <option key={dep.id} value={String(dep.id)}>
                {dep.name}
              </option>
            ))}
          </select>
          <select value={doctor} onChange={(e) => setDoctor(e.target.value)} className={selectCls} aria-label="Doctor">
            <option value="all">All doctors</option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-4" title="Refreshes every 30 seconds">
            <span className={`w-2 h-2 rounded-full ${live.isFetching ? "bg-warning" : "bg-success"} animate-pulse`} />
            Live · updated {updated}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport("csv")}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-2 bg-white border border-border hover:bg-page transition-colors shadow-2xs disabled:opacity-50"
          >
            <span>📊</span>
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-dark hover:bg-blue-800 transition-colors shadow-2xs disabled:opacity-50"
          >
            <span>📄</span>
            <span>{isExporting ? "Generating..." : "Export MIS (PDF)"}</span>
          </button>
        </div>
      </div>

      {/* ── ROW 1: PERIOD KPIs (vs the previous period of the same length) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <Kpi label="Calls received" value={d.calls.received.value.toLocaleString("en-IN")} trend={<TrendBadge change={pct(d.calls.received)} />} to="/call-logs" hint="Open call logs" />
        <Kpi label="Calls answered" value={d.calls.answered.value.toLocaleString("en-IN")} trend={<TrendBadge change={pct(d.calls.answered)} />} to="/call-logs" hint="Open call logs" />
        <Kpi label="Unanswered" danger value={d.calls.missed.value.toLocaleString("en-IN")} trend={<TrendBadge change={pct(d.calls.missed)} upIsGood={false} />} to="/callbacks" hint="Open the callback queue" />
        <Kpi label="OPD completed" value={d.opd.completed.value.toLocaleString("en-IN")} trend={<TrendBadge change={pct(d.opd.completed)} />} to="/appointments" hint="Open appointments" />
        <Kpi label="OPD visits" value={d.opd.encounters.value.toLocaleString("en-IN")} trend={<TrendBadge change={pct(d.opd.encounters)} />} to="/appointments" hint="Patients who checked in — open appointments" />
        <Kpi
          label="Avg wait (mins)"
          value={d.opd.avg_wait_minutes.value ?? "—"}
          trend={<TrendBadge change={d.opd.avg_wait_minutes.change_minutes} unit="m" upIsGood={false} />}
          to="/queue"
          hint="Check-in to consultation start — open the queue"
        />
      </div>

      {/* ── ROW 2: RIGHT NOW ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          tone="brand"
          value={d.now.in_consultation}
          label={`In consultation · ${d.now.waiting} waiting`}
          to="/queue"
          hint="Open the OPD queue"
          icon={icon(<><path d="M8 7v3.5a4 4 0 008 0V7" /><path d="M12 14.5v.5a4.5 4.5 0 009 0v-2.5" /><circle cx="21" cy="12.5" r="1.5" fill="currentColor" stroke="none" /></>)}
        />
        <StatusCard tone="brand" value={d.now.consults_done_today} label="Consults done today" to="/appointments" hint="Open appointments" icon={icon(<><circle cx="12" cy="12" r="8.5" /><path d="M9 12l2 2 4-4" /></>)} />
        <StatusCard tone="warning" value={d.now.lab_pending} label="Lab pending" to="/diagnostics" hint="Open the lab worklist" icon={icon(<path d="M9 3h6M10 3v6l-5.2 9.4A1.5 1.5 0 006.1 20.8h11.8a1.5 1.5 0 001.3-2.4L14 9V3" />)} />
        <StatusCard
          tone="danger"
          value={d.now.radiology_pending}
          label="Radiology pending"
          to="/diagnostics?tab=radiology"
          hint="Open radiology orders"
          icon={icon(<><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v2M16 3v2M8 11h8M8 15h5" /></>)}
        />
      </div>

      {/* ── ROW 3: REVENUE BY SERVICE & ENQUIRY STATUS ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <button type="button" onClick={() => navigate("/billing")} title="Open billing" className={`${cardCls} lg:col-span-8 p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-ink">Revenue by service</h3>
            <span className="text-sm font-bold text-ink tabular-nums">{INR.format(revenueTotal)}</span>
          </div>
          {d.revenue_by_service.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-ink-4">No bills in this period.</div>
          ) : (
            <div className="h-44 flex items-end justify-between gap-4">
              {d.revenue_by_service.map((r) => {
                const amount = Number(r.amount)
                return (
                  <div key={r.service} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="text-[10px] font-bold text-ink-3 mb-1 tabular-nums">{INR.format(amount)}</div>
                    <div style={{ height: `${Math.max(4, Math.round((amount / revenueMax) * 85))}%` }} className="w-full max-w-[48px] bg-brand-dark rounded-t-sm group-hover:brightness-110" />
                    <span className="text-[11px] font-medium text-ink-4 mt-2 truncate w-full text-center">{r.service}</span>
                  </div>
                )
              })}
            </div>
          )}
        </button>

        <button type="button" onClick={() => navigate("/enquiries")} title="Open enquiries" className={`${cardCls} lg:col-span-4 p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-ink">Enquiry status</h3>
            <span className="text-xs text-ink-4">{d.enquiries.total} in period</span>
          </div>
          <div className="bg-page/70 border border-border rounded-xl p-4 h-40 flex items-end justify-center gap-4 mb-4">
            {[
              ["New", d.enquiries.new, "bg-warning/40"],
              ["Contacted", d.enquiries.contacted, "bg-brand-dark"],
              ["Follow-up", d.enquiries.follow_up, "bg-brand-border"],
              ["Converted", d.enquiries.converted, "bg-success"],
            ].map(([label, value, color]) => (
              <div key={label as string} className="flex flex-col items-center h-full justify-end flex-1 max-w-[52px]">
                <div style={{ height: `${Math.max(3, Math.round(((value as number) / enquiryMax) * 100))}%` }} className={`w-full rounded-t-xs ${color}`} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1 text-center">
            {[
              ["New", d.enquiries.new, "text-warning-text"],
              ["Contacted", d.enquiries.contacted, "text-brand-dark"],
              ["Follow-up", d.enquiries.follow_up, "text-brand"],
              ["Converted", d.enquiries.converted, "text-success-text"],
            ].map(([label, value, color]) => (
              <div key={label as string}>
                <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
                <div className="text-[10.5px] font-semibold text-slate-400">{label}</div>
              </div>
            ))}
          </div>
        </button>
      </div>

      {/* ── ROW 4: DEPARTMENT VOLUME & MIS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-6 bg-white border border-border rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-ink">Department volume</h3>
            <div className="text-sm font-bold text-ink tracking-tight">
              TOTAL <span className="text-lg tabular-nums">{volumeTotal}</span>
            </div>
          </div>
          {d.department_volume.length === 0 ? (
            <div className="text-sm text-ink-4">No OPD visits in this period.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {d.department_volume.map((r) => (
                <button
                  type="button"
                  key={r.department}
                  onClick={() => (r.department_id ? setDepartment(String(r.department_id)) : navigate("/appointments"))}
                  title={r.department_id ? `Filter the dashboard to ${r.department}` : "Open appointments"}
                  className="text-left rounded-md px-1 -mx-1 py-0.5 hover:bg-page"
                >
                  <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                    <span className="text-ink-2">{r.department}</span>
                    <span className="text-ink font-bold tabular-nums">{r.count}</span>
                  </div>
                  <div className="w-full bg-chip-bg h-2 rounded-full overflow-hidden">
                    <div style={{ width: `${Math.round((r.count / volumeMax) * 100)}%` }} className="bg-brand-dark h-full rounded-full transition-all duration-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-border rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-ink">Executive MIS summary</h3>
            <button onClick={() => setShowDetailedMIS((prev) => !prev)} className="text-xs font-semibold text-brand hover:underline">
              {showDetailedMIS ? "Hide details" : "View full text"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button type="button" onClick={() => navigate("/doctors")} title="Open doctors" className="text-left bg-page border border-border rounded-lg p-3 hover:border-brand-border">
              <div className="text-[10px] font-bold uppercase text-slate-400">Doctor revenue billed</div>
              <div className="text-base font-bold text-ink mt-1 tabular-nums">
                {INR.format(Number(d.doctor_billed))}
              </div>
            </button>
            <button type="button" onClick={() => navigate("/appointments")} title="Open appointments" className="text-left bg-page border border-border rounded-lg p-3 hover:border-brand-border">
              <div className="text-[10px] font-bold uppercase text-slate-400">No-shows recalled</div>
              <div className="text-base font-bold text-success mt-1 tabular-nums">
                {noShow.data ? `${noShow.data.recall_tasks_done} of ${noShow.data.no_shows}` : "—"}
              </div>
            </button>
          </div>
          {showDetailedMIS && (
            <div className="border border-border rounded-lg bg-page p-3 text-xs leading-relaxed text-ink-2 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
              {mis.data?.text ?? "Loading executive summary…"}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
