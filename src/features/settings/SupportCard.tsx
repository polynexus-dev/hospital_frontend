import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"
import { getLicenseStatus } from "../../api/licensing"
import type { Paginated } from "../../types/api"

interface Ticket {
  id: number
  subject: string
  category: string
  priority: string
  status: string
  resolution_notes: string
  created_at: string
}

const input = "w-full px-3 py-2 border border-border-strong rounded-control text-[13px]"

/** Settings → Help & support (NABH DOM.2.b): version, support contacts, and
 *  the hospital's tickets. Response targets are in docs/compliance/SUPPORT_SLA.md. */
export function SupportCard() {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: ["license-status"], queryFn: getLicenseStatus, retry: false })
  const tickets = useQuery({ queryKey: ["support-tickets"], queryFn: () => api.get<Paginated<Ticket>>("/support-tickets/") })
  const [draft, setDraft] = useState({ subject: "", description: "", category: "general", priority: "medium" })
  const raise = useMutation({
    mutationFn: () => api.post<Ticket>("/support-tickets/", draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] })
      setDraft({ subject: "", description: "", category: "general", priority: "medium" })
    },
  })
  const support = status.data?.support
  const rows = tickets.data?.results ?? []

  return (
    <Card padded>
      <Eyebrow>Help & support</Eyebrow>
      <p className="text-[13px] mb-2">
        Version <b>{status.data?.app_version ?? "—"}</b>
        {support?.email && <> · <a className="text-brand" href={`mailto:${support.email}`}>{support.email}</a></>}
        {support?.phone && <> · <a className="text-brand" href={`tel:${support.phone.replace(/[^\d+]/g, "")}`}>{support.phone}</a></>}
      </p>
      <p className="text-[12px] text-ink-4 mb-3">Urgent: if no one can register or treat patients, raise an "Urgent" ticket and then phone us. Urgent issues are answered within 30 minutes, day and night.</p>

      <form className="grid gap-2 max-w-[560px] mb-4" onSubmit={(e) => { e.preventDefault(); raise.mutate() }}>
        <input aria-label="Subject" required className={input} placeholder="What's wrong, in a line" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        <textarea aria-label="Description" required rows={3} className={input} placeholder="What you did, what happened, which patient/bill number if any (no passwords)"
          value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <div className="flex gap-2">
          <select aria-label="Category" className={input} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            <option value="bug">Something isn't working</option>
            <option value="general">Question</option>
            <option value="billing">Subscription / billing</option>
            <option value="feature_request">Feature request</option>
          </select>
          <select aria-label="Priority" className={input} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
            <option value="urgent">Urgent: patients can't be served</option>
            <option value="high">High: a module is down</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        {raise.isError && <div className="text-[12px] text-danger-text">{extractApiError(raise.error)}</div>}
        {raise.isSuccess && <div className="text-[12px] text-success-text">Ticket raised. We'll reply here and by email.</div>}
        <div><Button size="sm" type="submit" disabled={raise.isPending}>{raise.isPending ? "Sending…" : "Raise ticket"}</Button></div>
      </form>

      {rows.length > 0 && (
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase text-ink-4"><tr><th className="py-1">#</th><th>Subject</th><th>Priority</th><th>Status</th><th>Raised</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-border align-top">
                <td className="py-1.5">{t.id}</td>
                <td>{t.subject}{t.resolution_notes && <div className="text-[12px] text-ink-4">{t.resolution_notes}</div>}</td>
                <td>{t.priority}</td>
                <td>{t.status.replace("_", " ")}</td>
                <td>{new Date(t.created_at).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
