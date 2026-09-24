import { useQuery } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { Pill, Chip } from "../../components/ui/Pill"
import { LoadingState, EmptyState } from "../../components/ui/QueryStates"
import { getChainOverview } from "../../api/enquiries"

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

export function MultiBranchChainAggregator() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["chain-overview"],
    queryFn: getChainOverview,
  })

  if (isLoading) {
    return (
      <Card padded className="min-h-[300px] flex items-center justify-center">
        <LoadingState />
      </Card>
    )
  }

  if (isError || !data) {
    return (
      <Card padded>
        <EmptyState
          message="Could not load multi-branch data. Make sure this hospital is linked to a hospital group in hospital settings."
        />
      </Card>
    )
  }

  const {
    group_name,
    total_branches,
    total_group_enquiries,
    total_group_pipeline_value,
    total_group_converted_value,
    overall_conversion_rate,
    branches,
  } = data

  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* Network Header Banner */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🌐</span>
              <h2 className="text-lg font-bold tracking-tight">{group_name}</h2>
              <span className="text-xs bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded font-mono font-semibold">
                {total_branches} Branches Connected
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Unified cross-branch CRM aggregation, centralized pipeline velocity, and OPD/IPD conversion tracking
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="self-start md:self-auto px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 border border-white/20 rounded font-semibold transition"
          >
            🔄 Refresh Aggregates
          </button>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="bg-white/5 p-3 rounded-lg border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] text-slate-300 block uppercase font-medium">Total Network Inquiries</span>
            <span className="text-xl font-black text-white">{total_group_enquiries.toLocaleString()}</span>
          </div>
          <div className="bg-white/5 p-3 rounded-lg border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] text-slate-300 block uppercase font-medium">Active Pipeline Value</span>
            <span className="text-xl font-black text-amber-300">{INR.format(total_group_pipeline_value)}</span>
          </div>
          <div className="bg-white/5 p-3 rounded-lg border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] text-slate-300 block uppercase font-medium">Realized Converted Rev</span>
            <span className="text-xl font-black text-emerald-400">{INR.format(total_group_converted_value)}</span>
          </div>
          <div className="bg-white/5 p-3 rounded-lg border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] text-slate-300 block uppercase font-medium">Network Conversion</span>
            <span className="text-xl font-black text-teal-300">{overall_conversion_rate}%</span>
          </div>
        </div>
      </div>

      {/* Branch Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {branches.map((branch) => (
          <Card
            key={branch.hospital_id}
            padded
            className={`flex flex-col justify-between transition-all ${
              branch.is_current
                ? "border-2 border-brand ring-2 ring-brand-tint bg-brand-tint/10 shadow-sm"
                : "border-border-faint hover:border-border-strong hover:shadow-xs"
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm text-ink-1">{branch.hospital_name}</h3>
                  </div>
                  <span className="text-[11px] text-ink-4">📍 {branch.city} • /{branch.slug}</span>
                </div>
                {branch.is_current ? (
                  <Chip tone="ok">Current Branch</Chip>
                ) : (
                  <Pill tone="neutral">Sister Branch</Pill>
                )}
              </div>

              {/* Pipeline Value Highlight */}
              <div className="my-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-border-faint flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-ink-4 block font-semibold">Active Pipeline</span>
                  <span className="text-sm font-bold text-ink-1">{INR.format(branch.pipeline_value)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-ink-4 block font-semibold">Conversion Rate</span>
                  <span className="text-sm font-bold text-emerald-600">{branch.conversion_rate}%</span>
                </div>
              </div>

              {/* Stage Flow Breakdown Bar */}
              <div className="space-y-1.5 text-xs pt-1">
                <div className="text-[11px] font-semibold text-ink-3">Pipeline Funnel Distribution:</div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 p-1.5 rounded text-center">
                    <span className="block font-bold">{branch.stages.new}</span>
                    <span className="text-[9px] uppercase">New</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-1.5 rounded text-center">
                    <span className="block font-bold">{branch.stages.contacted}</span>
                    <span className="text-[9px] uppercase">Contacted</span>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 p-1.5 rounded text-center">
                    <span className="block font-bold">{branch.stages.scheduled}</span>
                    <span className="text-[9px] uppercase">Scheduled</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px] mt-1">
                  <div className="bg-purple-50 border border-purple-200 text-purple-800 p-1.5 rounded text-center">
                    <span className="block font-bold">{branch.stages.visited}</span>
                    <span className="text-[9px] uppercase">Visited</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-1.5 rounded text-center">
                    <span className="block font-bold">{branch.stages.completed}</span>
                    <span className="text-[9px] uppercase">Won</span>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-1.5 rounded text-center">
                    <span className="block font-bold">{branch.stages.lost}</span>
                    <span className="text-[9px] uppercase">Lost</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom stats footer */}
            <div className="mt-4 pt-3 border-t border-border-faint flex items-center justify-between text-[11px] text-ink-4">
              <span>Total: <strong>{branch.total_enquiries} Leads</strong></span>
              <span>SLA Breaches: <strong className={branch.sla_breaches > 0 ? "text-rose-600" : "text-emerald-600"}>{branch.sla_breaches}</strong></span>
              <span>Estimates: <strong>{branch.treatment_estimates_count}</strong></span>
            </div>
          </Card>
        ))}
      </div>

      {/* Network Comparative Table */}
      <Card padded>
        <CardHeader className="justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink-1">Branch Benchmarking & Performance Matrix</h3>
            <p className="text-xs text-ink-4">Compare conversion velocity and SLA discipline across all group locations</p>
          </div>
        </CardHeader>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-[11px] uppercase tracking-wider text-ink-4">
                <th className="py-2.5 px-3">Branch Location</th>
                <th className="py-2.5 px-3">City</th>
                <th className="py-2.5 px-3 text-right">Total Leads</th>
                <th className="py-2.5 px-3 text-right">Active In Pipeline</th>
                <th className="py-2.5 px-3 text-right">Active Value</th>
                <th className="py-2.5 px-3 text-right">Won Revenue</th>
                <th className="py-2.5 px-3 text-right">Conversion %</th>
                <th className="py-2.5 px-3 text-center">SLA Breaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-faint text-ink-2">
              {branches.map((b) => (
                <tr
                  key={b.hospital_id}
                  className={`hover:bg-slate-50/70 transition-colors ${
                    b.is_current ? "bg-brand-tint/20 font-semibold" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 flex items-center gap-2">
                    <span>{b.hospital_name}</span>
                    {b.is_current && <span className="text-[10px] bg-brand text-white px-1.5 py-0.2 rounded font-bold">You</span>}
                  </td>
                  <td className="py-2.5 px-3 text-ink-4">{b.city}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">{b.total_enquiries}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{b.active_leads}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-ink-1">{INR.format(b.pipeline_value)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{INR.format(b.converted_value)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      b.conversion_rate >= 20 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {b.conversion_rate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={b.sla_breaches > 0 ? "text-rose-600 font-bold" : "text-emerald-600"}>
                      {b.sla_breaches}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
