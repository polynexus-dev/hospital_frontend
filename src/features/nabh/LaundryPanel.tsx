import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { col, opts } from "./fields"

// Laundry: soiled / infected linen from a ward → wash → returned clean.
// Infected linen can't be marked washed without a validated wash (≥71 °C × 3 min or a chemical disinfection).

const inputCls = "w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

function BatchRow({ b, onChange }: { b: any; onChange: () => void }) {
  const [mode, setMode] = useState<"process" | "return" | null>(null)
  const [wash, setWash] = useState({ wash_temp_c: "", wash_minutes: "", disinfectant: "" })
  const [counts, setCounts] = useState<Record<number, { returned_qty: string; rejected_qty: string }>>({})
  const [weight, setWeight] = useState("")
  const [error, setError] = useState<string | null>(null)
  const submit = async (path: string, body: object) => {
    setError(null)
    try {
      await api.post(`/support-services/laundry-batches/${b.id}/${path}`, body)
      setMode(null)
      onChange()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 space-y-2">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <div>
          <span className="font-semibold">{b.batch_number}</span> · {b.ward_name || "—"} ·{" "}
          <span className={b.kind === "infected" ? "text-rose-700 font-semibold" : ""}>{b.kind === "infected" ? "Infected (red bag)" : "Soiled"}</span>
          {b.vendor && <span className="text-slate-500"> · {b.vendor}</span>}
        </div>
        <div className="text-xs uppercase font-semibold text-emerald-700">{b.status}</div>
      </div>
      <div className="text-sm text-slate-600">
        {b.lines.map((l: any) => `${l.linen_name} ${l.sent_qty}${b.status === "returned" ? ` → ${l.returned_qty} back${l.rejected_qty ? `, ${l.rejected_qty} condemned` : ""}${l.lost_qty ? `, ${l.lost_qty} lost` : ""}` : ""}`).join(" · ")}
      </div>
      {b.status === "processed" && <div className="text-xs text-slate-500">Washed {b.wash_temp_c ? `${b.wash_temp_c} °C × ${b.wash_minutes} min` : ""}{b.disinfectant ? ` · ${b.disinfectant}` : ""}</div>}
      {b.status === "returned" && Number(b.cost) > 0 && <div className="text-xs text-slate-500">Laundry cost {inr(b.cost)}</div>}
      <div className="flex gap-2">
        {b.status === "collected" && <button onClick={() => setMode("process")} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white">Record wash</button>}
        {b.status === "processed" && <button onClick={() => setMode("return")} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white">Return to ward</button>}
      </div>
      {mode === "process" && (
        <div className="grid sm:grid-cols-4 gap-2 items-end pt-2">
          <label className="text-xs font-semibold text-slate-600">Temperature °C<input type="number" className={`${inputCls} mt-1`} value={wash.wash_temp_c} onChange={(e) => setWash({ ...wash, wash_temp_c: e.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-600">Minutes<input type="number" className={`${inputCls} mt-1`} value={wash.wash_minutes} onChange={(e) => setWash({ ...wash, wash_minutes: e.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-600">Chemical disinfection<input className={`${inputCls} mt-1`} placeholder="e.g. 1% hypochlorite, 30 min" value={wash.disinfectant} onChange={(e) => setWash({ ...wash, disinfectant: e.target.value })} /></label>
          <button onClick={() => submit("process/", wash)} className="px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white">Save wash</button>
          {b.kind === "infected" && <div className="sm:col-span-4 text-xs text-rose-700">Infected linen: at least 71 °C for 3 minutes, or record the chemical disinfection.</div>}
        </div>
      )}
      {mode === "return" && (
        <div className="space-y-2 pt-2">
          {b.lines.map((l: any) => (
            <div key={l.linen_type} className="grid grid-cols-3 gap-2 items-center text-sm">
              <span>{l.linen_name} ({l.sent_qty} sent)</span>
              <input type="number" placeholder="Returned clean" className={inputCls} value={counts[l.linen_type]?.returned_qty ?? ""}
                onChange={(e) => setCounts({ ...counts, [l.linen_type]: { ...counts[l.linen_type], returned_qty: e.target.value } })} />
              <input type="number" placeholder="Condemned" className={inputCls} value={counts[l.linen_type]?.rejected_qty ?? ""}
                onChange={(e) => setCounts({ ...counts, [l.linen_type]: { ...counts[l.linen_type], rejected_qty: e.target.value } })} />
            </div>
          ))}
          <div className="flex gap-2 items-center">
            <input type="number" placeholder="Weight kg (for vendor cost)" className={`${inputCls} max-w-xs`} value={weight} onChange={(e) => setWeight(e.target.value)} />
            <button onClick={() => submit("return/", { weight_kg: weight || null, lines: b.lines.map((l: any) => ({ linen_type: l.linen_type, ...counts[l.linen_type] })) })}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white">Confirm return</button>
          </div>
        </div>
      )}
      {error && <div className="text-sm text-rose-700">{error}</div>}
    </div>
  )
}

export function LaundryPanel() {
  const [dash, setDash] = useState<any>(null)
  const [batches, setBatches] = useState<any[]>([])
  const [types, setTypes] = useState<any[]>([])
  const [wards, setWards] = useState<any[]>([])
  const [draft, setDraft] = useState<{ ward: string; kind: string; vendor: string; rate_per_kg: string; counts: Record<number, string> }>({ ward: "", kind: "soiled", vendor: "", rate_per_kg: "", counts: {} })
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    api.get<any>("/support-services/laundry-batches/dashboard/").then(setDash).catch(() => setDash(null))
    api.get<any>("/support-services/laundry-batches/?page_size=50").then((r) => setBatches(r.results ?? r)).catch((e) => setError(extractApiError(e)))
  }
  useEffect(() => {
    load()
    api.get<any>("/support-services/linen-types/?page_size=200&is_active=true").then((r) => setTypes(r.results ?? r)).catch(() => setTypes([]))
    api.get<any>("/facilities/wards/?page_size=200").then((r) => setWards(r.results ?? r)).catch(() => setWards([]))
  }, [])

  const collect = async () => {
    setError(null)
    const lines = Object.entries(draft.counts).filter(([, n]) => Number(n) > 0).map(([t, n]) => ({ linen_type: Number(t), sent_qty: Number(n) }))
    try {
      await api.post("/support-services/laundry-batches/", { ward: draft.ward || null, kind: draft.kind, vendor: draft.vendor, rate_per_kg: draft.rate_per_kg || 0, lines })
      setDraft({ ...draft, counts: {} })
      load()
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  return (
    <div className="space-y-5">
      {dash && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[["Wards below par", String(dash.shortfalls.length)], ["Batches out > 24 h", String(dash.overdue_batches.length)],
            ["Avg turnaround", dash.average_turnaround_hours != null ? `${dash.average_turnaround_hours} h` : "—"], ["Laundry cost (30 d)", inr(dash.laundry_cost_30d)]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"><div className="text-xs text-slate-500">{l}</div><div className="text-2xl font-bold">{v}</div></div>
          ))}
        </div>
      )}
      {dash?.shortfalls.length > 0 && (
        <div className="text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2">Below par: {dash.shortfalls.map((s: any) => `${s.location} ${s.linen} (${s.clean}/${s.par})`).join(" · ")}</div>
      )}
      <section className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 space-y-3">
        <h2 className="font-semibold">Collect soiled linen</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <select className={inputCls} value={draft.ward} onChange={(e) => setDraft({ ...draft, ward: e.target.value })}>
            <option value="">Ward…</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select className={inputCls} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
            <option value="soiled">Soiled</option><option value="infected">Infected / isolation (red bag)</option>
          </select>
          <input className={inputCls} placeholder="Vendor (blank = in-house)" value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} />
          <input className={inputCls} type="number" placeholder="Vendor rate ₹/kg" value={draft.rate_per_kg} onChange={(e) => setDraft({ ...draft, rate_per_kg: e.target.value })} />
        </div>
        {types.length ? (
          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {types.map((t) => (
              <label key={t.id} className="text-xs font-semibold text-slate-600">{t.name}
                <input type="number" min={0} className={`${inputCls} mt-1`} value={draft.counts[t.id] ?? ""} onChange={(e) => setDraft({ ...draft, counts: { ...draft.counts, [t.id]: e.target.value } })} />
              </label>
            ))}
          </div>
        ) : <div className="text-sm text-slate-500">Add linen types in the "Linen types" tab first.</div>}
        <button onClick={collect} className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white">Record collection</button>
        {error && <div className="text-sm text-rose-700">{error}</div>}
      </section>
      <div className="space-y-3">{batches.map((b) => <BatchRow key={b.id} b={b} onChange={load} />)}</div>
    </div>
  )
}

export const linenTypesResource = {
  title: "Linen types", endpoint: "/support-services/linen-types/", createLabel: "Add linen type",
  columns: [col("name", "Linen"), col("category", "Category"), col("unit_cost", "Replacement cost"), col("expected_washes", "Life (washes)"), col("is_active", "Active")],
  fields: [{ key: "name", label: "Name", required: true }, { key: "category", label: "Category", type: "select" as const, options: opts("patient", "ot", "staff", "other"), defaultValue: "patient" },
    { key: "unit_cost", label: "Replacement cost (₹)", type: "number" as const }, { key: "expected_washes", label: "Life in washes", type: "number" as const, defaultValue: 150 }],
}

export const linenStockResource = {
  title: "Linen stock & par levels", description: "Clean linen at each ward; leave the ward blank for the central linen store. Issue moves clean stock from the central store to a ward.",
  endpoint: "/support-services/linen-stock/", createLabel: "Add stock location",
  columns: [col("ward_name", "Location"), col("linen_name", "Linen"), col("par_level", "Par"), col("clean_qty", "Clean"),
    { key: "shortfall", label: "Short by", render: (r: any) => (r.shortfall ? <span className="text-amber-700 font-semibold">{r.shortfall}</span> : "—") }],
  fields: [{ key: "ward", label: "Ward (blank = central store)", type: "fk" as const, source: "/facilities/wards/" }, { key: "linen_type", label: "Linen", type: "fk" as const, source: "/support-services/linen-types/", required: true },
    { key: "par_level", label: "Par level", type: "number" as const }, { key: "clean_qty", label: "Clean on hand", type: "number" as const }],
  toolbar: [{ label: "Issue to ward", path: "issue/", method: "post" as const, prompt: [
    { key: "linen_type", label: "Linen", type: "fk" as const, source: "/support-services/linen-types/", required: true },
    { key: "ward", label: "To ward", type: "fk" as const, source: "/facilities/wards/", required: true },
    { key: "quantity", label: "Quantity", type: "number" as const, required: true }] }],
}
