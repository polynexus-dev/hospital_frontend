import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { ErrorState, LoadingState } from "../../components/ui/QueryStates"
import { ApiError } from "../../api/client"
import type { PermissionCatalogModel, PermissionMatrix } from "../../types/api"

const VERBS = [
  { key: "add", label: "Create" },
  { key: "view", label: "View" },
  { key: "change", label: "Edit" },
  { key: "delete", label: "Delete" },
] as const

function modelCodes(m: PermissionCatalogModel) {
  return [...Object.values(m.perms), ...m.other.map((o) => o.code)].filter(Boolean) as string[]
}

function errorText(err: unknown) {
  if (err instanceof ApiError && err.body && typeof err.body === "object") {
    const body = err.body as { detail?: string; permissions?: string[] }
    return body.detail || body.permissions?.join(" · ") || "Could not save permissions."
  }
  return "Could not save permissions."
}

interface PermissionMatrixModalProps {
  title: string
  subtitle: string
  queryKey: unknown[]
  load: () => Promise<PermissionMatrix>
  /** `null` = lift the restriction (ceiling mode only). */
  save: (codes: string[] | null) => Promise<PermissionMatrix>
  /** "ceiling": SaaS admin limiting a hospital — every box is editable and
   *  the whole matrix can be switched off ("no restriction"). */
  mode?: "grant" | "ceiling"
  onClose: () => void
  onSaved?: () => void
}

/** Module → feature → Create/View/Edit/Delete/Other permission editor, used
 *  for roles, individual users, and (SaaS console) a hospital's ceiling. */
export function PermissionMatrixModal({ title, subtitle, queryKey, load, save, mode = "grant", onClose, onSaved }: PermissionMatrixModalProps) {
  const queryClient = useQueryClient()
  const matrix = useQuery({ queryKey, queryFn: load })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [restricted, setRestricted] = useState(true)
  const [activeApp, setActiveApp] = useState<string>("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!matrix.data) return
    setSelected(new Set(matrix.data.selected))
    setRestricted(mode !== "ceiling" || Boolean(matrix.data.restricted))
    setActiveApp((a) => a || matrix.data.catalog[0]?.app || "")
  }, [matrix.data, mode])

  const data = matrix.data
  const inherited = useMemo(() => new Set(data?.inherited ?? []), [data])
  const editable = useMemo(() => {
    if (!data || data.locked_reason || !restricted) return new Set<string>()
    if (mode === "ceiling") return new Set(data.catalog.flatMap((a) => a.models.flatMap(modelCodes)))
    return new Set(data.grantable ?? [])
  }, [data, mode, restricted])

  const term = search.trim().toLowerCase()
  const apps = useMemo(() => {
    if (!data) return []
    if (!term) return data.catalog
    return data.catalog
      .map((a) => (a.label.toLowerCase().includes(term) ? a : { ...a, models: a.models.filter((m) => m.label.toLowerCase().includes(term)) }))
      .filter((a) => a.models.length > 0)
  }, [data, term])
  const current = apps.find((a) => a.app === activeApp) ?? apps[0]

  const saveMutation = useMutation({
    mutationFn: () => save(mode === "ceiling" && !restricted ? null : Array.from(selected).sort()),
    onSuccess: (fresh) => {
      queryClient.setQueryData(queryKey, fresh)
      onSaved?.()
      onClose()
    },
  })

  const isOn = (code: string) => (mode === "ceiling" && !restricted) || selected.has(code) || inherited.has(code)
  const setCodes = (codes: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const c of codes) if (editable.has(c)) (on ? next.add(c) : next.delete(c))
      return next
    })
  const toggle = (code: string) => setCodes([code], !selected.has(code))
  const appCount = (models: PermissionCatalogModel[]) => models.flatMap(modelCodes).filter(isOn).length

  const readOnly = editable.size === 0
  const currentCodes = current ? current.models.flatMap(modelCodes) : []
  const viewCodes = current ? current.models.map((m) => m.perms.view).filter(Boolean) as string[] : []

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-matrix-title"
        className="bg-surface text-ink rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-6 pt-5 pb-3">
          <div>
            <h2 id="perm-matrix-title" className="text-lg font-bold">{title}</h2>
            <p className="text-sm text-ink-3 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-4 hover:text-ink text-lg p-1">✕</button>
        </div>

        {matrix.isLoading ? (
          <div className="flex-1"><LoadingState /></div>
        ) : matrix.isError || !data ? (
          <div className="flex-1"><ErrorState message="Couldn't load permissions." /></div>
        ) : (
          <>
            <div className="px-6 space-y-2">
              {data.locked_reason && (
                <div className="p-2.5 rounded-lg bg-brand-tint/50 text-brand text-xs font-semibold">{data.locked_reason}</div>
              )}
              {mode === "ceiling" && (
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} className="h-4 w-4 rounded text-brand" />
                  Limit this hospital to the permissions ticked below
                  <span className="text-xs font-normal text-ink-4">
                    {restricted ? "— its admin can't use or grant anything unticked" : "— no limit: everything in its enabled modules, including future features"}
                  </span>
                </label>
              )}
              {mode === "grant" && !data.locked_reason && (
                <p className="text-xs text-ink-4">Greyed-out boxes are outside what you can grant{inherited.size > 0 ? " or come from the user's role" : ""}.</p>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search module or feature…"
                  className="flex-1 rounded-lg border border-border bg-page px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
                <span className="text-xs text-ink-4 whitespace-nowrap">
                  <span className="font-bold text-brand">{mode === "ceiling" && !restricted ? "All" : selected.size}</span> selected
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 mx-6 my-3 flex border border-border rounded-xl overflow-hidden">
              <nav className="w-56 shrink-0 border-r border-border overflow-y-auto" aria-label="Modules">
                {apps.map((a) => (
                  <button
                    key={a.app}
                    onClick={() => setActiveApp(a.app)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm border-b border-border-soft ${
                      current?.app === a.app ? "bg-brand-tint/40 text-brand font-semibold" : "hover:bg-page"
                    }`}
                  >
                    <span className="truncate">{a.label}</span>
                    <span className={`text-[11px] font-bold min-w-6 text-center px-1.5 py-0.5 rounded-full ${appCount(a.models) ? "bg-brand text-white" : "bg-page text-ink-4"}`}>
                      {appCount(a.models)}
                    </span>
                  </button>
                ))}
                {apps.length === 0 && <div className="p-3 text-xs text-ink-4">No matches.</div>}
              </nav>

              {current && (
                <div className="flex-1 min-w-0 overflow-y-auto p-4">
                  <div className="font-semibold text-ink-2">{current.label}</div>
                  <div className="flex gap-2 mt-2 mb-3">
                    <Button size="sm" variant="secondary" disabled={readOnly} onClick={() => { setCodes(currentCodes, false); setCodes(viewCodes, true) }}>View only</Button>
                    <Button size="sm" variant="secondary" disabled={readOnly} onClick={() => setCodes(currentCodes, true)}>Full access</Button>
                    <Button size="sm" variant="secondary" disabled={readOnly} onClick={() => setCodes(currentCodes, false)}>Clear</Button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-ink-3 border-b border-border">
                        <th className="w-8 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Select all in ${current.label}`}
                            disabled={readOnly}
                            checked={currentCodes.length > 0 && currentCodes.every(isOn)}
                            onChange={(e) => setCodes(currentCodes, e.target.checked)}
                            className="h-4 w-4 rounded"
                          />
                        </th>
                        <th className="py-2 font-semibold">Feature</th>
                        {VERBS.map((v) => <th key={v.key} className="py-2 font-semibold text-center w-16">{v.label}</th>)}
                        <th className="py-2 font-semibold">Other</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.models.map((m) => {
                        const codes = modelCodes(m)
                        return (
                          <tr key={m.model} className="border-b border-border-soft align-top">
                            <td className="py-2.5">
                              <input
                                type="checkbox"
                                aria-label={`All permissions for ${m.label}`}
                                disabled={!codes.some((c) => editable.has(c))}
                                checked={codes.every(isOn)}
                                onChange={(e) => setCodes(codes, e.target.checked)}
                                className="h-4 w-4 rounded"
                              />
                            </td>
                            <td className="py-2.5 text-ink-2">{m.label}</td>
                            {VERBS.map((v) => {
                              const code = m.perms[v.key]
                              return (
                                <td key={v.key} className="py-2.5 text-center">
                                  {code ? (
                                    <input
                                      type="checkbox"
                                      aria-label={`${v.label} ${m.label}`}
                                      title={inherited.has(code) ? "Granted by the user's role" : code}
                                      disabled={!editable.has(code) || inherited.has(code)}
                                      checked={isOn(code)}
                                      onChange={() => toggle(code)}
                                      className="h-4 w-4 rounded disabled:opacity-50"
                                    />
                                  ) : <span className="text-ink-4">—</span>}
                                </td>
                              )
                            })}
                            <td className="py-2.5">
                              {m.other.length === 0 ? <span className="text-ink-4">—</span> : (
                                <div className="flex flex-col gap-1">
                                  {m.other.map((o) => (
                                    <label key={o.code} className="flex items-center gap-1.5 text-xs text-ink-3" title={o.code}>
                                      <input
                                        type="checkbox"
                                        disabled={!editable.has(o.code) || inherited.has(o.code)}
                                        checked={isOn(o.code)}
                                        onChange={() => toggle(o.code)}
                                        className="h-3.5 w-3.5 rounded disabled:opacity-50"
                                      />
                                      {o.label.replace(/^Can /, "")}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex items-center justify-between gap-3">
              <span className="text-xs text-rose-600">{saveMutation.isError ? errorText(saveMutation.error) : ""}</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
                <Button variant="primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || (readOnly && mode !== "ceiling")}>
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
