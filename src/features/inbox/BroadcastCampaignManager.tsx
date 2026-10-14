import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill, Chip } from "../../components/ui/Pill"
import { EmptyState, LoadingState } from "../../components/ui/QueryStates"
import { extractApiError } from "../../api/client"
import {
  type BroadcastCampaign,
  cancelBroadcastCampaign,
  createBroadcastCampaign,
  dispatchBroadcastCampaign,
  getAudienceCounts,
  listBroadcastCampaigns,
  listTemplates,
} from "../../api/communications"
import { MessageTemplatesPanel } from "./MessageTemplatesPanel"

type CampaignChannel = "whatsapp" | "sms" | "email"

const AUDIENCE_LABELS: Record<BroadcastCampaign["target_audience"], { label: string; desc: string; icon: string }> = {
  all_patients: { label: "All Registered Patients", desc: "Every active patient record", icon: "👥" },
  unconverted_leads: { label: "Open CRM Leads", desc: "Enquiries in New, Contacted, Scheduled or Follow-up, not yet patients", icon: "🎯" },
  follow_up_leads: { label: "Leads in Follow-up", desc: "Open leads in Follow-up or with a follow-up date", icon: "⏰" },
  chronic_care: { label: "Patients with a Recall Due", desc: "Recall date passed or within the next 30 days", icon: "🩺" },
  senior_citizens: { label: "Senior Citizens (60+ yrs)", desc: "Patients born 60 or more years ago", icon: "🧓" },
}

const CHANNELS: { value: CampaignChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS (MSG91)" },
  { value: "email", label: "Email (polyMX)" },
]

const PRESETS: { title: string; audience: BroadcastCampaign["target_audience"]; body: string }[] = [
  {
    title: "Free cardiac screening camp",
    audience: "all_patients",
    body: "Namaste {{patient_name}}, {{hospital_name}} is holding a free cardiac and ECG screening camp this Sunday. Reply YES to reserve your token.",
  },
  {
    title: "OPD consultation offer for enquiries",
    audience: "unconverted_leads",
    body: "Hello {{patient_name}}, thank you for your recent enquiry with {{hospital_name}}. Reply BOOK and we'll call you to fix a convenient OPD time.",
  },
  {
    title: "Recall: time for your check-up",
    audience: "chronic_care",
    body: "Dear {{patient_name}}, your follow-up check-up at {{hospital_name}} is due. Reply here or call us to book a time.",
  },
]

const STATUS_TONE: Record<BroadcastCampaign["status"], "ok" | "warn" | "bad" | "info" | "neutral"> = {
  completed: "ok", sending: "warn", scheduled: "info", failed: "bad", draft: "neutral",
}

const field = "w-full text-xs px-3 py-2 border border-border-strong rounded-control bg-surface focus:border-success focus:outline-none"

export function BroadcastCampaignManager() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [selectedAudience, setSelectedAudience] = useState<BroadcastCampaign["target_audience"]>("unconverted_leads")
  const [title, setTitle] = useState("")
  const [channel, setChannel] = useState<CampaignChannel>("whatsapp")
  const [templateId, setTemplateId] = useState<number | "">("")
  const [messageBody, setMessageBody] = useState("")
  const [scheduledFor, setScheduledFor] = useState("")
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const campaignsQuery = useQuery({
    queryKey: ["broadcast-campaigns"],
    queryFn: () => listBroadcastCampaigns(),
    // While something is going out, keep the counts moving.
    refetchInterval: (q) => (q.state.data?.results.some((c) => c.status === "sending") ? 4_000 : false),
  })
  const audienceQuery = useQuery({ queryKey: ["broadcast-audience-counts"], queryFn: () => getAudienceCounts() })
  const templatesQuery = useQuery({ queryKey: ["templates", "campaign", channel], queryFn: () => listTemplates({ channel }) })
  const templates = (templatesQuery.data?.results ?? []).filter((t) => t.is_active)
  const template = templates.find((t) => t.id === templateId)

  const show = (ok: boolean, text: string) => {
    setNotice({ ok, text })
    setTimeout(() => setNotice(null), 8000)
  }
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] })
    queryClient.invalidateQueries({ queryKey: ["messages"] })
    queryClient.invalidateQueries({ queryKey: ["threads"] })
  }

  const dispatchMutation = useMutation({
    mutationFn: (id: number) => dispatchBroadcastCampaign(id),
    onSuccess: (data) => {
      refresh()
      show(true, data.detail)
    },
    onError: (e) => {
      refresh()
      show(false, extractApiError(e))
    },
  })
  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelBroadcastCampaign(id),
    onSuccess: refresh,
    onError: (e) => show(false, extractApiError(e)),
  })
  const createMutation = useMutation({
    mutationFn: (payload: Partial<BroadcastCampaign>) => createBroadcastCampaign(payload),
    onSuccess: (newCampaign) => {
      refresh()
      setIsCreating(false)
      setTitle("")
      setMessageBody("")
      setTemplateId("")
      setScheduledFor("")
      dispatchMutation.mutate(newCampaign.id)
    },
    onError: (e) => show(false, extractApiError(e)),
  })

  const counts = audienceQuery.data ?? { all_patients: 0, unconverted_leads: 0, follow_up_leads: 0, chronic_care: 0, senior_citizens: 0 }
  const needsTemplate = channel === "sms"
  const templateMissingId = channel === "sms" && template && !template.provider_template_id
  const canLaunch = !!title.trim() && (template ? true : !needsTemplate && !!messageBody.trim()) && !templateMissingId

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setTitle(preset.title)
    setSelectedAudience(preset.audience)
    setMessageBody(preset.body)
  }

  const handleLaunch = () => {
    if (!canLaunch) return
    createMutation.mutate({
      title: title.trim(),
      channel,
      target_audience: selectedAudience,
      template: template ? template.id : null,
      custom_message: template ? "" : messageBody.trim(),
      scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    })
  }

  const previewText = (template ? template.body : messageBody)
    .replace(/{{?patient_name}}?/g, "Rahul Sharma")
    .replace(/{{?hospital_name}}?/g, "your hospital")

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pb-10">
      {notice && (
        <div className={`px-4 py-3 rounded-lg flex items-center justify-between shadow-sm border ${notice.ok ? "bg-success-bg border-success/25 text-success-text" : "bg-danger-bg border-danger/25 text-danger-text"}`}>
          <span className="font-semibold text-sm">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-bold text-sm">✕</button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-ink-1">Who you can reach</h2>
            <p className="text-xs text-ink-4">People in each group right now. Anyone who opted out, unsubscribed or replied STOP is skipped when you send.</p>
          </div>
          <Button variant="primary" className="font-semibold text-xs shadow-sm" onClick={() => { setIsCreating(true); applyPreset(PRESETS[0]) }}>
            📢 New campaign
          </Button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(AUDIENCE_LABELS).map(([key, info]) => {
            const isSelected = selectedAudience === key
            return (
              <div
                key={key}
                onClick={() => { setSelectedAudience(key as BroadcastCampaign["target_audience"]); setIsCreating(true) }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${isSelected ? "border-success ring-2 ring-success/15" : "border-border-faint hover:border-border-strong"}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-lg">{info.icon}</span>
                  <span className="text-lg font-black text-ink-1">{(counts[key as keyof typeof counts] ?? 0).toLocaleString()}</span>
                </div>
                <div className="font-bold text-xs text-ink-2 truncate">{info.label}</div>
                <div className="text-[11px] text-ink-4 line-clamp-2 mt-0.5">{info.desc}</div>
              </div>
            )
          })}
        </div>
      </div>

      {isCreating && (
        <Card padded className="border-2 border-success/60">
          <div className="flex items-center justify-between pb-3 border-b border-border-faint">
            <div>
              <h3 className="text-sm font-bold text-ink-1">New campaign</h3>
              <p className="text-[11px] text-ink-4">Each person gets their own message through the provider; the counts below are what actually happened.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-4">Start from:</span>
              {PRESETS.map((p) => (
                <button key={p.title} type="button" onClick={() => applyPreset(p)} className="text-[11px] px-2.5 py-1 bg-white border border-border-strong rounded text-ink-2 hover:bg-success-bg">
                  {p.title.split(" ").slice(0, 2).join(" ")}…
                </button>
              ))}
              <button type="button" onClick={() => setIsCreating(false)} className="ml-3 text-ink-4 hover:text-ink-1 font-bold text-sm">✕</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Campaign title{channel === "email" && !template ? " (also the email subject)" : ""}</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-3 mb-1">Channel</label>
                  <select value={channel} onChange={(e) => { setChannel(e.target.value as CampaignChannel); setTemplateId("") }} className={field}>
                    {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-3 mb-1">Send to</label>
                  <select value={selectedAudience} onChange={(e) => setSelectedAudience(e.target.value as BroadcastCampaign["target_audience"])} className={field}>
                    {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label} ({counts[k as keyof typeof counts] ?? 0})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">
                  Template{needsTemplate ? " (required for SMS: DLT rules)" : " (optional)"}
                </label>
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")} className={field}>
                  <option value="">{needsTemplate ? "Choose a template…" : "No template: write the message below"}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} [{t.language}]{t.provider_template_id ? " ✓" : ""}</option>
                  ))}
                </select>
                {templateMissingId && <div className="text-[11px] text-danger-text mt-1">This template has no MSG91 / DLT template id yet. Add it under Message templates below.</div>}
                {channel === "whatsapp" && !template?.provider_template_id && (
                  <div className="text-[11px] text-warning-text mt-1">
                    Without a Meta-approved template, WhatsApp only delivers to people who messaged you in the last 24 hours.
                  </div>
                )}
              </div>
              {!template && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-ink-3">Message</label>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setMessageBody((p) => p + " {{patient_name}}")} className="text-[10px] px-1.5 py-0.5 bg-chip-bg border rounded text-ink-3">+ Name</button>
                      <button type="button" onClick={() => setMessageBody((p) => p + " {{hospital_name}}")} className="text-[10px] px-1.5 py-0.5 bg-chip-bg border rounded text-ink-3">+ Hospital</button>
                    </div>
                  </div>
                  <textarea rows={5} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} className={`${field} leading-relaxed`} />
                  <div className="text-[11px] text-ink-4 mt-1">{messageBody.length} characters{channel === "email" ? " · an unsubscribe link is added to every email" : ""}</div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Send at (leave empty to send now)</label>
                <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className={field} />
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <span className="text-[11px] text-ink-4">Up to {counts[selectedAudience] ?? 0} people, minus opt-outs and missing {channel === "email" ? "emails" : "numbers"}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsCreating(false)}>Cancel</Button>
                  <Button variant="action" size="sm" disabled={!canLaunch || createMutation.isPending || dispatchMutation.isPending} onClick={handleLaunch} className="font-bold">
                    {createMutation.isPending || dispatchMutation.isPending ? "Starting…" : scheduledFor ? "Schedule" : "Send now"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-chip-bg rounded-xl border border-border">
              <span className="text-xs font-semibold text-ink-4 uppercase tracking-wider mb-2">Preview</span>
              <div className="w-[300px] bg-white rounded-lg p-3 shadow-sm text-xs text-ink leading-relaxed min-h-[120px]">
                {channel === "email" && <div className="font-semibold border-b border-border-faint pb-1.5 mb-1.5">{template?.subject || title || "Subject"}</div>}
                <p className="whitespace-pre-wrap">{previewText || "Your message will appear here."}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card padded>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-ink-1">Campaigns</span>
            <Chip tone="ok">{campaignsQuery.data?.results?.length ?? 0}</Chip>
          </div>
        </CardHeader>
        {campaignsQuery.isLoading && <LoadingState />}
        {!campaignsQuery.isLoading && !campaignsQuery.data?.results?.length && <EmptyState message="No campaigns yet." />}
        <div className="divide-y divide-border-faint">
          {(campaignsQuery.data?.results ?? []).map((c) => (
            <CampaignRow
              key={c.id}
              campaign={c}
              busy={dispatchMutation.isPending || cancelMutation.isPending}
              onSend={() => dispatchMutation.mutate(c.id)}
              onCancel={() => cancelMutation.mutate(c.id)}
            />
          ))}
        </div>
      </Card>

      <MessageTemplatesPanel />
    </div>
  )
}

function Stat({ value, label, tone = "text-ink-1", title }: { value: string | number; label: string; tone?: string; title?: string }) {
  return (
    <div className="text-center" title={title}>
      <div className={`text-xs font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] text-ink-4 uppercase">{label}</div>
    </div>
  )
}

function CampaignRow({ campaign: c, busy, onSend, onCancel }: { campaign: BroadcastCampaign; busy: boolean; onSend: () => void; onCancel: () => void }) {
  const notReported = "This channel doesn't report delivery or reads back yet"
  return (
    <div className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-sm text-ink-1 truncate">{c.title}</span>
          <Chip tone="info">{c.channel.toUpperCase()}</Chip>
          <Pill tone={STATUS_TONE[c.status]}>{c.status.toUpperCase()}</Pill>
        </div>
        {c.custom_message && <div className="text-xs text-ink-3 line-clamp-1 mb-1">{c.custom_message}</div>}
        {c.error && <div className="text-xs text-danger-text mb-1">{c.error}</div>}
        <div className="flex items-center gap-2 text-[11px] text-ink-4 flex-wrap">
          <span>{AUDIENCE_LABELS[c.target_audience]?.label ?? c.target_audience}</span>
          <span>·</span>
          <span>by {c.created_by_name || "—"}</span>
          <span>·</span>
          <span>
            {c.status === "scheduled" && c.scheduled_for ? `sends ${new Date(c.scheduled_for).toLocaleString()}`
              : c.completed_at ? `sent ${new Date(c.completed_at).toLocaleString()}` : new Date(c.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0 bg-page px-3.5 py-2 rounded-lg border border-border">
        <Stat value={c.total_recipients} label="People" />
        <Stat value={c.sent_count} label="Sent" tone="text-success" />
        <Stat value={c.delivery_reported ? c.delivered_count : "—"} label="Delivered" title={c.delivery_reported ? undefined : notReported} />
        <Stat value={c.delivery_reported ? c.read_count : "—"} label="Read" title={c.delivery_reported ? undefined : notReported} />
        <Stat value={c.failed_count} label="Failed" tone={c.failed_count ? "text-danger-text" : "text-ink-1"} />
        <Stat value={c.skipped_count} label="Skipped" title="Opted out, unsubscribed, or no number / email" />
        {(c.status === "draft" || c.status === "failed") && (
          <Button size="sm" variant="action" className="ml-2 text-xs" disabled={busy} onClick={onSend}>
            {c.status === "failed" ? "Retry" : "Send"}
          </Button>
        )}
        {c.status === "scheduled" && (
          <Button size="sm" variant="secondary" className="ml-2 text-xs" disabled={busy} onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </div>
  )
}
