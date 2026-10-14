import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"

interface Schedule {
  weekly_enabled: boolean
  weekly_day: number
  monthly_enabled: boolean
  email_recipients: string[]
  whatsapp_recipients: string[]
  recent: { period: "weekly" | "monthly"; start: string; end: string; sent_at: string | null; recipients: string[]; error: string }[]
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const input = "w-full px-3 py-2 border border-border-strong rounded-control text-[13px]"

/** Settings → Scheduled MIS: weekly and monthly reports sent automatically
 *  (PDF by email, headline numbers on WhatsApp). Managers only. */
export function MISScheduleCard() {
  const queryClient = useQueryClient()
  const q = useQuery({ queryKey: ["mis-schedule"], queryFn: () => api.get<Schedule>("/reports/mis-schedule/"), retry: false })
  const [draft, setDraft] = useState({ weekly_enabled: false, weekly_day: 0, monthly_enabled: false, emails: "", whatsapp: "" })
  useEffect(() => {
    if (q.data) setDraft({ weekly_enabled: q.data.weekly_enabled, weekly_day: q.data.weekly_day, monthly_enabled: q.data.monthly_enabled,
      emails: q.data.email_recipients.join("\n"), whatsapp: q.data.whatsapp_recipients.join("\n") })
  }, [q.data])
  const list = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
  const save = useMutation({
    mutationFn: () => api.put<Schedule>("/reports/mis-schedule/", {
      weekly_enabled: draft.weekly_enabled, weekly_day: draft.weekly_day, monthly_enabled: draft.monthly_enabled,
      email_recipients: list(draft.emails), whatsapp_recipients: list(draft.whatsapp),
    }),
    onSuccess: (data) => queryClient.setQueryData(["mis-schedule"], data),
  })
  const test = useMutation({ mutationFn: () => api.post<{ sent_to: string[]; error: string }>("/reports/mis-schedule/") })

  if (q.isError || !q.data) return null

  return (
    <Card padded>
      <Eyebrow>Scheduled MIS reports</Eyebrow>
      <p className="text-[13px] text-ink-3 mb-3">Email gets the full PDF; WhatsApp gets the headline numbers. The daily owner summary on WhatsApp is separate.</p>
      <form className="grid sm:grid-cols-2 gap-3 max-w-[720px]" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={draft.weekly_enabled} onChange={(e) => setDraft({ ...draft, weekly_enabled: e.target.checked })} />
            Weekly, every
            <select aria-label="Weekday" className="border border-border-strong rounded-control px-2 py-1" value={draft.weekly_day} onChange={(e) => setDraft({ ...draft, weekly_day: Number(e.target.value) })}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
            (previous Monday–Sunday)
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={draft.monthly_enabled} onChange={(e) => setDraft({ ...draft, monthly_enabled: e.target.checked })} />
            Monthly, on the 1st (previous month)
          </label>
        </div>
        <div />
        <div>
          <label className="text-[12px] text-ink-3" htmlFor="mis-emails">Email recipients (one per line)</label>
          <textarea id="mis-emails" rows={3} className={input} value={draft.emails} onChange={(e) => setDraft({ ...draft, emails: e.target.value })} />
        </div>
        <div>
          <label className="text-[12px] text-ink-3" htmlFor="mis-wa">WhatsApp numbers (one per line)</label>
          <textarea id="mis-wa" rows={3} className={input} value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} />
        </div>
        {(save.isError || test.isError) && <div className="sm:col-span-2 text-[12px] text-danger-text">{extractApiError(save.error || test.error)}</div>}
        {test.data && <div className="sm:col-span-2 text-[12px] text-success-text">Last week's report sent to {test.data.sent_to.join(", ")}.</div>}
        <div className="sm:col-span-2 flex gap-2">
          <Button size="sm" type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          <Button size="sm" type="button" variant="secondary" disabled={test.isPending} onClick={() => test.mutate()}>Send last week's report now</Button>
        </div>
      </form>
      {q.data.recent.length > 0 && (
        <table className="w-full text-[12.5px] mt-4">
          <thead className="text-left text-[11px] uppercase text-ink-4"><tr><th className="py-1">Report</th><th>Period</th><th>Result</th></tr></thead>
          <tbody>
            {q.data.recent.map((r) => (
              <tr key={`${r.period}-${r.start}`} className="border-t border-border">
                <td className="py-1.5 capitalize">{r.period}</td>
                <td>{r.start} to {r.end}</td>
                <td className={r.sent_at ? "" : "text-danger-text"}>{r.sent_at ? `Sent to ${r.recipients.length}` : `Not sent yet: ${r.error || "will retry tomorrow"}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
