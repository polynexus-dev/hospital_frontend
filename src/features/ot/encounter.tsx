import type { OTEncounter } from "../../types/api"
import { ENCOUNTERS } from "./encounterStyles"

export function EncounterPill({ value }: { value?: OTEncounter | null }) {
  if (!value) return null
  const e = ENCOUNTERS[value]
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${e.pill}`}><span className={`w-1.5 h-1.5 rounded-full ${e.dot}`} />{e.label}</span>
}

export function EncounterLegend({ counts }: { counts?: Partial<Record<OTEncounter, number>> }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-3 dark:text-slate-300">
      {(Object.keys(ENCOUNTERS) as OTEncounter[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded-sm ${ENCOUNTERS[k].dot}`} />
          {ENCOUNTERS[k].label}{counts ? ` · ${counts[k] ?? 0}` : ""}
        </span>
      ))}
    </div>
  )
}
