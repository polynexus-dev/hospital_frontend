import React from "react"
import { useSearchParams } from "react-router-dom"
import { ResourceTable, type ResourceConfig } from "./ResourceTable"

export interface HubTab {
  key: string
  label: string
  resource?: ResourceConfig
  render?: () => React.ReactNode
}

/** A module page: heading + tab strip, each tab a ResourceTable or a custom panel. Tab is kept in ?tab= so links are shareable. */
export function ModuleHub({ title, subtitle, tabs }: { title: string; subtitle?: string; tabs: HubTab[] }) {
  const [params, setParams] = useSearchParams()
  const active = tabs.find((t) => t.key === params.get("tab")) ?? tabs[0]
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ tab: t.key })}
            className={`pb-2 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
              t.key === active.key
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div key={active.key}>{active.render ? active.render() : active.resource ? <ResourceTable config={active.resource} /> : null}</div>
    </div>
  )
}
