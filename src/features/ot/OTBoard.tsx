import { useEffect, useState } from "react"
import { extractApiError } from "../../api/client"
import { getOTBoard } from "../../api/ot"
import type { OTBoard as Board, OTBoardCase } from "../../types/api"
import { EncounterLegend } from "./encounter"
import { ENCOUNTERS } from "./encounterStyles"

const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "")

const STATUS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

function CaseCard({ c }: { c: OTBoardCase }) {
  const enc = ENCOUNTERS[c.encounter]
  const cancelled = c.status === "cancelled"
  return (
    <div className={`rounded-lg border border-border dark:border-slate-700 border-l-4 p-3 space-y-1 ${enc.card} ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-ink-2 dark:text-slate-200">
          {hhmm(c.scheduled_start)}–{hhmm(c.scheduled_end)}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-4 dark:text-slate-400">
          {enc.label}{c.priority !== "elective" && c.encounter !== "emergency" ? ` · ${c.priority}` : ""}
        </span>
      </div>
      <div className={`text-sm font-semibold text-ink dark:text-slate-100 ${cancelled ? "line-through" : ""}`}>
        {c.patient_name}{c.patient_uhid ? <span className="font-normal text-ink-4"> · {c.patient_uhid}</span> : null}
      </div>
      <div className="text-sm text-ink-2 dark:text-slate-300">{c.procedure}{c.grade ? <span className="text-ink-4"> · {c.grade}</span> : null}</div>
      <div className="text-xs text-ink-3 dark:text-slate-400">
        {c.surgeon}{c.assistant ? ` + ${c.assistant}` : ""}{c.anaesthetist ? ` · Anaes: ${c.anaesthetist}` : ""}
      </div>
      <div className="text-xs font-medium text-ink-3 dark:text-slate-300">
        {STATUS[c.status] ?? c.status}
        {c.status === "in_progress" && c.actual_start ? ` since ${hhmm(c.actual_start)}` : ""}
        {cancelled && c.cancellation_reason ? ` — ${c.cancellation_reason}` : ""}
      </div>
    </div>
  )
}

export function OTBoard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [date, setDate] = useState(localDate())
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    getOTBoard(date).then(setBoard).catch((e) => setError(extractApiError(e)))
  }, [date, refreshKey])

  const shift = (days: number) => {
    const d = new Date(`${date}T00:00:00`)
    d.setDate(d.getDate() + days)
    setDate(localDate(d))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="px-2.5 py-1.5 text-sm rounded-lg border border-border dark:border-slate-600" aria-label="Previous day">‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="px-3 py-1.5 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900" />
          <button onClick={() => shift(1)} className="px-2.5 py-1.5 text-sm rounded-lg border border-border dark:border-slate-600" aria-label="Next day">›</button>
          <button onClick={() => setDate(localDate())} className="px-3 py-1.5 text-sm font-medium text-brand dark:text-indigo-300">Today</button>
        </div>
        <EncounterLegend counts={board?.counts} />
      </div>
      {error && <div className="text-sm text-danger-text">{error}</div>}
      {board && board.cases.length === 0 && (
        <div className="py-12 text-center text-sm text-ink-4 bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700">No surgeries on this day.</div>
      )}
      {board && board.cases.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(260px, 1fr))` }}>
          {board.rooms.map((room) => (
            <section key={room} className="bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-3 space-y-2">
              <h3 className="text-sm font-bold text-ink dark:text-slate-100">{room}</h3>
              {board.cases.filter((c) => c.room === room).map((c) => <CaseCard key={c.id} c={c} />)}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
