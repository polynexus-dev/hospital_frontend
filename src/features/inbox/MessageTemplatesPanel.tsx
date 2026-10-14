import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { LoadingState } from "../../components/ui/QueryStates"
import { showToast } from "../../components/ui/Toast"
import { extractApiError } from "../../api/client"
import { listTemplates, updateTemplate } from "../../api/communications"
import type { Template } from "../../types/api"

const field = "w-full text-xs px-2.5 py-1.5 border border-border-strong rounded-control bg-surface focus:border-brand focus:outline-none"

/** Message templates per channel, with their provider registrations: SMS
 *  needs the MSG91 (DLT) template id, WhatsApp outside the 24-hour window
 *  needs the Meta-approved template name. */
export function MessageTemplatesPanel() {
  const [channel, setChannel] = useState<"sms" | "whatsapp" | "email">("sms")
  const [editing, setEditing] = useState<number | null>(null)
  const templates = useQuery({ queryKey: ["templates", "panel", channel], queryFn: () => listTemplates({ channel, page_size: "200" }) })
  const rows = (templates.data?.results ?? []).slice().sort((a, b) => a.purpose.localeCompare(b.purpose) || a.language.localeCompare(b.language))
  const missing = channel === "sms" ? rows.filter((t) => t.is_active && !t.provider_template_id).length : 0

  return (
    <Card padded>
      <CardHeader className="justify-between">
        <div>
          <div className="text-base font-bold text-ink-1">Message templates</div>
          <div className="text-[11.5px] text-ink-4">
            {channel === "sms" && "Every SMS must match a DLT-registered template: register the text in MSG91, then paste its template id here."}
            {channel === "whatsapp" && "Add the Meta-approved template name to reach people who haven't written to you in the last 24 hours."}
            {channel === "email" && "Sent through polyMX. Subjects and bodies can use {patient_name} and {hospital_name}."}
          </div>
        </div>
        <div className="flex gap-1">
          {(["sms", "whatsapp", "email"] as const).map((c) => (
            <button key={c} onClick={() => { setChannel(c); setEditing(null) }}
              className={`text-[12px] px-2.5 py-1 rounded-control border font-semibold ${channel === c ? "border-brand bg-brand-tint text-brand" : "border-border-strong text-ink-3"}`}>
              {c === "sms" ? "SMS" : c === "whatsapp" ? "WhatsApp" : "Email"}
            </button>
          ))}
        </div>
      </CardHeader>
      {missing > 0 && <div className="text-[12px] text-warning-text mb-2">{missing} active SMS template{missing > 1 ? "s have" : " has"} no MSG91 template id, so those messages can't be sent by SMS.</div>}
      {templates.isLoading && <LoadingState />}
      <div className="divide-y divide-border-faint">
        {rows.map((t) => editing === t.id
          ? <TemplateForm key={t.id} template={t} onDone={() => setEditing(null)} />
          : (
            <div key={t.id} className="py-2 flex items-start gap-3 text-[12.5px]">
              <div className="w-48 flex-none">
                <div className="font-semibold text-ink-2 truncate">{t.purpose.replace(/_/g, " ")}</div>
                <div className="text-[11px] text-ink-4">{t.language.toUpperCase()}{t.is_active ? "" : " · off"}</div>
              </div>
              <div className="flex-1 min-w-0 text-ink-3 line-clamp-2">{t.subject ? <b>{t.subject} · </b> : null}{t.body}</div>
              {channel !== "email" && (
                <div className={`w-40 flex-none text-[11px] font-mono truncate ${t.provider_template_id ? "text-success-text" : channel === "sms" ? "text-danger-text" : "text-ink-4"}`}>
                  {t.provider_template_id || (channel === "sms" ? "no DLT id" : "free text only")}
                </div>
              )}
              <button onClick={() => setEditing(t.id)} className="text-[12px] font-semibold text-brand">Edit</button>
            </div>
          ))}
        {templates.data && rows.length === 0 && <div className="py-3 text-[12.5px] text-ink-4">No {channel} templates yet. They're created the first time the hospital sends a message.</div>}
      </div>
    </Card>
  )
}

function TemplateForm({ template, onDone }: { template: Template; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(template)
  const set = (patch: Partial<Template>) => setDraft((d) => ({ ...d, ...patch }))
  const save = useMutation({
    mutationFn: () => updateTemplate(template.id, {
      subject: draft.subject, body: draft.body, is_active: draft.is_active,
      provider_template_id: draft.provider_template_id ?? "", provider_variables: draft.provider_variables ?? "",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] })
      onDone()
    },
    onError: (e) => showToast(extractApiError(e), "error"),
  })
  const isEmail = template.channel === "email"
  return (
    <div className="py-3 space-y-2">
      <div className="text-[12.5px] font-semibold">{template.purpose.replace(/_/g, " ")} · {template.language.toUpperCase()}</div>
      {isEmail && <label className="block text-[11px] text-ink-4">Subject<input className={field} value={draft.subject} onChange={(e) => set({ subject: e.target.value })} /></label>}
      <label className="block text-[11px] text-ink-4">Text
        <textarea rows={isEmail ? 6 : 3} className={field} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
      </label>
      {!isEmail && (
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-[11px] text-ink-4">{template.channel === "sms" ? "MSG91 template id (DLT)" : "Meta-approved template name"}
            <input className={`${field} font-mono`} value={draft.provider_template_id ?? ""} onChange={(e) => set({ provider_template_id: e.target.value })} />
          </label>
          <label className="text-[11px] text-ink-4">Variables, in the provider template's order
            <input className={`${field} font-mono`} value={draft.provider_variables ?? ""} onChange={(e) => set({ provider_variables: e.target.value })} placeholder="patient_name,date,time" />
          </label>
        </div>
      )}
      <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={draft.is_active} onChange={(e) => set({ is_active: e.target.checked })} /> Active</label>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
      </div>
    </div>
  )
}
