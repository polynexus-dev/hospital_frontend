import type { Tone } from "../components/ui/tone"

export interface SlaInfo {
  text: string
  tone: Tone
}

/**
 * Compares an ISO due-date timestamp against now and returns a short label +
 * a Pill tone (breached/urgent-soon/in-SLA), shared by any screen that shows
 * an SLA countdown (Callbacks queue, Inbox thread list, ...).
 *
 * `done` short-circuits to a neutral-good "done" state regardless of the
 * timestamp — pass e.g. `task.status === "done"` or `thread.status === "closed"`.
 */
export function slaInfo(dueAt: string, done: boolean): SlaInfo {
  if (done) return { text: "done", tone: "ok" }

  const due = new Date(dueAt).getTime()
  const now = Date.now()
  if (due < now) {
    const mins = Math.round((now - due) / 60000)
    return { text: `breached ${mins}m`, tone: "bad" }
  }
  const mins = Math.round((due - now) / 60000)
  return { text: mins < 15 ? `${mins}m left` : "in SLA", tone: mins < 15 ? "warn" : "ok" }
}
