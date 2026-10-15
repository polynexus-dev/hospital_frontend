import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { ResourceTable } from "../../components/resource/ResourceTable"
import { col } from "../nabh/fields"
import { cardCls, inputCls, inr } from "./ui"

// OT tariff templates (MedNet M2.22): surgery grade x room category, split
// into surgeon / anaesthetist / OT / assistant. The room-category row wins;
// "Any room" is the grade's fallback and prices day-care / OPD surgery.

interface Grade { id: number; code: string; name: string; is_active: boolean }
interface Tariff { id?: number; grade: number; room_category: string; surgeon_fee: string; anaesthetist_fee: string; ot_charge: string; assistant_fee: string; is_active: boolean }

const ROOMS: [string, string][] = [["", "Any room / day care"], ["general", "General"], ["semi_private", "Semi-private"], ["private", "Private"], ["icu", "ICU"], ["ventilator", "Ventilator"]]
const PARTS: [keyof Tariff, string][] = [["surgeon_fee", "Surgeon"], ["anaesthetist_fee", "Anaesthetist"], ["ot_charge", "OT charge"], ["assistant_fee", "Assistant"]]
const blank = (grade: number, room: string): Tariff => ({ grade, room_category: room, surgeon_fee: "", anaesthetist_fee: "", ot_charge: "", assistant_fee: "", is_active: true })
const total = (t: Tariff) => PARTS.reduce((s, [k]) => s + (Number(t[k]) || 0), 0)

function TariffGrid() {
  const [grades, setGrades] = useState<Grade[]>([])
  const [grade, setGrade] = useState<number | null>(null)
  const [rows, setRows] = useState<Record<string, Tariff>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadGrades = () => api.get<any>("/finance/surgery-grades/?page_size=200").then((r) => {
    const list: Grade[] = r.results ?? r
    setGrades(list)
    setGrade((g) => g ?? list[0]?.id ?? null)
  }).catch((e) => setError(extractApiError(e)))
  useEffect(() => { loadGrades() }, [])

  const load = (g: number) => api.get<any>(`/finance/ot-tariffs/?grade=${g}&page_size=50`).then((r) => {
    const map: Record<string, Tariff> = {}
    for (const t of (r.results ?? r) as Tariff[]) map[t.room_category] = t
    setRows(map)
    setDirty(new Set())
  }).catch((e) => setError(extractApiError(e)))
  useEffect(() => { if (grade) load(grade) }, [grade])

  const edit = (room: string, key: keyof Tariff, value: string) => {
    setRows((r) => ({ ...r, [room]: { ...(r[room] ?? blank(grade!, room)), [key]: value } }))
    setDirty((d) => new Set(d).add(room))
  }

  const save = async () => {
    setError(null)
    setNotice(null)
    try {
      for (const room of dirty) {
        const t = rows[room]
        const empty = PARTS.every(([k]) => t[k] === "" || t[k] === null)
        const body = { ...t, ...Object.fromEntries(PARTS.map(([k]) => [k, t[k] === "" ? "0" : t[k]])) }
        if (t.id && empty) await api.delete(`/finance/ot-tariffs/${t.id}/`)
        else if (t.id) await api.patch(`/finance/ot-tariffs/${t.id}/`, body)
        else if (!empty) await api.post("/finance/ot-tariffs/", body)
      }
      setNotice("Saved. New surgeries are priced from these rates; already-posted charges change only when re-posted.")
      if (grade) load(grade)
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  if (grades.length === 0) {
    return <section className={cardCls}><h2 className="text-lg font-bold">OT tariff</h2><p className="text-sm text-ink-4">Add surgery grades below first, then set their rates here.</p><button onClick={loadGrades} className="text-sm font-semibold text-brand">Reload grades</button>{error && <div className="text-sm text-danger-text">{error}</div>}</section>
  }
  return (
    <section className={cardCls}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">OT tariff</h2>
          <p className="text-sm text-ink-4">Rates per room category for the grade. The patient's room at the time of surgery decides the row; with no row for it (or no bed), "Any room" applies. Clear a row to remove it.</p>
        </div>
        <label className="text-xs font-semibold text-ink-3">Surgery grade
          <select className={`${inputCls} mt-1 min-w-48`} value={grade ?? ""} onFocus={loadGrades} onChange={(e) => setGrade(Number(e.target.value))}>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.code}){g.is_active ? "" : " — inactive"}</option>)}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-4 text-left">
              <th className="py-2 pr-3 font-semibold">Room category</th>
              {PARTS.map(([k, label]) => <th key={k} className="py-2 px-1 font-semibold">{label} (₹)</th>)}
              <th className="py-2 pl-3 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft dark:divide-slate-700">
            {ROOMS.map(([room, label]) => {
              const t = rows[room] ?? blank(grade!, room)
              return (
                <tr key={room}>
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{label}{dirty.has(room) ? <span className="text-warning-text"> •</span> : null}</td>
                  {PARTS.map(([k, partLabel]) => (
                    <td key={k} className="py-1.5 px-1 min-w-28">
                      <input type="number" min={0} step="0.01" aria-label={`${label} ${partLabel}`} className={inputCls} value={String(t[k] ?? "")} onChange={(e) => edit(room, k, e.target.value)} />
                    </td>
                  ))}
                  <td className="py-1.5 pl-3 text-right font-semibold whitespace-nowrap">{t.id || dirty.has(room) ? inr(total(t)) : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={dirty.size === 0} className="px-4 py-2 text-sm font-semibold rounded-lg bg-success text-white disabled:opacity-50">Save rates</button>
        {notice && <span className="text-sm text-success-text">{notice}</span>}
        {error && <span className="text-sm text-danger-text">{error}</span>}
      </div>
    </section>
  )
}

export function OTTariffPanel() {
  return (
    <div className="space-y-6">
      <TariffGrid />
      <ResourceTable config={{
          title: "Surgery grades",
          description: "Grade master (e.g. Minor, Intermediate, Major, Super-major). The grade on a surgery request picks its OT tariff.",
          endpoint: "/finance/surgery-grades/", createLabel: "Add grade",
          columns: [col("code", "Code"), col("name", "Grade"), col("description", "Description"), col("sort_order", "Order"), col("is_active", "Active")],
          fields: [
            { key: "code", label: "Code", required: true, placeholder: "MAJ" },
            { key: "name", label: "Name", required: true, placeholder: "Major" },
            { key: "description", label: "Description" },
            { key: "sort_order", label: "Display order", type: "number", defaultValue: 0 },
            { key: "is_active", label: "Active", type: "boolean", defaultValue: true },
          ],
        }} />
    </div>
  )
}
