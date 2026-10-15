import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { DrawerSection } from "../ui/Drawer"
import { StatusPill, dateTime, humanize, isMoneyKey, isStatusKey, money } from "./format"

// Renders any API record readably: plain fields as a label/value grid,
// nested objects as their own section, lists of objects as small tables.
// Used by RecordDrawer for every list screen without a dedicated panel.

type Row = Record<string, unknown>

// internal/tenant fields that only add noise to a record view
const ALWAYS_HIDE = /^(hospital|hospital_.+|password|.*_hash|.*_encrypted|blind_index|search_vector|permissions|.*_permissions|enabled_modules)$/

// short code-like values of choice fields ("permanent", "bank_transfer") read better humanized
const CHOICE_KEY = /(type|category|method|mode|gender|kind|channel|source|relation|relationship|language|frequency|domain|preference|settlement|payer|plan)$/

export interface RecordDetailsOptions {
  /** custom labels by key */
  labels?: Record<string, string>
  /** keys not to show */
  hide?: string[]
  /** custom renderers by key */
  render?: Record<string, (value: unknown, record: Row) => ReactNode>
}

const isPlainObject = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v)

function personName(o: Row): string | null {
  if (typeof o.full_name === "string" && o.full_name) return o.full_name
  const n = [o.title, o.first_name, o.last_name].filter(Boolean).join(" ")
  return n || (typeof o.name === "string" ? o.name : null)
}

/** Format one value for display, based on its key and type. */
export function displayValue(key: string, v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-ink-5">—</span>
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (Array.isArray(v)) {
    if (!v.length) return <span className="text-ink-5">—</span>
    return v.map((x) => (isPlainObject(x) ? personName(x) ?? JSON.stringify(x) : String(x))).join(", ")
  }
  if (isPlainObject(v)) return personName(v) ?? JSON.stringify(v)
  if (key === "patient" && typeof v === "number") {
    return (
      <Link to={`/patients/${v}`} className="text-brand font-semibold hover:underline">
        Open patient #{v} →
      </Link>
    )
  }
  if (isStatusKey(key) && typeof v === "string") return <StatusPill value={v} />
  if (isMoneyKey(key) && !Number.isNaN(Number(v))) return <span className="tabular-nums">{money(v)}</span>
  if (typeof v === "string") {
    if (CHOICE_KEY.test(key) && /^[a-z]+(_[a-z]+)*$/.test(v)) return v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ")
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(v)) return dateTime(v)
    if (/^https?:\/\//.test(v)) {
      return (
        <a href={v} target="_blank" rel="noopener noreferrer" className="text-brand underline break-all">
          {v}
        </a>
      )
    }
    if (key.endsWith("_color") || key === "color") return v
  }
  return String(v)
}

/** Keys that only duplicate a friendlier sibling (patient → patient_name / patient_detail). */
function shadowed(key: string, rec: Row): boolean {
  return [`${key}_name`, `${key}_detail`, `${key}_display`, `${key}_label`, `get_${key}_display`].some((k) => rec[k] !== undefined && rec[k] !== null && rec[k] !== "")
}

function FieldGrid({ entries, options, record }: { entries: [string, unknown][]; options: RecordDetailsOptions; record: Row }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {entries.map(([k, v]) => {
        const long = typeof v === "string" && v.length > 80
        return (
          <div key={k} className={long ? "sm:col-span-2" : ""}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-4 dark:text-slate-400">{options.labels?.[k] ?? humanize(k)}</dt>
            <dd className={`text-sm text-ink dark:text-slate-100 break-words ${long ? "whitespace-pre-wrap" : ""}`}>
              {options.render?.[k] ? options.render[k](v, record) : displayValue(k, v)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function ObjectTable({ rows }: { rows: Row[] }) {
  const cols: string[] = []
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      if (cols.includes(k) || ALWAYS_HIDE.test(k) || isPlainObject(v) || Array.isArray(v)) continue
      if (k === "id" || shadowed(k, r)) continue
      cols.push(k)
    }
  }
  const shown = cols.slice(0, 8)
  return (
    <div className="overflow-x-auto border border-border dark:border-slate-700 rounded-card">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="bg-page dark:bg-slate-800 text-[11px] uppercase text-ink-4">
            {shown.map((c) => (
              <th key={c} className="px-3 py-2 whitespace-nowrap font-semibold">{humanize(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-slate-700">
          {rows.map((r, i) => (
            <tr key={String(r.id ?? i)}>
              {shown.map((c) => (
                <td key={c} className="px-3 py-2 align-top text-ink-2 dark:text-slate-200">{displayValue(c, r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RecordDetails({ record, options = {} }: { record: Row; options?: RecordDetailsOptions }) {
  const hide = new Set(options.hide ?? [])
  const scalars: [string, unknown][] = []
  const objects: [string, Row][] = []
  const lists: [string, Row[]][] = []

  for (const [k, v] of Object.entries(record)) {
    if (hide.has(k) || ALWAYS_HIDE.test(k)) continue
    if (isPlainObject(v)) {
      if (Object.keys(v).length) objects.push([k, v])
      continue
    }
    if (Array.isArray(v) && v.length && v.every(isPlainObject)) {
      lists.push([k, v as Row[]])
      continue
    }
    if (shadowed(k, record) && !options.render?.[k]) continue
    scalars.push([k, v])
  }
  // fields with a value first, empty ones after
  scalars.sort((a, b) => Number(a[1] === null || a[1] === "" || a[1] === undefined) - Number(b[1] === null || b[1] === "" || b[1] === undefined))

  return (
    <div className="space-y-5">
      <FieldGrid entries={scalars} options={options} record={record} />
      {objects.map(([k, o]) => {
        const isPatient = k.startsWith("patient") && typeof o.id === "number"
        return (
          <DrawerSection
            key={k}
            title={options.labels?.[k] ?? humanize(k)}
            aside={isPatient ? <Link to={`/patients/${o.id}`} className="text-xs font-semibold text-brand hover:underline">Open patient profile →</Link> : undefined}
          >
            <div className="rounded-card border border-border dark:border-slate-700 p-3">
              <FieldGrid
                entries={Object.entries(o).filter(([kk, vv]) => !ALWAYS_HIDE.test(kk) && !isPlainObject(vv) && !(Array.isArray(vv) && vv.some(isPlainObject)) && !shadowed(kk, o))}
                options={{}}
                record={o}
              />
            </div>
          </DrawerSection>
        )
      })}
      {lists.map(([k, rows]) => (
        <DrawerSection key={k} title={`${options.labels?.[k] ?? humanize(k)} (${rows.length})`}>
          <ObjectTable rows={rows} />
        </DrawerSection>
      ))}
    </div>
  )
}
