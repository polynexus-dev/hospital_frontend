import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader, Eyebrow } from "../../components/ui/Card"
import { Avatar } from "../../components/ui/Avatar"
import { Button } from "../../components/ui/Button"
import { Chip, NeutralTag, Pill } from "../../components/ui/Pill"
import { EmptyState, LoadingState } from "../../components/ui/QueryStates"
import {
  claimThread,
  createConsent,
  listConsent,
  listMessages,
  listRecentThreads,
  listTemplates,
  listThreads,
  markThreadRead,
  postInteractiveChatAction,
  sendMessage,
  setConsent,
} from "../../api/communications"
import { createEnquiry, listEnquiries } from "../../api/enquiries"
import { getPatient, listPatients } from "../../api/patients"
import { listUsers } from "../../api/accounts"
import { useAuthStore } from "../../store/auth"
import { slaInfo } from "../../lib/sla"
import { extractApiError } from "../../api/client"
import type { Channel, ConsentOptOut, Enquiry, EnquiryStage, Thread } from "../../types/api"
import type { Tone } from "../../components/ui/tone"
import { BroadcastCampaignManager } from "./BroadcastCampaignManager"

const CHANNELS: Channel[] = ["whatsapp", "sms", "email", "call_note"]

const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  call_note: "Call note",
}

const CHANNEL_TONE: Record<Channel, Tone> = {
  whatsapp: "ok",
  sms: "info",
  email: "neutral",
  call_note: "warn",
}

const PURPOSE_LABELS: Record<ConsentOptOut["purpose"], string> = {
  transactional: "Transactional",
  marketing: "Marketing",
  all: "All communication",
}

const STAGE_LABELS: Record<EnquiryStage, string> = {
  new: "New",
  contacted: "Contacted",
  scheduled: "Scheduled",
  visited: "Visited",
  completed: "Completed",
  follow_up: "Follow-up",
  lost: "Lost",
}

// Only used when a thread's channel has no active template yet — the real
// quick-reply chips are populated from listTemplates() below.
const FALLBACK_QUICK_REPLIES: { label: string; body: string }[] = [
  { label: "Slot options", body: "Here are the next available slots — reply with your preferred date/time and we'll confirm." },
  { label: "Package price", body: "Sharing the package price details shortly. Let us know if you'd like a callback to discuss." },
  { label: "Directions", body: "Here are directions to the hospital. Let us know if you need help finding parking or the entrance." },
  { label: "Report ready", body: "Your report is ready. You can collect it at the front desk or we can share it on this channel." },
]

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// Placeholder heuristic — not a real recommendation engine. Rule-based on the
// latest enquiry stage and whether the thread has an unanswered inbound message.
function suggestNextStep(input: {
  hasUnreadInbound: boolean
  latestEnquiry: Enquiry | null
  channel: Channel
}): { text: string; replyBody: string } {
  const { hasUnreadInbound, latestEnquiry, channel } = input

  if (hasUnreadInbound) {
    return {
      text: `Patient is waiting on a reply on ${CHANNEL_LABELS[channel]} — acknowledge now to stay inside the 2-hour SLA.`,
      replyBody: "Thanks for your message — we're looking into this and will get back to you shortly.",
    }
  }
  if (!latestEnquiry) {
    return {
      text: "No enquiry on file for this patient yet — convert this thread once intent is confirmed.",
      replyBody: "Thanks for reaching out! Could you share a bit more about what you're looking for so we can help?",
    }
  }
  switch (latestEnquiry.stage) {
    case "new":
      return { text: "Enquiry is still New — share slot options to move it toward Contacted.", replyBody: FALLBACK_QUICK_REPLIES[0].body }
    case "contacted":
      return { text: "Already contacted — offer to book a slot to push this toward Scheduled.", replyBody: FALLBACK_QUICK_REPLIES[0].body }
    case "scheduled":
      return { text: "Visit is scheduled — send directions ahead of the appointment.", replyBody: FALLBACK_QUICK_REPLIES[2].body }
    case "visited":
      return { text: "Patient has visited — a report-ready follow-up keeps the loop closed.", replyBody: FALLBACK_QUICK_REPLIES[3].body }
    case "follow_up":
      return { text: "Marked for follow-up — a quick check-in message keeps this warm.", replyBody: "Just checking in — is there anything else we can help with?" }
    case "completed":
      return { text: "Enquiry completed — no urgent action, thread looks up to date.", replyBody: "" }
    case "lost":
      return { text: "Enquiry marked lost — only respond if the patient re-engages.", replyBody: "" }
    default:
      return { text: "No urgent action — thread looks up to date.", replyBody: "" }
  }
}

export function InboxPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null)
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all")
  const [activeInboxTab, setActiveInboxTab] = useState<"conversations" | "broadcasts">("conversations")
  const [composerBody, setComposerBody] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const threadsQuery = useQuery({
    queryKey: ["threads", channelFilter],
    queryFn: () => listThreads({ ordering: "-last_message_at", ...(channelFilter === "all" ? {} : { channel: channelFilter }) }),
  })

  // Batched lookups reused across every row — same pattern as the owner-name
  // resolution in CallbacksPage/EnquiriesPage. listPatients() returns only the
  // backend's default page (25 patients), so patients outside that page fall
  // back to "Patient #<id>" below.
  const patientsQuery = useQuery({ queryKey: ["patients", "inbox-lookup"], queryFn: () => listPatients() })
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: listUsers })

  // Global recent-message feed, grouped client-side into a per-thread preview.
  // Threads whose last message fell outside this page fall back to a generic line.
  const recentMessagesQuery = useQuery({ queryKey: ["messages", "recent-preview"], queryFn: listRecentThreads })

  const threads = threadsQuery.data?.results ?? []
  const selectedThread: Thread | null = threads.find((t) => t.id === selectedThreadId) ?? null

  const selectedPatientQuery = useQuery({
    queryKey: ["patient", selectedThread?.patient],
    queryFn: () => getPatient(selectedThread!.patient),
    enabled: !!selectedThread,
  })

  const messagesQuery = useQuery({
    queryKey: ["messages", selectedThread?.patient],
    queryFn: () => listMessages(selectedThread!.patient),
    enabled: !!selectedThread,
  })

  const templatesQuery = useQuery({
    queryKey: ["templates"],
    queryFn: () => listTemplates(),
  })

  const enquiriesQuery = useQuery({
    queryKey: ["enquiries", "patient", selectedThread?.patient],
    queryFn: () => listEnquiries({ patient: String(selectedThread!.patient) }),
    enabled: !!selectedThread,
  })

  const consentQuery = useQuery({
    queryKey: ["consent", selectedThread?.patient],
    queryFn: () => listConsent(selectedThread!.patient),
    enabled: !!selectedThread,
  })

  const claimMutation = useMutation({
    mutationFn: (id: number) => claimThread(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["threads"] }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => markThreadRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["threads"] }),
  })

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] })
      queryClient.invalidateQueries({ queryKey: ["threads"] })
      setComposerBody("")
      setSelectedTemplateId(null)
      setErrorMessage(null)
    },
    onError: (err) => {
      const msg = extractApiError(err, "Failed to send message.")
      setErrorMessage(msg)
    },
  })

  const consentMutation = useMutation({
    mutationFn: ({ id, isOptedOut }: { id: number; isOptedOut: boolean }) => setConsent(id, isOptedOut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consent"] })
      setErrorMessage(null)
    },
    onError: (err) => {
      setErrorMessage(extractApiError(err, "Failed to update consent."))
    },
  })

  const createConsentMutation = useMutation({
    mutationFn: (payload: { patient: number; channel: Channel; purpose: ConsentOptOut["purpose"]; is_opted_out: boolean }) =>
      createConsent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consent"] })
      setErrorMessage(null)
    },
    onError: (err) => {
      setErrorMessage(extractApiError(err, "Failed to grant consent."))
    },
  })

  const aiMutation = useMutation({
    mutationFn: postInteractiveChatAction,
    onSuccess: (data) => setComposerBody(data.reply),
  })

  const convertMutation = useMutation({
    mutationFn: () =>
      createEnquiry({
        patient: selectedThread!.patient,
        name: selectedPatientQuery.data?.full_name || patientName(selectedThread!.patient),
        mobile: selectedPatientQuery.data?.mobile ?? "",
        email: selectedPatientQuery.data?.email ?? "",
        source: selectedThread!.channel === "whatsapp" ? "whatsapp" : "other",
        service_requested: "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      navigate("/enquiries")
    },
  })

  const patientNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of patientsQuery.data?.results ?? []) {
      map.set(p.id, p.full_name || `${p.first_name} ${p.last_name}`.trim())
    }
    return map
  }, [patientsQuery.data])

  function patientName(id: number): string {
    return patientNameById.get(id) ?? `Patient #${id}`
  }

  function ownerName(id: number | null): string {
    if (!id) return "Unassigned"
    const u = usersQuery.data?.results.find((u) => u.id === id)
    return u ? u.first_name || u.email : `User #${id}`
  }

  const previewByThread = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of recentMessagesQuery.data?.results ?? []) {
      const key = `${m.patient}-${m.channel}`
      if (!map.has(key)) map.set(key, m.body)
    }
    return map
  }, [recentMessagesQuery.data])

  const patientEnquiries = useMemo(
    () => [...(enquiriesQuery.data?.results ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [enquiriesQuery.data],
  )
  const latestEnquiry = patientEnquiries[0] ?? null
  const openEnquiry = patientEnquiries.find((e) => e.stage !== "completed" && e.stage !== "lost") ?? null

  // Approximation: min(patient.created_at, every fetched enquiry's created_at).
  // Cheap here because patientEnquiries is already being fetched for the
  // convert-to-enquiry check above — no extra request needed.
  const firstTouchIso = useMemo(() => {
    const dates = [selectedPatientQuery.data?.created_at, ...patientEnquiries.map((e) => e.created_at)].filter(
      (d): d is string => !!d,
    )
    if (dates.length === 0) return null
    return dates.reduce((earliest, iso) => (new Date(iso).getTime() < new Date(earliest).getTime() ? iso : earliest))
  }, [selectedPatientQuery.data, patientEnquiries])

  const activeTemplates = useMemo(() => {
    const list = templatesQuery.data?.results.filter((t) => t.is_active) ?? []
    if (!selectedThread) return list
    const forChannel = list.filter((t) => t.channel === selectedThread.channel)
    return forChannel.length > 0 ? forChannel : list
  }, [templatesQuery.data, selectedThread])

  const filteredMessages = (messagesQuery.data?.results ?? []).filter((m) => m.channel === selectedThread?.channel)
  const consentRows = consentQuery.data?.results ?? []

  const patientMobile = selectedPatientQuery.data?.mobile?.trim() ?? ""
  const patientEmail = selectedPatientQuery.data?.email?.trim() ?? ""

  const isMissingAddress = useMemo(() => {
    if (!selectedThread) return false
    if (selectedThread.channel === "whatsapp" || selectedThread.channel === "sms") {
      return !patientMobile
    }
    if (selectedThread.channel === "email") {
      return !patientEmail
    }
    return false
  }, [selectedThread, patientMobile, patientEmail])

  const channelConsentRecord = useMemo(() => {
    if (!selectedThread) return null
    return consentRows.find((c) => c.channel === selectedThread.channel) ?? null
  }, [selectedThread, consentRows])

  const isOptedOut = channelConsentRecord ? channelConsentRecord.is_opted_out : false

  const nextStep = selectedThread
    ? suggestNextStep({ hasUnreadInbound: selectedThread.unread_count > 0, latestEnquiry, channel: selectedThread.channel })
    : null

  const handleSelectThread = (thread: Thread) => {
    setSelectedThreadId(thread.id)
    setComposerBody("")
    if (thread.unread_count > 0) markReadMutation.mutate(thread.id)
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    const text = composerBody.trim()
    if (!selectedThread || !text) return

    if (isMissingAddress) {
      setErrorMessage(
        `Cannot send message: Patient has no registered ${
          selectedThread.channel === "email" ? "email address" : "mobile number"
        } on file. Please update the patient's record.`,
      )
      return
    }

    const matchedTemplate =
      activeTemplates.find((t) => t.id === selectedTemplateId) ??
      (selectedThread.channel === "whatsapp" && activeTemplates.length > 0 ? activeTemplates[0] : null)

    sendMutation.mutate({
      patient: selectedThread.patient,
      channel: selectedThread.channel,
      purpose: matchedTemplate?.purpose || "transactional",
      body: text,
      message: text,
      ...(matchedTemplate
        ? {
            template: matchedTemplate.id,
            template_id: matchedTemplate.id,
            template_name: matchedTemplate.name,
          }
        : {}),
      context: { body: text },
    })
  }

  const handleGenerateAiReply = () => {
    if (!selectedThread) return
    aiMutation.mutate({ action: "book_opd", language: selectedPatientQuery.data?.preferred_language || "en" })
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-130px)] min-w-[940px]">
      {/* Top Tab Bar: 1-on-1 Patient Inbox vs Broadcast Outreach Engine */}
      <div className="flex items-center justify-between bg-surface border border-border-faint px-3 py-1.5 rounded-lg shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveInboxTab("conversations")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              activeInboxTab === "conversations"
                ? "bg-brand text-white shadow-xs"
                : "text-ink-3 hover:text-ink-1 hover:bg-slate-100"
            }`}
          >
            <span>💬</span>
            <span>Patient Conversations</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${activeInboxTab === "conversations" ? "bg-white/20 text-white" : "bg-slate-200 text-ink-3"}`}>
              {threadsQuery.data?.count ?? 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveInboxTab("broadcasts")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              activeInboxTab === "broadcasts"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-ink-3 hover:text-ink-1 hover:bg-slate-100"
            }`}
          >
            <span>📢</span>
            <span>WhatsApp Broadcast & Outreach Engine</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded uppercase">
              Campaigns
            </span>
          </button>
        </div>
      </div>

      {activeInboxTab === "broadcasts" ? (
        <BroadcastCampaignManager />
      ) : (
        <div className="grid grid-cols-[268px_minmax(380px,1fr)_248px] gap-3 flex-1 min-h-0">
          {/* LEFT — thread list */}
          <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="justify-between">
              <div className="flex items-center gap-2">
                <div className="text-[13px] font-semibold">Threads</div>
                <NeutralTag>{threadsQuery.data?.count ?? 0}</NeutralTag>
              </div>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as Channel | "all")}
            className="h-[26px] px-2 border border-border-strong rounded-control bg-surface text-[11.5px] text-ink-3"
          >
            <option value="all">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </CardHeader>
        <div className="flex-1 overflow-y-auto">
          {threadsQuery.isLoading && <LoadingState />}
          {!threadsQuery.isLoading && threads.length === 0 && <EmptyState message="No threads yet." />}
          {threads.map((thread) => {
            const sla = thread.sla_due_at ? slaInfo(thread.sla_due_at, thread.status === "closed") : null
            const isSelected = thread.id === selectedThreadId
            return (
              <button
                key={thread.id}
                onClick={() => handleSelectThread(thread)}
                className={`w-full text-left px-3.5 py-2.5 border-b border-border-faint flex flex-col gap-1.5 ${
                  isSelected ? "bg-brand-tint" : "hover:bg-page"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Chip tone={CHANNEL_TONE[thread.channel]}>{CHANNEL_LABELS[thread.channel].toUpperCase()}</Chip>
                  <div className="text-[13px] font-semibold truncate flex-1 min-w-0">{patientName(thread.patient)}</div>
                  {thread.unread_count > 0 && (
                    <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {thread.unread_count}
                    </span>
                  )}
                  <div className="text-[11px] text-ink-5 shrink-0">{relativeTime(thread.last_message_at)}</div>
                </div>
                <div className="text-[12px] text-ink-3 leading-snug line-clamp-2">
                  {previewByThread.get(`${thread.patient}-${thread.channel}`) ?? "No recent message preview available."}
                </div>
                <div className="flex items-center gap-1.5">
                  <NeutralTag>{ownerName(thread.owner)}</NeutralTag>
                  <div className="flex-1" />
                  {sla && <Pill tone={sla.tone}>{sla.text}</Pill>}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* CENTER — selected thread */}
      <Card className="h-full flex flex-col overflow-hidden">
        {!selectedThread ? (
          <div className="flex-1 flex items-center justify-center text-ink-4 text-[13px]">
            Select a thread on the left to view the conversation.
          </div>
        ) : (
          <>
            <div className="px-3.5 py-3 border-b border-border flex items-center gap-3 flex-wrap">
              <Avatar name={patientName(selectedThread.patient)} size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold truncate">{patientName(selectedThread.patient)}</div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <NeutralTag>{CHANNEL_LABELS[selectedThread.channel]}</NeutralTag>
                  {selectedPatientQuery.data?.mobile && <NeutralTag>{selectedPatientQuery.data.mobile}</NeutralTag>}
                  {selectedPatientQuery.data?.city && <NeutralTag>{selectedPatientQuery.data.city}</NeutralTag>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedThread.owner === user?.id ? (
                  <NeutralTag>Assigned to you</NeutralTag>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => claimMutation.mutate(selectedThread.id)} disabled={claimMutation.isPending}>
                    {claimMutation.isPending ? "Assigning…" : "Assign to me"}
                  </Button>
                )}
                {openEnquiry ? (
                  <Button size="sm" variant="ghost" onClick={() => navigate("/enquiries")}>
                    View open enquiry →
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => convertMutation.mutate()}
                    disabled={convertMutation.isPending || !selectedPatientQuery.data}
                  >
                    {convertMutation.isPending ? "Converting…" : "Convert to enquiry"}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-2.5">
              {messagesQuery.isLoading && <LoadingState />}
              {!messagesQuery.isLoading && filteredMessages.length === 0 && (
                <EmptyState message="No messages on this channel yet. Send the first message below." />
              )}
              {filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`px-3 py-2 rounded-control max-w-[70%] text-[13px] leading-relaxed ${
                    msg.direction === "outbound" ? "ml-auto bg-brand text-white" : "mr-auto bg-page border border-border text-ink"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.body}</div>
                  <div className={`text-[10.5px] mt-1 flex items-center gap-1.5 ${msg.direction === "outbound" ? "text-white/75" : "text-ink-4"}`}>
                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span>·</span>
                    <span className="capitalize">{msg.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-3.5 py-3 flex flex-col gap-2">
              {isMissingAddress && (
                <div className="p-2.5 rounded-control bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>⚠️</span>
                    <span>
                      Patient has no <strong>{selectedThread.channel === "email" ? "email address" : "mobile number"}</strong> on file. Messages cannot be delivered without an address.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/patients/${selectedThread.patient}`)}
                    className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100 shrink-0"
                  >
                    Update Patient Profile →
                  </button>
                </div>
              )}

              {isOptedOut && (
                <div className="p-2.5 rounded-control bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>⚠️</span>
                    <span>
                      Patient is currently <strong>opted out</strong> of {CHANNEL_LABELS[selectedThread.channel]} under DPDP rules.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 text-[11px] px-2 py-0 border-amber-600 text-amber-700 hover:bg-amber-100 dark:text-amber-200 shrink-0"
                    disabled={consentMutation.isPending}
                    onClick={() => {
                      if (channelConsentRecord) {
                        consentMutation.mutate({ id: channelConsentRecord.id, isOptedOut: false })
                      }
                    }}
                  >
                    {consentMutation.isPending ? "Updating…" : "Opt-In Patient"}
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11.5px] font-semibold text-ink-3">Template:</span>
                  <select
                    value={selectedTemplateId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null
                      setSelectedTemplateId(id)
                      if (id) {
                        const found = activeTemplates.find((t) => t.id === id)
                        if (found) {
                          setComposerBody(found.body)
                        }
                      }
                      if (errorMessage) setErrorMessage(null)
                    }}
                    className="h-[28px] px-2 border border-border-strong rounded-control bg-surface text-[12px] text-ink-2 max-w-[200px]"
                  >
                    <option value="">-- Choose template --</option>
                    {activeTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({CHANNEL_LABELS[t.channel] ?? t.channel})
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap gap-1.5 ml-1">
                    {(activeTemplates.length > 0
                      ? activeTemplates.slice(0, 3).map((t) => ({ key: `t${t.id}`, label: t.name, body: t.body, id: t.id }))
                      : FALLBACK_QUICK_REPLIES.map((q) => ({ key: q.label, label: q.label, body: q.body, id: null }))
                    ).map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => {
                          setComposerBody(chip.body)
                          setSelectedTemplateId(chip.id)
                          setErrorMessage(null)
                        }}
                        className={`text-[12px] font-semibold px-2.5 py-1 rounded-chip border transition-colors ${
                          selectedTemplateId === chip.id
                            ? "border-brand bg-brand text-white"
                            : "border-border-strong text-ink-3 hover:border-brand hover:bg-brand-tint hover:text-brand"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button size="sm" variant="secondary" onClick={handleGenerateAiReply} disabled={aiMutation.isPending}>
                  {aiMutation.isPending ? "Generating…" : "✨ AI Auto-Reply"}
                </Button>
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-control bg-danger-bg border border-danger-border text-danger-text text-xs flex flex-col gap-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <div className="flex items-center gap-2">
                      <span>⚠️</span>
                      <span>{errorMessage}</span>
                    </div>
                    <button type="button" onClick={() => setErrorMessage(null)} className="text-danger-text hover:opacity-75 font-bold">✕</button>
                  </div>
                  {errorMessage.includes("opted out, no template, or no address") && (
                    <div className="flex items-center gap-2 pt-1 border-t border-danger-border/40 flex-wrap text-[11px]">
                      <span className="font-semibold text-ink-2">Resolve quickly:</span>
                      {activeTemplates.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const first = activeTemplates[0]
                            setSelectedTemplateId(first.id)
                            setComposerBody(first.body)
                            setErrorMessage(null)
                          }}
                          className="px-2 py-0.5 rounded bg-surface border border-border-strong text-ink-2 hover:border-brand hover:text-brand font-medium"
                        >
                          Attach Template ({activeTemplates[0].name})
                        </button>
                      )}
                      {channelConsentRecord?.is_opted_out && (
                        <button
                          type="button"
                          onClick={() => consentMutation.mutate({ id: channelConsentRecord.id, isOptedOut: false })}
                          className="px-2 py-0.5 rounded bg-surface border border-border-strong text-ink-2 hover:border-brand hover:text-brand font-medium"
                        >
                          Opt-In Patient
                        </button>
                      )}
                      {!channelConsentRecord && (
                        <button
                          type="button"
                          onClick={() =>
                            createConsentMutation.mutate({
                              patient: selectedThread.patient,
                              channel: selectedThread.channel,
                              purpose: "transactional",
                              is_opted_out: false,
                            })
                          }
                          className="px-2 py-0.5 rounded bg-surface border border-border-strong text-ink-2 hover:border-brand hover:text-brand font-medium"
                        >
                          Grant {CHANNEL_LABELS[selectedThread.channel]} Consent
                        </button>
                      )}
                      {isMissingAddress && (
                        <button
                          type="button"
                          onClick={() => navigate(`/patients/${selectedThread.patient}`)}
                          className="px-2 py-0.5 rounded bg-surface border border-border-strong text-ink-2 hover:border-brand hover:text-brand font-medium"
                        >
                          Add Mobile / Address
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  required
                  value={composerBody}
                  onChange={(e) => {
                    setComposerBody(e.target.value)
                    if (errorMessage) setErrorMessage(null)
                  }}
                  placeholder={`Type your ${CHANNEL_LABELS[selectedThread.channel]} message or click ✨ AI Auto-Reply…`}
                  className="flex-1 h-9 px-3 border border-border-strong rounded-control text-[13px] outline-none focus:border-brand"
                />
                <Button type="submit" variant="primary" disabled={sendMutation.isPending || !composerBody.trim()}>
                  {sendMutation.isPending ? "Sending…" : "Send"}
                </Button>
              </form>
            </div>
          </>
        )}
      </Card>

      {/* RIGHT — patient context / consent / suggested next step */}
      <div className="h-full flex flex-col gap-3.5 overflow-y-auto">
        {!selectedThread ? (
          <Card padded>
            <div className="text-[12.5px] text-ink-4">Select a thread to see patient context.</div>
          </Card>
        ) : (
          <>
            <Card padded>
              <Eyebrow>Patient context</Eyebrow>
              <div className="flex flex-col gap-2 text-[12.5px]">
                <div className="flex justify-between gap-2">
                  <span className="text-ink-4">Status</span>
                  <span className="font-semibold text-ink-2 text-right">
                    {latestEnquiry ? STAGE_LABELS[latestEnquiry.stage] : "No enquiry on file"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-ink-4">Mobile</span>
                  <span className={`font-semibold text-right ${patientMobile ? "text-ink-2" : "text-amber-600 font-bold"}`}>
                    {patientMobile || "Missing"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-ink-4">Email</span>
                  <span className={`font-semibold text-right ${patientEmail ? "text-ink-2" : "text-ink-4"}`}>
                    {patientEmail || "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-ink-4">Source</span>
                  <span className="text-ink-2 text-right">{latestEnquiry?.source ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-ink-4">Interest</span>
                  <span className="text-ink-2 text-right">
                    {latestEnquiry?.service_requested || (latestEnquiry?.department ? `Dept #${latestEnquiry.department}` : "—")}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-ink-4">Language</span>
                  <span className="text-ink-2 text-right">{(selectedPatientQuery.data?.preferred_language ?? "en").toUpperCase()}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-ink-4">First touch</span>
                  <span className="text-ink-2 text-right">{firstTouchIso ? new Date(firstTouchIso).toLocaleDateString() : "—"}</span>
                </div>
              </div>
            </Card>

            <Card padded>
              <div className="flex items-center justify-between mb-2">
                <Eyebrow>Consent</Eyebrow>
                <span className="text-[11px] text-ink-4">DPDP Act, 2023</span>
              </div>
              {consentQuery.isLoading && <LoadingState />}
              {!consentQuery.isLoading && consentRows.length === 0 && (
                <div className="text-[12px] text-ink-4 py-1">No consent records yet.</div>
              )}
              <div className="flex flex-col gap-2">
                {consentRows.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${c.is_opted_out ? "bg-danger" : "bg-success"}`} />
                      <span className="text-ink-2 truncate">
                        {CHANNEL_LABELS[c.channel] ?? c.channel} · {PURPOSE_LABELS[c.purpose] ?? c.purpose}
                      </span>
                    </div>
                    {c.is_opted_out ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-[22px] px-2 py-0 text-[11px] font-semibold border-emerald-500 text-emerald-600 hover:bg-emerald-50 shrink-0"
                        disabled={consentMutation.isPending}
                        onClick={() => consentMutation.mutate({ id: c.id, isOptedOut: false })}
                      >
                        Opt In
                      </Button>
                    ) : (
                      <button
                        type="button"
                        disabled={consentMutation.isPending}
                        onClick={() => consentMutation.mutate({ id: c.id, isOptedOut: true })}
                        className="text-[11px] text-ink-4 hover:text-danger hover:underline shrink-0"
                        title="Click to opt out patient"
                      >
                        Consented
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!channelConsentRecord && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3 w-full text-[11.5px] border-border-strong text-ink-2 hover:border-brand hover:text-brand"
                  disabled={createConsentMutation.isPending}
                  onClick={() =>
                    createConsentMutation.mutate({
                      patient: selectedThread.patient,
                      channel: selectedThread.channel,
                      purpose: "transactional",
                      is_opted_out: false,
                    })
                  }
                >
                  {createConsentMutation.isPending ? "Granting…" : `+ Grant ${CHANNEL_LABELS[selectedThread.channel]} Consent`}
                </Button>
              )}

              <div className="text-[11px] text-ink-5 mt-3 pt-3 border-t border-border-faint leading-relaxed">
                Consent capture, storage, and retention follow the Digital Personal Data Protection (DPDP) Act, 2023.
              </div>
            </Card>

            {nextStep && (
              <Card padded>
                <Eyebrow>Suggested next step</Eyebrow>
                <div className="text-[12.5px] text-ink-2 leading-relaxed">{nextStep.text}</div>
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-2.5 w-full"
                  disabled={!nextStep.replyBody}
                  onClick={() => setComposerBody(nextStep.replyBody)}
                >
                  Apply
                </Button>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
      )}
    </div>
  )
}
