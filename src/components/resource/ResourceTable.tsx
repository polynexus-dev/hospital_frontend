import React, { useCallback, useEffect, useMemo, useState } from "react"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"

// Config-driven register screen used by the NABH modules: list + search +
// filters + create form + per-row workflow actions, all against one DRF
// endpoint. Domain rules stay on the backend; this only renders them.

export type FieldType = "text" | "textarea" | "number" | "date" | "datetime" | "select" | "boolean" | "json" | "fk" | "multifk"

export interface FieldDef {
  key: string
  label: string
  type?: FieldType
  options?: { value: string; label: string }[] | string[]
  required?: boolean
  placeholder?: string
  /** fk / multifk: endpoint to load choices from, and which attribute to show */
  source?: string
  sourceLabel?: string | ((row: Record<string, unknown>) => string)
  help?: string
  defaultValue?: unknown
}

export interface ColumnDef {
  key: string
  label: string
  render?: (row: Row) => React.ReactNode
}

export interface ActionDef {
  label: string
  /** detail action path appended to `${endpoint}${id}/`, e.g. "approve/" */
  path: string
  method?: "post" | "get" | "delete" | "patch"
  /** prompt the user for these values and send them as the body */
  prompt?: FieldDef[]
  confirm?: string
  show?: (row: Row) => boolean
  tone?: "primary" | "danger" | "neutral"
  /** GET action that returns a file (PDF/CSV) */
  download?: string
  /** open the URL found at this key of the response in a new tab (e.g. video room) */
  openUrlFrom?: string
  /** absolute API path for this row, when the action lives on another endpoint */
  url?: (row: Row) => string
}

export type Row = Record<string, any>

export interface ResourceConfig {
  title: string
  description?: string
  endpoint: string
  columns: ColumnDef[]
  fields?: FieldDef[]
  actions?: ActionDef[]
  filters?: FieldDef[]
  searchable?: boolean
  createLabel?: string
  /** extra toolbar buttons that hit collection-level endpoints */
  toolbar?: { label: string; path: string; method?: "post" | "get"; prompt?: FieldDef[]; download?: string }[]
  emptyText?: string
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"

export function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString()
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export function StatusPill({ value }: { value: unknown }) {
  const v = String(value ?? "")
  const tone = /critical|reject|fail|overdue|mismatch|breakdown|expired|recalled|cancel|death|severe|high|block|sentinel|wrong/i.test(v)
    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
    : /pending|wait|draft|open|warning|moderate|partial|progress|scheduled|requested|suspected|medium/i.test(v)
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      : /done|pass|paid|approved|complete|verified|active|granted|given|delivered|cleared|matched|eligible|success|normal|low|closed|available|in_use/i.test(v)
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  return <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${tone}`}>{v.replace(/_/g, " ") || "—"}</span>
}

function optionList(f: FieldDef) {
  return (f.options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o.replace(/_/g, " ") } : o))
}

function FkSelect({ field, value, onChange, multi }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; multi?: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState("")
  useEffect(() => {
    if (!field.source) return
    const sep = field.source.includes("?") ? "&" : "?"
    api
      .get<any>(`${field.source}${sep}page_size=100${q ? `&search=${encodeURIComponent(q)}` : ""}`)
      .then((r) => setRows(Array.isArray(r) ? r : r?.results ?? []))
      .catch(() => setRows([]))
  }, [field.source, q])
  const label = (r: Row) =>
    typeof field.sourceLabel === "function" ? field.sourceLabel(r) : String(r[field.sourceLabel ?? "name"] ?? r.full_name ?? r.title ?? r.id)
  if (multi) {
    const selected = new Set(((value as unknown[]) ?? []).map(String))
    return (
      <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 max-h-40 overflow-auto space-y-1">
        {rows.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(String(r.id))}
              onChange={(e) => {
                const next = new Set(selected)
                if (e.target.checked) next.add(String(r.id))
                else next.delete(String(r.id))
                onChange([...next].map((x) => (isNaN(Number(x)) ? x : Number(x))))
              }}
            />
            {label(r)}
          </label>
        ))}
      </div>
    )
  }
  return (
    <div className="flex gap-2">
      <input className={`${inputCls} max-w-[40%]`} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select className={inputCls} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)} required={field.required}>
        <option value="">— select —</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {label(r)}
          </option>
        ))}
      </select>
    </div>
  )
}

export function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const t = field.type ?? "text"
  if (t === "textarea") return <textarea className={inputCls} rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={field.required} placeholder={field.placeholder} />
  if (t === "boolean")
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /> {field.placeholder ?? "Yes"}
      </label>
    )
  if (t === "select")
    return (
      <select className={inputCls} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={field.required}>
        <option value="">— select —</option>
        {optionList(field).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  if (t === "fk" || t === "multifk") return <FkSelect field={field} value={value} onChange={onChange} multi={t === "multifk"} />
  if (t === "json")
    return (
      <textarea
        className={`${inputCls} font-mono text-xs`}
        rows={4}
        defaultValue={value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        onChange={(e) => {
          try {
            onChange(e.target.value.trim() ? JSON.parse(e.target.value) : undefined)
          } catch {
            onChange(e.target.value)
          }
        }}
        placeholder={field.placeholder ?? "JSON"}
      />
    )
  const htmlType = t === "datetime" ? "datetime-local" : t
  return <input type={htmlType} className={inputCls} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} required={field.required} placeholder={field.placeholder} step={t === "number" ? "any" : undefined} />
}

function toPayload(fields: FieldDef[], values: Row) {
  const body: Row = {}
  for (const f of fields) {
    let v = values[f.key]
    if (v === undefined || v === "") continue
    if (f.type === "datetime" && typeof v === "string") v = new Date(v).toISOString()
    body[f.key] = v
  }
  return body
}

export function FormModal({
  title,
  fields,
  initial,
  onClose,
  onSubmit,
  submitLabel = "Save",
}: {
  title: string
  fields: FieldDef[]
  initial?: Row
  onClose: () => void
  onSubmit: (body: Row) => Promise<void>
  submitLabel?: string
}) {
  const [values, setValues] = useState<Row>(() => {
    const v: Row = { ...(initial ?? {}) }
    fields.forEach((f) => {
      if (v[f.key] === undefined && f.defaultValue !== undefined) v[f.key] = f.defaultValue
    })
    return v
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(toPayload(fields, values))
    } catch (err) {
      setError(extractApiError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" || f.type === "json" || f.type === "multifk" ? "sm:col-span-2" : ""}>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {f.label}
                {f.required && <span className="text-rose-600"> *</span>}
              </label>
              <FieldInput field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
              {f.help && <p className="text-[11px] text-slate-500 mt-1">{f.help}</p>}
            </div>
          ))}
        </div>
        {error && <div className="text-sm text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 rounded-lg p-3 whitespace-pre-wrap">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            Cancel
          </button>
          <button disabled={busy} className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60">
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

export function ResourceTable({ config }: { config: ResourceConfig }) {
  const [rows, setRows] = useState<Row[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<Row>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [prompting, setPrompting] = useState<{ action: ActionDef; row?: Row; collection?: boolean } | null>(null)
  const [detail, setDetail] = useState<Row | null>(null)

  const query = useMemo(() => {
    const p = new URLSearchParams()
    p.set("page", String(page))
    if (search) p.set("search", search)
    Object.entries(filters).forEach(([k, v]) => v !== "" && v !== undefined && v !== null && p.set(k, String(v)))
    return p.toString()
  }, [page, search, filters])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sep = config.endpoint.includes("?") ? "&" : "?"
      const res = await api.get<any>(`${config.endpoint}${sep}${query}`)
      const list = Array.isArray(res) ? res : res?.results ?? []
      setRows(list)
      setCount(Array.isArray(res) ? list.length : res?.count ?? list.length)
    } catch (err) {
      setError(extractApiError(err))
    } finally {
      setLoading(false)
    }
  }, [config.endpoint, query])

  useEffect(() => {
    load()
  }, [load])

  const base = config.endpoint.split("?")[0]

  const runAction = async (action: ActionDef, row: Row | undefined, body?: Row, collection?: boolean) => {
    const url = action.url && row ? action.url(row) : collection ? `${base}${action.path}` : `${base}${row!.id}/${action.path}`
    try {
      if (action.download) {
        const blob = await api.getBlob(url)
        triggerBlobDownload(blob, action.download)
        return
      }
      const res =
        action.method === "get"
          ? await api.get<any>(url)
          : action.method === "delete"
            ? await api.delete<any>(url)
            : action.method === "patch"
              ? await api.patch<any>(url, body ?? {})
              : await api.post<any>(url, body ?? {})
      setNotice(`${action.label}: done`)
      if (action.openUrlFrom && res?.[action.openUrlFrom]) window.open(res[action.openUrlFrom], "_blank", "noopener")
      else if (action.method === "get") setDetail(res)
      load()
    } catch (err) {
      const msg = extractApiError(err)
      throw new Error(msg)
    }
  }

  const trigger = (action: ActionDef, row?: Row, collection?: boolean) => {
    setNotice(null)
    if (action.confirm && !window.confirm(action.confirm)) return
    if (action.prompt?.length) {
      setPrompting({ action, row, collection })
      return
    }
    runAction(action, row, undefined, collection).catch((e) => setError(e.message))
  }

  const pages = Math.max(1, Math.ceil(count / 25))

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{config.title}</h2>
          {config.description && <p className="text-sm text-slate-500 dark:text-slate-400 max-w-3xl">{config.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {config.searchable !== false && (
            <input className={`${inputCls} w-48`} placeholder="Search…" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value) }} />
          )}
          {config.filters?.map((f) => (
            <div key={f.key} className="w-44">
              <FieldInput field={f} value={filters[f.key]} onChange={(v) => { setPage(1); setFilters((s) => ({ ...s, [f.key]: v })) }} />
            </div>
          ))}
          {config.toolbar?.map((tb) => (
            <button
              key={tb.label}
              onClick={() => trigger({ label: tb.label, path: tb.path, method: tb.method, prompt: tb.prompt, download: tb.download }, undefined, true)}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
            >
              {tb.label}
            </button>
          ))}
          {config.fields && (
            <button onClick={() => setCreating(true)} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm">
              + {config.createLabel ?? "New"}
            </button>
          )}
        </div>
      </div>

      {notice && <div className="text-sm text-emerald-800 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg px-3 py-2">{notice}</div>}
      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 rounded-lg px-3 py-2 flex justify-between">
          <span className="whitespace-pre-wrap">{error}</span>
          <button onClick={() => setError(null)} className="font-bold">×</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
              {config.columns.map((c) => (
                <th key={c.key} className="px-4 py-3 whitespace-nowrap">{c.label}</th>
              ))}
              {config.actions?.length ? <th className="px-4 py-3 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr><td colSpan={99} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={99} className="px-4 py-8 text-center text-slate-500">{config.emptyText ?? "No records yet."}</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id ?? JSON.stringify(row)} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 align-top">
                  {config.columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-slate-700 dark:text-slate-200 max-w-xs break-words">
                      {c.render ? c.render(row) : /status|severity|risk|result|stage|flag|match|harm/.test(c.key) ? <StatusPill value={row[c.key]} /> : fmt(row[c.key])}
                    </td>
                  ))}
                  {config.actions?.length ? (
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      {config.actions.filter((a) => !a.show || a.show(row)).map((a) => (
                        <button
                          key={a.label}
                          onClick={() => trigger(a, row)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                            a.tone === "danger"
                              ? "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300"
                              : a.tone === "primary"
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 disabled:opacity-40">‹</button>
          <span className="text-slate-500">Page {page} / {pages} · {count} records</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 disabled:opacity-40">›</button>
        </div>
      )}

      {creating && config.fields && (
        <FormModal
          title={config.createLabel ?? `New ${config.title}`}
          fields={config.fields}
          onClose={() => setCreating(false)}
          onSubmit={async (body) => {
            await api.post(base, body)
            setCreating(false)
            setNotice("Saved.")
            load()
          }}
        />
      )}
      {prompting && (
        <FormModal
          title={prompting.action.label}
          fields={prompting.action.prompt!}
          submitLabel={prompting.action.label}
          onClose={() => setPrompting(null)}
          onSubmit={async (body) => {
            await runAction(prompting.action, prompting.row, body, prompting.collection)
            setPrompting(null)
          }}
        />
      )}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-3xl max-h-[85vh] overflow-auto bg-white dark:bg-slate-800 rounded-xl p-6" onClick={(e) => e.stopPropagation()}>
            <pre className="text-xs whitespace-pre-wrap text-slate-700 dark:text-slate-200">{JSON.stringify(detail, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
