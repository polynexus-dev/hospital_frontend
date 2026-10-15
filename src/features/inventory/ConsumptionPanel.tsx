import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api, extractApiError } from "../../api/client"
import { FieldInput } from "../../components/resource/ResourceTable"

// Inventory consumption (MedNet M2.22 procurement): consumption and inward
// over the last N days, stock in hand, safety stock and the quantity to
// request so stock lasts the chosen number of days, filtered by several
// categories / sub-categories at once; selected rows become a transfer
// request (store indent).

interface Row {
  item: number; code: string; name: string; unit: string; category: string; subcategory: string
  consumption: number; inward: number; stock_in_hand: number; avg_daily: number; safety_stock: number
  reorder_level: number; roq: number; already_requested: number; trq: number; below: boolean
}
interface Cat { id: number; name: string; parent: number | null }
interface Resp { days: number; duration: number; rows: Row[]; categories: Cat[] }

const DAY_OPTIONS = [7, 15, 30, 60, 90]
const input = "h-8 px-2 border border-border-strong rounded-control text-[12.5px] bg-white dark:bg-slate-900"

function MultiPick({ label, options, value, onChange }: { label: string; options: Cat[]; value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="text-[12px]">
      <div className="font-semibold text-ink-3 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1 items-center">
        {value.map((id) => {
          const c = options.find((o) => o.id === id)
          return (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-tint text-brand-dark text-[11.5px] font-semibold">
              {c?.name ?? id}<button aria-label={`Remove ${c?.name}`} onClick={() => onChange(value.filter((x) => x !== id))}>×</button>
            </span>
          )
        })}
        <select className={input} value="" onChange={(e) => e.target.value && onChange([...value, Number(e.target.value)])} aria-label={label}>
          <option value="">+ add</option>
          {options.filter((o) => !value.includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
    </div>
  )
}

export function ConsumptionPanel() {
  const [cats, setCats] = useState<number[]>([])
  const [subs, setSubs] = useState<number[]>([])
  const [days, setDays] = useState(7)
  const [duration, setDuration] = useState(10)
  const [below, setBelow] = useState(false)
  const [search, setSearch] = useState("")
  const [qty, setQty] = useState<Record<number, string>>({})
  const [picked, setPicked] = useState<number[]>([])
  const [department, setDepartment] = useState("")
  const [store, setStore] = useState<unknown>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const params = `category=${cats.join(",")}&subcategory=${subs.join(",")}&days=${days}&duration=${duration}${below ? "&below=1" : ""}&search=${encodeURIComponent(search)}`
  const q = useQuery({ queryKey: ["inventory-consumption", params], queryFn: () => api.get<Resp>(`/inventory/consumption/?${params}`) })
  const all = q.data?.categories ?? []
  const top = useMemo(() => all.filter((c) => !c.parent), [all])
  const subOpts = useMemo(() => all.filter((c) => c.parent && (!cats.length || cats.includes(c.parent))), [all, cats])
  const rows = q.data?.rows ?? []
  const qtyOf = (r: Row) => (qty[r.item] !== undefined ? qty[r.item] : String(r.trq))

  const editSafety = async (r: Row) => {
    const v = window.prompt(`Safety stock for ${r.name} (${r.unit}):`, String(r.safety_stock))
    if (v === null || !/^\d+$/.test(v.trim())) return
    try { await api.patch(`/inventory/items/${r.item}/`, { safety_stock: Number(v) }); q.refetch() } catch (e) { setMsg({ ok: false, text: extractApiError(e) }) }
  }

  const request = async () => {
    setMsg(null)
    const items = rows.filter((r) => picked.includes(r.item)).map((r) => ({ item: r.item, quantity: Number(qtyOf(r)) || 0 })).filter((l) => l.quantity > 0)
    try {
      const res = await api.post<{ indent_number: string; lines: number }>("/inventory/consumption/request/", { department, from_store: store || null, items })
      setMsg({ ok: true, text: `Transfer request ${res.indent_number} raised for ${res.lines} item(s).` })
      setPicked([]); setQty({}); q.refetch()
    } catch (e) { setMsg({ ok: false, text: extractApiError(e) }) }
  }

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4" aria-label="Inventory consumption">
      <div>
        <h2 className="text-lg font-bold">Inventory consumption</h2>
        <p className="text-sm text-ink-4">Consumption and receipts over the period, stock in hand and the quantity to request so stock lasts the days you choose (plus safety stock), less what is already requested.</p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <MultiPick label="Category" options={top} value={cats} onChange={(v) => { setCats(v); setSubs(subs.filter((s) => all.find((c) => c.id === s && (!v.length || v.includes(c.parent ?? -1))))) }} />
        <MultiPick label="Sub-category" options={subOpts} value={subs} onChange={setSubs} />
        <label className="text-[12px] font-semibold text-ink-3">Consumption over
          <select className={`${input} block mt-1`} value={days} onChange={(e) => setDays(Number(e.target.value))}>{DAY_OPTIONS.map((d) => <option key={d} value={d}>{d} days</option>)}</select>
        </label>
        <label className="text-[12px] font-semibold text-ink-3">Keep stock for
          <input type="number" min={1} className={`${input} block mt-1 w-24`} value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={below} onChange={(e) => setBelow(e.target.checked)} /> Below reorder only</label>
        <input className={`${input} w-56`} placeholder="Search item" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] uppercase text-ink-4 border-b border-border">
              <th className="py-2 pr-2"><input type="checkbox" aria-label="Select all" checked={rows.length > 0 && picked.length === rows.length} onChange={(e) => setPicked(e.target.checked ? rows.map((r) => r.item) : [])} /></th>
              <th className="pr-2">Item</th><th className="pr-2">Category</th><th className="pr-2 text-right">Consumed</th><th className="pr-2 text-right">Inward</th>
              <th className="pr-2 text-right">In hand</th><th className="pr-2 text-right">Safety</th><th className="pr-2 text-right">ROQ</th><th className="pr-2 text-right">Requested</th><th className="text-right">Request qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.item} className={r.below ? "bg-warning-bg/30" : ""}>
                <td className="py-1.5 pr-2"><input type="checkbox" aria-label={`Select ${r.name}`} checked={picked.includes(r.item)} onChange={() => setPicked(picked.includes(r.item) ? picked.filter((x) => x !== r.item) : [...picked, r.item])} /></td>
                <td className="pr-2"><div className="font-medium">{r.name}</div><div className="text-[11px] text-ink-4">{r.code}</div></td>
                <td className="pr-2 text-ink-3">{r.category}{r.subcategory ? ` › ${r.subcategory}` : ""}</td>
                <td className="pr-2 text-right font-mono">{r.consumption} <span className="text-ink-5">{r.unit}</span></td>
                <td className="pr-2 text-right font-mono">{r.inward}</td>
                <td className={`pr-2 text-right font-mono ${r.below ? "text-danger-text font-semibold" : ""}`}>{r.stock_in_hand}</td>
                <td className="pr-2 text-right font-mono">
                  <button className="underline decoration-dotted" title="Change safety stock" onClick={() => editSafety(r)}>{r.safety_stock}</button>
                </td>
                <td className="pr-2 text-right font-mono">{r.roq}</td>
                <td className="pr-2 text-right font-mono">{r.already_requested}</td>
                <td className="text-right"><input type="number" min={0} className={`${input} w-20 text-right`} value={qtyOf(r)} onChange={(e) => setQty({ ...qty, [r.item]: e.target.value })} aria-label={`Quantity for ${r.name}`} /></td>
              </tr>
            ))}
            {!q.isLoading && rows.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-ink-4">No items match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
        <label className="text-[12px] font-semibold text-ink-3">Requesting department / store
          <input className={`${input} block mt-1 w-56`} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. IP Pharmacy" />
        </label>
        <label className="text-[12px] font-semibold text-ink-3 min-w-56">From store
          <div className="mt-1"><FieldInput field={{ key: "from_store", label: "From store", type: "fk", source: "/inventory/stores/" }} value={store} onChange={setStore} /></div>
        </label>
        <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white disabled:opacity-50" disabled={!picked.length || !department.trim()} onClick={request}>
          Create transfer request ({picked.length})
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-success-text" : "text-danger-text"}`}>{msg.text}</span>}
      </div>
    </section>
  )
}
