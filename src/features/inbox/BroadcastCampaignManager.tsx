import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill, Chip } from "../../components/ui/Pill"
import { EmptyState, LoadingState } from "../../components/ui/QueryStates"
import {
  type BroadcastCampaign,
  createBroadcastCampaign,
  dispatchBroadcastCampaign,
  getAudienceCounts,
  listBroadcastCampaigns,
} from "../../api/communications"

const AUDIENCE_LABELS: Record<BroadcastCampaign["target_audience"], { label: string; desc: string; icon: string }> = {
  all_patients: {
    label: "All Registered Patients",
    desc: "Patients with registered profiles in Hospital Master",
    icon: "👥",
  },
  unconverted_leads: {
    label: "Unconverted CRM Leads",
    desc: "Active enquiries in New, Contacted, Scheduled, Visited stages",
    icon: "🎯",
  },
  follow_up_leads: {
    label: "Leads in Follow-up Queue",
    desc: "Patients who requested a callback or pending decision",
    icon: "⏰",
  },
  chronic_care: {
    label: "Chronic Care & Recalls Due",
    desc: "Patients due for regular diagnostic or specialist visits",
    icon: "🩺",
  },
  senior_citizens: {
    label: "Senior Citizens (60+ yrs)",
    desc: "Elderly patients eligible for health checkups & camp discounts",
    icon: "🧓",
  },
}

const TEMPLATE_PRESETS: { title: string; audience: BroadcastCampaign["target_audience"]; body: string }[] = [
  {
    title: "Free Cardiology & ECG Sunday Camp",
    audience: "all_patients",
    body: "Namaste {{patient_name}}, join us this Sunday for a Comprehensive Cardiac & ECG Screening Camp at our hospital. Consultation by Senior Cardiologists is complimentary! Reply YES to reserve your token.",
  },
  {
    title: "CRM Special OPD Consultation Offer",
    audience: "unconverted_leads",
    body: "Hello {{patient_name}}, we noticed you enquired about healthcare services recently. We are pleased to offer a Priority OPD Consultation at 50% privilege discount this week. Reply BOOK to claim your slot.",
  },
  {
    title: "Seasonal Monsoon Dengue & Viral Alert",
    audience: "chronic_care",
    body: "Dear {{patient_name}}, with seasonal viral infections on the rise, our 24x7 Diagnostic Lab & Emergency Fever Clinic is here for you. Complete fever profile results in 2 hours. Stay safe!",
  },
  {
    title: "Follow-up Health Check Reminder",
    audience: "follow_up_leads",
    body: "Hello {{patient_name}}, this is your patient coordinator following up on your consultation. Have your symptoms eased? Reply 1 to reschedule with the doctor or 2 to request a callback.",
  },
]

export function BroadcastCampaignManager() {
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [selectedAudience, setSelectedAudience] = useState<BroadcastCampaign["target_audience"]>("unconverted_leads")
  const [title, setTitle] = useState("")
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp")
  const [messageBody, setMessageBody] = useState("")
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null)

  const campaignsQuery = useQuery({
    queryKey: ["broadcast-campaigns"],
    queryFn: () => listBroadcastCampaigns(),
  })

  const audienceQuery = useQuery({
    queryKey: ["broadcast-audience-counts"],
    queryFn: () => getAudienceCounts(),
  })

  const createMutation = useMutation({
    mutationFn: (payload: Partial<BroadcastCampaign>) => createBroadcastCampaign(payload),
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] })
      setIsCreating(false)
      setTitle("")
      setMessageBody("")
      // If user selected instant dispatch
      if (newCampaign.id) {
        dispatchMutation.mutate(newCampaign.id)
      }
    },
  })

  const dispatchMutation = useMutation({
    mutationFn: (id: number) => dispatchBroadcastCampaign(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-campaigns"] })
      queryClient.invalidateQueries({ queryKey: ["messages"] })
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      setDispatchNotice(data.detail)
      setTimeout(() => setDispatchNotice(null), 7000)
    },
  })

  const counts = audienceQuery.data ?? {
    all_patients: 0,
    unconverted_leads: 0,
    follow_up_leads: 0,
    chronic_care: 0,
    senior_citizens: 0,
  }

  const applyPreset = (preset: (typeof TEMPLATE_PRESETS)[0]) => {
    setTitle(preset.title)
    setSelectedAudience(preset.audience)
    setMessageBody(preset.body)
  }

  const handleLaunch = () => {
    if (!title.trim() || !messageBody.trim()) return
    createMutation.mutate({
      title: title.trim(),
      channel,
      target_audience: selectedAudience,
      custom_message: messageBody.trim(),
      status: "draft",
    })
  }

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pb-10">
      {/* Alert banner */}
      {dispatchNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <span className="font-semibold text-sm">{dispatchNotice}</span>
          </div>
          <button
            onClick={() => setDispatchNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Cohort Insight Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-ink-1">Target Audience Cohorts (Live CRM Segments)</h2>
            <p className="text-xs text-ink-4">
              Real-time patient segments ready for instant WhatsApp or SMS community outreach broadcasts
            </p>
          </div>
          <Button
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
            onClick={() => {
              setIsCreating(true)
              applyPreset(TEMPLATE_PRESETS[0])
            }}
          >
            <span>📢</span>
            <span>New WhatsApp Campaign</span>
          </Button>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {Object.entries(AUDIENCE_LABELS).map(([key, info]) => {
            const count = (counts as any)[key] ?? 0
            const isSelected = selectedAudience === key
            return (
              <div
                key={key}
                onClick={() => {
                  setSelectedAudience(key as any)
                  if (!isCreating) setIsCreating(true)
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${
                  isSelected
                    ? "border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/20"
                    : "border-border-faint hover:border-border-strong hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-lg">{info.icon}</span>
                  <span className="text-lg font-black text-ink-1">{count.toLocaleString()}</span>
                </div>
                <div className="font-bold text-xs text-ink-2 truncate">{info.label}</div>
                <div className="text-[11px] text-ink-4 line-clamp-2 mt-0.5">{info.desc}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Campaign Creation Drawer / Modal */}
      {isCreating && (
        <Card padded className="border-2 border-emerald-400/80 bg-gradient-to-b from-emerald-50/30 to-white shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-border-faint">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <div>
                <h3 className="text-sm font-bold text-ink-1">Compose Outreach & Camp Broadcast</h3>
                <p className="text-[11px] text-ink-4">
                  Delivers directly to patients via WhatsApp Business API / SMS gateway
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-4">Or pick a template:</span>
              <div className="flex gap-1.5">
                {TEMPLATE_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="text-[11px] px-2.5 py-1 bg-white hover:bg-emerald-50 border border-border-strong rounded font-medium text-ink-2 hover:text-emerald-700 transition"
                  >
                    {p.title.split(" ")[0]}…
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="ml-3 text-ink-4 hover:text-ink-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
            {/* Left: Configuration form */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-3 mb-1">Campaign Title</label>
                <input
                  type="text"
                  placeholder="e.g. Free Cardiology Health Camp - Sunday"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-border-strong rounded-control bg-surface focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-3 mb-1">Outreach Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-border-strong rounded-control bg-surface"
                  >
                    <option value="whatsapp">WhatsApp (98% Open Rate)</option>
                    <option value="sms">SMS Gateway</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-3 mb-1">Target Segment</label>
                  <select
                    value={selectedAudience}
                    onChange={(e) => setSelectedAudience(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 border border-border-strong rounded-control bg-surface font-semibold text-emerald-800"
                  >
                    {Object.entries(AUDIENCE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} ({(counts as any)[k] || 0})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-ink-3">Message Content (with Placeholders)</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setMessageBody((prev) => prev + " {{patient_name}}")}
                      className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 border rounded text-ink-3"
                    >
                      + Name
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageBody((prev) => prev + " {{hospital_name}}")}
                      className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 border rounded text-ink-3"
                    >
                      + Hospital
                    </button>
                  </div>
                </div>
                <textarea
                  rows={5}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Enter broadcast message here..."
                  className="w-full text-xs p-3 border border-border-strong rounded-control bg-surface font-sans leading-relaxed focus:border-emerald-500 focus:outline-none"
                />
                <div className="flex justify-between items-center text-[11px] text-ink-4 mt-1">
                  <span>Estimated Reach: {(counts as any)[selectedAudience] || 0} recipients</span>
                  <span>{messageBody.length} characters</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={createMutation.isPending || dispatchMutation.isPending || !title || !messageBody}
                  onClick={handleLaunch}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {createMutation.isPending || dispatchMutation.isPending ? "Broadcasting…" : "🚀 Launch & Dispatch Now"}
                </Button>
              </div>
            </div>

            {/* Right: WhatsApp Mockup Preview */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                WhatsApp Patient Phone Preview
              </span>
              <div className="w-[300px] bg-[#075e54] text-white px-3 py-2 rounded-t-xl text-xs font-semibold flex items-center justify-between shadow">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">🏥</div>
                  <span>Hospital Broadcast Official</span>
                </div>
                <span className="text-[10px] text-emerald-200">Verified</span>
              </div>
              <div className="w-[300px] bg-[#efeae2] p-3 rounded-b-xl shadow min-h-[160px] flex flex-col justify-end">
                <div className="bg-white rounded-lg p-2.5 shadow-sm text-xs text-slate-800 leading-relaxed max-w-[260px]">
                  <p className="whitespace-pre-wrap">
                    {messageBody.replace(/{{patient_name}}/g, "Rahul Sharma") || "Your broadcast message will appear here..."}
                  </p>
                  <div className="text-[9px] text-slate-400 text-right mt-1.5 flex items-center justify-end gap-1">
                    <span>10:30 AM</span>
                    <span className="text-blue-500 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Broadcast History & Pipeline Overview */}
      <Card padded>
        <CardHeader className="justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-ink-1">Broadcast Campaign History & Engagement</span>
            <Chip tone="ok">
              {campaignsQuery.data?.results?.length ?? 0} Campaigns
            </Chip>
          </div>
        </CardHeader>

        {campaignsQuery.isLoading && <LoadingState />}
        {!campaignsQuery.isLoading && (!campaignsQuery.data?.results || campaignsQuery.data.results.length === 0) && (
          <EmptyState
            title="No Broadcast Campaigns Yet"
            description="Launch your first WhatsApp or SMS health checkup camp or outreach broadcast using the cohorts above."
          />
        )}

        {campaignsQuery.data?.results && campaignsQuery.data.results.length > 0 && (
          <div className="divide-y divide-border-faint">
            {campaignsQuery.data.results.map((campaign) => {
              const deliveryRate =
                campaign.total_recipients > 0
                  ? Math.round((campaign.delivered_count / campaign.total_recipients) * 100)
                  : 0
              const readRate =
                campaign.total_recipients > 0
                  ? Math.round((campaign.read_count / campaign.total_recipients) * 100)
                  : 0

              return (
                <div key={campaign.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-ink-1 truncate">{campaign.title}</span>
                      <Chip tone={campaign.channel === "whatsapp" ? "ok" : "info"}>
                        {campaign.channel.toUpperCase()}
                      </Chip>
                      <Pill
                        tone={
                          campaign.status === "completed"
                            ? "ok"
                            : campaign.status === "sending"
                            ? "warn"
                            : "neutral"
                        }
                      >
                        {campaign.status.toUpperCase()}
                      </Pill>
                    </div>
                    <div className="text-xs text-ink-3 line-clamp-1 mb-1.5">{campaign.custom_message}</div>
                    <div className="flex items-center gap-3 text-[11px] text-ink-4">
                      <span>Cohort: <strong>{AUDIENCE_LABELS[campaign.target_audience]?.label || campaign.target_audience}</strong></span>
                      <span>•</span>
                      <span>Created by {campaign.created_by_name || "Coordinator"}</span>
                      <span>•</span>
                      <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Delivery & Read Metrics */}
                  <div className="flex items-center gap-4 shrink-0 bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200">
                    <div className="text-center">
                      <div className="text-xs font-bold text-ink-1">{campaign.total_recipients}</div>
                      <div className="text-[10px] text-ink-4 uppercase">Recipients</div>
                    </div>
                    <div className="h-6 w-px bg-slate-200" />
                    <div className="text-center">
                      <div className="text-xs font-bold text-emerald-600">{deliveryRate}%</div>
                      <div className="text-[10px] text-ink-4 uppercase">Delivered</div>
                    </div>
                    <div className="h-6 w-px bg-slate-200" />
                    <div className="text-center">
                      <div className="text-xs font-bold text-blue-600">{readRate}%</div>
                      <div className="text-[10px] text-ink-4 uppercase">Read</div>
                    </div>
                    {campaign.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="primary"
                        className="ml-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                        disabled={dispatchMutation.isPending}
                        onClick={() => dispatchMutation.mutate(campaign.id)}
                      >
                        {dispatchMutation.isPending ? "Dispatching…" : "Dispatch"}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
