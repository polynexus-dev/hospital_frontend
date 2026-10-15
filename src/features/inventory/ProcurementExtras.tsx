import { useEffect, useRef, useState } from "react"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"
import { FieldInput, ResourceTable } from "../../components/resource/ResourceTable"
import { col } from "../nabh/fields"

// MedNet M2.22 procurement parity: rate contracts + contract-vs-actual MIS
// (PRC-1), PO sanction-date filters and delivery schedules (PRC-2), and the
// indent / PO cart kept between sessions (PRC-3).

const inputCls = "w-full px-3 py-2 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const cardCls = "bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4"
const labelCls = "text-xs font-semibold text-ink-3"
const inr = (n: unknown) => (n === null || n === undefined || n === "" ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`)
const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => today().slice(0, 8) + "01"
const vendorField = (required = true) => ({ key: "vendor", label: "Vendor", type: "fk" as const, source: "/finance/vendors/?is_active=true", required })
const itemField = { key: "item", label: "Item", type: "fk" as const, source: "/inventory/items/", sourceLabel: (r: any) => `${r.name} [${r.code}]`, required: true }

export function RateContractsPanel() {
  return (
    <div className="space-y-6">
      <ResourceTable config={{
        title: "Rate contracts",
        description: "A vendor's agreed rates for a period. PO lines for that vendor take the contract rate; ordering above it needs a reason.",
        endpoint: "/inventory/rate-contracts/", createLabel: "New contract",
        filters: [{ key: "is_active", label: "Active", type: "boolean" }],
        columns: [col("contract_number", "Contract"), col("vendor_name", "Vendor"), col("valid_from", "From"), col("valid_to", "To"),
          { key: "lines", label: "Items", render: (r) => (r.lines ?? []).map((l: any) => `${l.item_name} ₹${l.rate}`).join(", ") || "—" }, col("is_active", "Active")],
        fields: [vendorField(), { key: "contract_number", label: "Contract no.", required: true }, { key: "valid_from", label: "Valid from", type: "date", required: true },
          { key: "valid_to", label: "Valid to", type: "date", required: true }, { key: "notes", label: "Notes" }, { key: "is_active", label: "Active", type: "boolean", defaultValue: true }],
      }} />
      <ResourceTable config={{
        title: "Contract rates",
        endpoint: "/inventory/rate-contract-lines/", createLabel: "Add item rate",
        columns: [col("contract_number", "Contract"), col("item_name", "Item"), col("rate", "Rate"), { key: "contracted_quantity", label: "Contracted qty", render: (r) => r.contracted_quantity ?? "Open" }],
        fields: [{ key: "contract", label: "Contract", type: "fk", source: "/inventory/rate-contracts/?is_active=true", sourceLabel: (r: any) => `${r.contract_number} — ${r.vendor_name}`, required: true },
          itemField, { key: "rate", label: "Rate (₹)", type: "number", required: true }, { key: "contracted_quantity", label: "Contracted quantity (blank = open)", type: "number" }],
      }} />
    </div>
  )
}

interface MisLine { contract: string; vendor: string; item: string; contract_rate: string; contracted_quantity: number | null; ordered_quantity: number; received_quantity: number; average_rate: string | null; variance_value: string; utilisation_percent: number | null; above_contract_lines: number }
interface Mis { lines: MisLine[]; off_contract: any[]; expiring: any[]; totals: { variance_value: string; off_contract_extra_cost: string } }

export function ContractMisPanel() {
  const [start, setStart] = useState(monthStart())
  const [end, setEnd] = useState(today())
  const [vendor, setVendor] = useState<unknown>(null)
  const [data, setData] = useState<Mis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const qs = `start=${start}&end=${end}${vendor ? `&vendor=${vendor}` : ""}`
  useEffect(() => {
    setError(null)
    api.get<Mis>(`/inventory/rate-contracts/mis/?${qs}`).then(setData).catch((e) => setError(extractApiError(e)))
  }, [qs])
  const exportAs = async (output: "csv" | "xlsx") => {
    try {
      triggerBlobDownload(await api.getBlob(`/inventory/rate-contracts/mis/?${qs}&output=${output}`), `rate-contract-mis-${start}-to-${end}.${output}`)
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <section className={cardCls}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Rate contract MIS</h2>
          <p className="text-sm text-ink-4">Ordered against each contract vs its rate, use of the contracted quantity, and items bought off-contract above the best contract rate.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className={labelCls}>From<input type="date" className={`${inputCls} mt-1`} value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className={labelCls}>To<input type="date" className={`${inputCls} mt-1`} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <label className={`${labelCls} min-w-64`}>Vendor<div className="mt-1"><FieldInput field={vendorField(false)} value={vendor} onChange={setVendor} /></div></label>
          <button onClick={() => exportAs("xlsx")} className="px-3 py-2 text-sm font-semibold rounded-lg border border-border-strong dark:border-slate-600">Excel</button>
          <button onClick={() => exportAs("csv")} className="px-3 py-2 text-sm font-semibold rounded-lg border border-border-strong dark:border-slate-600">CSV</button>
        </div>
      </div>
      {error && <div className="text-sm text-danger-text">{error}</div>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="Contract lines" value={String(data.lines.length)} />
            <Tile label="Paid above contract" value={inr(data.totals.variance_value)} tone={Number(data.totals.variance_value) > 0 ? "warn" : undefined} />
            <Tile label="Off-contract extra cost" value={inr(data.totals.off_contract_extra_cost)} tone={Number(data.totals.off_contract_extra_cost) > 0 ? "warn" : undefined} />
            <Tile label="Contracts expiring in 30 days" value={String(data.expiring.length)} tone={data.expiring.length ? "warn" : undefined} />
          </div>
          <Table head={["Contract", "Vendor", "Item", "Contract rate", "Ordered", "Avg PO rate", "Variance", "Utilisation"]}
            rows={data.lines.map((r) => [r.contract, r.vendor, r.item, inr(r.contract_rate), `${r.ordered_quantity}${r.contracted_quantity ? ` / ${r.contracted_quantity}` : ""}`,
              inr(r.average_rate), inr(r.variance_value), r.utilisation_percent === null ? "—" : `${r.utilisation_percent}%`])} empty="No contracts in this period." />
          {data.off_contract.length > 0 && (
            <>
              <h3 className="text-sm font-bold">Off-contract purchases</h3>
              <Table head={["PO", "Date", "Vendor", "Item", "Qty", "Rate", "Best contract", "Extra cost"]}
                rows={data.off_contract.map((o) => [o.po_number, o.ordered_on, o.vendor, o.item, o.quantity, inr(o.rate), `${inr(o.best_contract_rate)} (${o.best_contract_vendor})`, inr(o.extra_cost)])} />
            </>
          )}
          {data.expiring.length > 0 && <p className="text-sm text-warning-text">Expiring: {data.expiring.map((e) => `${e.contract} (${e.vendor}) on ${e.valid_to}`).join(", ")}</p>}
        </>
      )}
    </section>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone === "warn" ? "border-warning-text/40 bg-warning-bg" : "border-border dark:border-slate-700"}`}>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-4">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  )
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty?: string }) {
  if (!rows.length) return <div className="text-sm text-ink-4">{empty ?? "Nothing to show."}</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-ink-4 text-left">{head.map((h) => <th key={h} className="py-2 pr-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border-soft dark:divide-slate-700">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="py-1.5 pr-3">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

interface PO { id: number; po_number: string; vendor_name: string; status: string; ordered_at: string; approved_at: string | null; approved_by_name: string; expected_delivery: string | null; total_value: string; po_items: { id: number; item_name: string; ordered_quantity: number; received_quantity: number; deliveries: { due_date: string; quantity: number }[] }[] }
interface Due { id: number; po_number: string; vendor: string; item: string; due_date: string; quantity: number; pending: number; overdue: boolean; days_late: number }

export function POTrackingPanel() {
  const [f, setF] = useState({ sanctioned_from: "", sanctioned_to: "", ordered_from: "", ordered_to: "", sanction: "", overdue: "" })
  const [vendor, setVendor] = useState<unknown>(null)
  const [pos, setPos] = useState<PO[]>([])
  const [due, setDue] = useState<Due[]>([])
  const [editing, setEditing] = useState<{ po: PO; line: PO["po_items"][number]; rows: { due_date: string; quantity: string }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), ...(vendor ? { vendor: String(vendor) } : {}), page_size: "100" }).toString()
  const load = () => {
    setError(null)
    api.get<any>(`/inventory/purchase-orders/?${qs}`).then((r) => setPos(r.results ?? r)).catch((e) => setError(extractApiError(e)))
    api.get<Due[]>("/inventory/purchase-orders/deliveries/?until=" + new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)).then(setDue).catch(() => setDue([]))
  }
  useEffect(load, [qs]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveSchedule = async () => {
    if (!editing) return
    try {
      await api.post(`/inventory/purchase-orders/${editing.po.id}/schedule/`, { po_item: editing.line.id, deliveries: editing.rows.filter((r) => r.due_date && r.quantity) })
      setEditing(null)
      load()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))

  return (
    <div className="space-y-6">
      <section className={cardCls}>
        <div>
          <h2 className="text-lg font-bold">Purchase orders — sanction & delivery</h2>
          <p className="text-sm text-ink-4">Sanction date = when the PO was approved. Overdue = a scheduled delivery past its date and not yet received.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className={labelCls}>Sanctioned from<input type="date" className={`${inputCls} mt-1`} value={f.sanctioned_from} onChange={(e) => set("sanctioned_from", e.target.value)} /></label>
          <label className={labelCls}>Sanctioned to<input type="date" className={`${inputCls} mt-1`} value={f.sanctioned_to} onChange={(e) => set("sanctioned_to", e.target.value)} /></label>
          <label className={labelCls}>Ordered from<input type="date" className={`${inputCls} mt-1`} value={f.ordered_from} onChange={(e) => set("ordered_from", e.target.value)} /></label>
          <label className={labelCls}>Ordered to<input type="date" className={`${inputCls} mt-1`} value={f.ordered_to} onChange={(e) => set("ordered_to", e.target.value)} /></label>
          <label className={labelCls}>Sanction
            <select className={`${inputCls} mt-1`} value={f.sanction} onChange={(e) => set("sanction", e.target.value)}>
              <option value="">Any</option><option value="pending">Awaiting sanction</option><option value="done">Sanctioned</option>
            </select>
          </label>
          <label className={`${labelCls} flex items-end gap-2 pb-2`}><input type="checkbox" checked={f.overdue === "1"} onChange={(e) => set("overdue", e.target.checked ? "1" : "")} /> Overdue deliveries only</label>
          <label className={`${labelCls} lg:col-span-2`}>Vendor<div className="mt-1"><FieldInput field={vendorField(false)} value={vendor} onChange={setVendor} /></div></label>
        </div>
        {error && <div className="text-sm text-danger-text">{error}</div>}
        <Table head={["PO", "Vendor", "Ordered", "Sanctioned", "Value", "Lines & schedule", "Status"]} empty="No purchase orders match."
          rows={pos.map((p) => [
            <span key="po" className="font-semibold">{p.po_number}</span>, p.vendor_name, p.ordered_at.slice(0, 10),
            p.approved_at ? `${p.approved_at.slice(0, 10)}${p.approved_by_name ? ` · ${p.approved_by_name}` : ""}` : <span key="sanction" className="text-warning-text">Awaiting</span>,
            inr(p.total_value),
            <div key="lines" className="space-y-0.5">{p.po_items.map((l) => (
              <div key={l.id} className="text-xs">
                {l.item_name}: {l.received_quantity}/{l.ordered_quantity}
                {l.deliveries.length ? ` · due ${l.deliveries.map((d) => `${d.quantity} by ${d.due_date}`).join(", ")}` : ""}
                {p.status !== "received" && p.status !== "cancelled" && (
                  <button className="ml-1 text-brand font-semibold" onClick={() => setEditing({ po: p, line: l, rows: l.deliveries.length ? l.deliveries.map((d) => ({ due_date: d.due_date, quantity: String(d.quantity) })) : [{ due_date: p.expected_delivery ?? "", quantity: String(l.ordered_quantity) }] })}>
                    {l.deliveries.length ? "Edit schedule" : "Schedule"}
                  </button>
                )}
              </div>
            ))}</div>,
            p.status,
          ])} />
      </section>

      <section className={cardCls}>
        <h2 className="text-lg font-bold">Deliveries due (next 14 days and overdue)</h2>
        <Table head={["Due", "PO", "Vendor", "Item", "Pending", ""]} empty="Nothing due."
          rows={due.map((d) => [d.due_date, d.po_number, d.vendor, d.item, `${d.pending} of ${d.quantity}`,
            d.overdue ? <span key="late" className="text-danger-text font-semibold">{d.days_late} day(s) late</span> : ""])} />
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold">Delivery schedule — {editing.line.item_name}</h2>
            <p className="text-sm text-ink-4">{editing.po.po_number}: {editing.line.ordered_quantity} ordered. The deliveries must add up to that.</p>
            {editing.rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input type="date" aria-label="Due date" className={inputCls} value={r.due_date} onChange={(e) => setEditing({ ...editing, rows: editing.rows.map((x, j) => (j === i ? { ...x, due_date: e.target.value } : x)) })} />
                <input type="number" min={1} aria-label="Quantity" className={`${inputCls} w-28`} value={r.quantity} onChange={(e) => setEditing({ ...editing, rows: editing.rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)) })} />
                <button className="text-ink-4" aria-label="Remove delivery" onClick={() => setEditing({ ...editing, rows: editing.rows.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button className="text-sm font-semibold text-brand" onClick={() => setEditing({ ...editing, rows: [...editing.rows, { due_date: "", quantity: "" }] })}>+ Add delivery</button>
            <div className="text-sm text-ink-3">Total {editing.rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)} of {editing.line.ordered_quantity}</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-ink-4">Cancel</button>
              <button onClick={saveSchedule} className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white">Save schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface CartLine { item: number; quantity: number; unit_cost?: string; rate_override_reason?: string }
interface Cart { kind: "indent" | "po"; header: Record<string, any>; lines: CartLine[]; saved_at: string }

/** The indent / PO cart: saved to the server as you go, so it's still there after logging out or on another device. */
export function CartPanel() {
  const [kind, setKind] = useState<"indent" | "po">("indent")
  const [cart, setCart] = useState<Cart | null>(null)
  const [items, setItems] = useState<Record<number, string>>({})
  const [pick, setPick] = useState<unknown>(null)
  const [state, setState] = useState<"saved" | "saving" | "error" | "">("")
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCart(null)
    setNotice(null)
    api.get<Cart>(`/inventory/cart/${kind}/`).then(setCart).catch((e) => setError(extractApiError(e)))
  }, [kind])
  useEffect(() => {
    api.get<any>("/inventory/items/?page_size=500").then((r) => setItems(Object.fromEntries((r.results ?? r).map((i: any) => [i.id, `${i.name} [${i.code}]`])))).catch(() => undefined)
  }, [])

  const update = (next: Cart) => {
    setCart(next)
    setState("saving")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      api.put<Cart>(`/inventory/cart/${next.kind}/`, { header: next.header, lines: next.lines })
        .then(() => setState("saved"))
        .catch((e) => { setState("error"); setError(extractApiError(e)) })
    }, 600)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const submit = async () => {
    if (!cart) return
    setError(null)
    try {
      if (timer.current) {
        clearTimeout(timer.current)
        await api.put(`/inventory/cart/${kind}/`, { header: cart.header, lines: cart.lines })
      }
      const r = await api.post<{ number: string }>(`/inventory/cart/${kind}/submit/`, {})
      setNotice(`${kind === "indent" ? "Indent" : "Draft PO"} ${r.number} raised.`)
      setCart(await api.get<Cart>(`/inventory/cart/${kind}/`))
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  const addLine = () => {
    if (!cart || !pick) return
    const id = Number(pick)
    const existing = cart.lines.find((l) => l.item === id)
    update({ ...cart, lines: existing ? cart.lines.map((l) => (l.item === id ? { ...l, quantity: l.quantity + 1 } : l)) : [...cart.lines, { item: id, quantity: 1 }] })
    setPick(null)
  }
  const setLine = (i: number, patch: Partial<CartLine>) => cart && update({ ...cart, lines: cart.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) })
  const setHeader = (k: string, v: unknown) => cart && update({ ...cart, header: { ...cart.header, [k]: v } })

  return (
    <section className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Cart</h2>
          <p className="text-sm text-ink-4">Build an indent or a PO over time — it's saved as you go and kept between sessions until you raise it.</p>
        </div>
        <div className="flex rounded-lg border border-border-strong dark:border-slate-600 overflow-hidden text-sm font-semibold" role="tablist">
          {(["indent", "po"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`px-4 py-1.5 ${kind === k ? "bg-brand text-white" : ""}`}>{k === "indent" ? "Store indent" : "Purchase order"}</button>
          ))}
        </div>
      </div>
      {cart && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kind === "indent" ? (
              <>
                <label className={labelCls}>Department<input className={`${inputCls} mt-1`} value={cart.header.department ?? ""} onChange={(e) => setHeader("department", e.target.value)} /></label>
                <label className={labelCls}>From store<div className="mt-1"><FieldInput field={{ key: "from_store", label: "Store", type: "fk", source: "/inventory/stores/" }} value={cart.header.from_store} onChange={(v) => setHeader("from_store", v)} /></div></label>
              </>
            ) : (
              <>
                <label className={labelCls}>Vendor<div className="mt-1"><FieldInput field={vendorField()} value={cart.header.vendor} onChange={(v) => setHeader("vendor", v)} /></div></label>
                <label className={labelCls}>PO number (blank = next number)<input className={`${inputCls} mt-1`} value={cart.header.po_number ?? ""} onChange={(e) => setHeader("po_number", e.target.value)} /></label>
                <label className={labelCls}>Expected delivery<input type="date" className={`${inputCls} mt-1`} value={cart.header.expected_delivery ?? ""} onChange={(e) => setHeader("expected_delivery", e.target.value)} /></label>
              </>
            )}
          </div>
          <div className="flex gap-2 items-end">
            <label className={`${labelCls} flex-1`}>Add item<div className="mt-1"><FieldInput field={itemField} value={pick} onChange={setPick} /></div></label>
            <button onClick={addLine} disabled={!pick} className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-tint text-brand-dark disabled:opacity-50">Add</button>
          </div>
          {cart.lines.length === 0 ? (
            <div className="text-sm text-ink-4">The cart is empty.</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-ink-4 text-left"><th className="py-1 font-semibold">Item</th><th className="py-1 font-semibold w-28">Quantity</th>{kind === "po" && <th className="py-1 font-semibold w-40">Unit cost (blank = contract)</th>}{kind === "po" && <th className="py-1 font-semibold">Reason if above contract</th>}<th /></tr></thead>
              <tbody className="divide-y divide-border-soft dark:divide-slate-700">
                {cart.lines.map((l, i) => (
                  <tr key={`${l.item}-${i}`}>
                    <td className="py-1.5 pr-2">{items[l.item] ?? `Item #${l.item}`}</td>
                    <td className="py-1.5 pr-2"><input type="number" min={0} aria-label="Quantity" className={inputCls} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} /></td>
                    {kind === "po" && <td className="py-1.5 pr-2"><input type="number" step="0.01" aria-label="Unit cost" className={inputCls} value={l.unit_cost ?? ""} onChange={(e) => setLine(i, { unit_cost: e.target.value })} /></td>}
                    {kind === "po" && <td className="py-1.5 pr-2"><input aria-label="Reason if above contract" className={inputCls} value={l.rate_override_reason ?? ""} onChange={(e) => setLine(i, { rate_override_reason: e.target.value })} /></td>}
                    <td className="py-1.5 w-8"><button aria-label="Remove line" className="text-ink-4 hover:text-danger-text" onClick={() => update({ ...cart, lines: cart.lines.filter((_, j) => j !== i) })}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={!cart.lines.length} className="px-4 py-2 text-sm font-semibold rounded-lg bg-success text-white disabled:opacity-50">{kind === "indent" ? "Raise indent" : "Create draft PO"}</button>
            <span className="text-xs text-ink-4">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Not saved" : cart.saved_at ? `Last saved ${new Date(cart.saved_at).toLocaleString()}` : ""}</span>
            {notice && <span className="text-sm text-success-text">{notice}</span>}
            {error && <span className="text-sm text-danger-text">{error}</span>}
          </div>
        </>
      )}
    </section>
  )
}
