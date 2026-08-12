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
  listConsent,
  listMessages,
  listRecentThreads,
  listTemplates,
  listThreads,
  markThreadRead,
  postInteractiveChatAction,
  sendMessage,
} from "../../api/communications"
import { createEnquiry, listEnquiries } from "../../api/enquiries"
import { getPatient, listPatients } from "../../api/patients"
import { listUsers } from "../../api/accounts"
import { useAuthStore } from "../../store/auth"
import { slaInfo } from "../../lib/sla"
import type { Channel, ConsentOptOut, Enquiry, EnquiryStage, Thread } from "../../types/api"
import type { Tone } from "../../components/ui/tone"

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
  const [composerBody, setComposerBody] = useState("")

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
    queryKey: ["templates", selectedThread?.channel],
    queryFn: () => listTemplates({ channel: selectedThread!.channel }),
    enabled: !!selectedThread,
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

  const activeTemplates = templatesQuery.data?.results.filter((t) => t.is_active) ?? []
  const filteredMessages = (messagesQuery.data?.results ?? []).filter((m) => m.channel === selectedThread?.channel)
  const consentRows = consentQuery.data?.results ?? []

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
    if (!selectedThread || !composerBody.trim()) return
    sendMutation.mutate({
      patient: selectedThread.patient,
      channel: selectedThread.channel,
      purpose: "outreach",
      context: { body: composerBody },
    })
  }

  const handleGenerateAiReply = () => {
    if (!selectedThread) return
    aiMutation.mutate({ action: "book_opd", language: selectedPatientQuery.data?.preferred_language || "en" })
  }

  return (
    <div className="grid grid-cols-[268px_minmax(380px,1fr)_248px] gap-3 h-[calc(100vh-130px)] min-w-[940px]">
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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-wrap gap-1.5">
                  {(activeTemplates.length > 0
                    ? activeTemplates.map((t) => ({ key: `t${t.id}`, label: t.name, body: t.body }))
                    : FALLBACK_QUICK_REPLIES.map((q) => ({ key: q.label, label: q.label, body: q.body }))
                  ).map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setComposerBody(chip.body)}
                      className="text-[12px] font-semibold px-2.5 py-1.5 rounded-chip border border-border-strong text-ink-3 hover:border-brand hover:bg-brand-tint hover:text-brand"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="secondary" onClick={handleGenerateAiReply} disabled={aiMutation.isPending}>
                  {aiMutation.isPending ? "Generating…" : "✨ AI Auto-Reply"}
                </Button>
              </div>
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  required
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
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
              <Eyebrow>Consent</Eyebrow>
              {consentQuery.isLoading && <LoadingState />}
              {!consentQuery.isLoading && consentRows.length === 0 && <EmptyState message="No consent records on file." />}
              <div className="flex flex-col gap-2">
                {consentRows.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-[12.5px]">
                    <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${c.is_opted_out ? "bg-border-strong" : "bg-success"}`} />
                    <span className="text-ink-2 truncate">
                      {CHANNEL_LABELS[c.channel]} · {PURPOSE_LABELS[c.purpose]}
                    </span>
                    <span className="ml-auto text-[11px] text-ink-4 shrink-0">{c.is_opted_out ? "Opted out" : "Consented"}</span>
                  </div>
                ))}
              </div>
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
  )
}
