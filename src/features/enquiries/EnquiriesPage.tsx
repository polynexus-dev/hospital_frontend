import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill } from "../../components/ui/Pill"
import { Avatar } from "../../components/ui/Avatar"
import { LoadingState } from "../../components/ui/QueryStates"
import { createEnquiry, listEnquiries, loseEnquiry, moveEnquiryStage } from "../../api/enquiries"
import { listUsers } from "../../api/accounts"
import type { Enquiry, EnquiryStage, EnquirySource } from "../../types/api"

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const STAGES: { key: EnquiryStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "scheduled", label: "Scheduled" },
  { key: "visited", label: "Visited" },
  { key: "completed", label: "Completed" },
  { key: "follow_up", label: "Follow-up" },
]

const SOURCES: EnquirySource[] = ["ivr", "whatsapp", "website", "walk_in", "referral", "google", "meta", "other"]

function NewEnquiryForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [mobile, setMobile] = useState("")
  const [source, setSource] = useState<EnquirySource>("walk_in")
  const [serviceRequested, setServiceRequested] = useState("")
  const [estimatedValue, setEstimatedValue] = useState("")

  const create = useMutation({
    mutationFn: () =>
      createEnquiry({
        name,
        mobile,
        source,
        service_requested: serviceRequested,
        ...(estimatedValue ? { estimated_value: estimatedValue } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold mb-3">New enquiry</div>
        <div className="flex flex-col gap-2.5">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px]" />
          <input placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px] font-mono" />
          <input placeholder="Service requested" value={serviceRequested} onChange={(e) => setServiceRequested(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px]" />
          <input
            placeholder="Estimated value (₹, optional)"
            type="number"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            className="h-9 px-3 border border-border-strong rounded-control text-[13px] font-mono"
          />
          <select value={source} onChange={(e) => setSource(e.target.value as EnquirySource)} className="h-9 px-3 border border-border-strong rounded-control text-[13px]">
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => create.mutate()} disabled={!name || !mobile || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function EnquiryCard({ enquiry, ownerName }: { enquiry: Enquiry; ownerName: string | null }) {
  const queryClient = useQueryClient()
  const currentIndex = STAGES.findIndex((s) => s.key === enquiry.stage)
  const nextStage = STAGES[currentIndex + 1]

  const move = useMutation({
    mutationFn: (stage: EnquiryStage) => moveEnquiryStage(enquiry.id, stage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enquiries"] }),
  })
  const lose = useMutation({
    mutationFn: () => loseEnquiry(enquiry.id, "Not interested"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enquiries"] }),
  })

  const slaBreached = enquiry.sla_due_at && new Date(enquiry.sla_due_at).getTime() < Date.now()

  return (
    <div className="bg-surface border border-border rounded-[5px] p-2.5 hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold leading-tight">{enquiry.name}</div>
        {ownerName && <Avatar name={ownerName} size={20} />}
      </div>
      {enquiry.service_requested && <div className="text-[12px] text-ink-3 mt-1">{enquiry.service_requested}</div>}
      <div className="text-[11.5px] text-ink-4 mt-0.5 font-mono">{enquiry.mobile}</div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <NeutralTag>{enquiry.source}</NeutralTag>
        {enquiry.duplicate_of && <NeutralTag>dup</NeutralTag>}
        {enquiry.urgency !== "normal" && <NeutralTag>{enquiry.urgency}</NeutralTag>}
        {enquiry.estimated_value && <NeutralTag>{INR.format(Number(enquiry.estimated_value))}</NeutralTag>}
        {slaBreached && <Pill tone="bad">SLA breached</Pill>}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        {nextStage && (
          <button
            onClick={() => move.mutate(nextStage.key)}
            disabled={move.isPending}
            className="text-[11px] font-semibold text-brand hover:underline"
          >
            → {nextStage.label}
          </button>
        )}
        <div className="flex-1" />
        <div className="text-[11px] text-ink-5">{relativeAge(enquiry.created_at)}</div>
        <button onClick={() => lose.mutate()} disabled={lose.isPending} className="text-[11px] text-ink-5 hover:text-danger-text">
          Mark lost
        </button>
      </div>
    </div>
  )
}

export function EnquiriesPage() {
  const [showNew, setShowNew] = useState(false)
  const [deptFilter, setDeptFilter] = useState<number | "all">("all")
  const [sourceFilter, setSourceFilter] = useState<EnquirySource | "all">("all")
  const [ownerFilter, setOwnerFilter] = useState<number | "all">("all")
  const [slaOnly, setSlaOnly] = useState(false)

  const enquiries = useQuery({ queryKey: ["enquiries"], queryFn: () => listEnquiries({ page_size: "200" }) })
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers })

  const ownerName = (id: number | null) => {
    if (!id) return null
    const u = users.data?.results.find((u) => u.id === id)
    return u ? u.first_name || u.email : `#${id}`
  }

  const all = enquiries.data?.results ?? []
  const open = all.filter((e) => e.stage !== "lost")

  const departments = useMemo(
    () => Array.from(new Set(open.map((e) => e.department).filter((d): d is number => d != null))),
    [open],
  )
  const owners = useMemo(
    () => Array.from(new Set(open.map((e) => e.assigned_to).filter((o): o is number => o != null))),
    [open],
  )
  const slaBreachedCount = open.filter((e) => e.sla_due_at && new Date(e.sla_due_at).getTime() < Date.now()).length

  const filtered = open.filter((e) => {
    if (deptFilter !== "all" && e.department !== deptFilter) return false
    if (sourceFilter !== "all" && e.source !== sourceFilter) return false
    if (ownerFilter !== "all" && e.assigned_to !== ownerFilter) return false
    if (slaOnly && !(e.sla_due_at && new Date(e.sla_due_at).getTime() < Date.now())) return false
    return true
  })

  const pipelineValue = filtered.reduce((sum, e) => sum + (e.estimated_value ? Number(e.estimated_value) : 0), 0)

  if (enquiries.isLoading) return <LoadingState />

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="h-[30px] px-2.5 border border-border-strong rounded-control bg-surface text-[12.5px] text-ink-3"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>Dept #{d}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as EnquirySource | "all")}
            className="h-[30px] px-2.5 border border-border-strong rounded-control bg-surface text-[12.5px] text-ink-3"
          >
            <option value="all">All sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="h-[30px] px-2.5 border border-border-strong rounded-control bg-surface text-[12.5px] text-ink-3"
          >
            <option value="all">Owner: anyone</option>
            {owners.map((o) => (
              <option key={o} value={o}>{ownerName(o)}</option>
            ))}
          </select>
          <button
            onClick={() => setSlaOnly((v) => !v)}
            className={`h-[30px] px-2.5 rounded-control text-[12.5px] font-semibold border ${
              slaOnly ? "bg-danger-bg border-danger-border text-danger-text" : "bg-surface border-border-strong text-ink-3"
            }`}
          >
            SLA breached · {slaBreachedCount}
          </button>
        </div>
        <div className="flex-1" />
        <div className="text-[12.5px] text-ink-4">{filtered.length} open · {INR.format(pipelineValue)} pipeline value</div>
        <Button variant="primary" onClick={() => setShowNew(true)}>New enquiry</Button>
      </div>

      <div className="grid grid-cols-6 gap-3 items-start min-w-[1020px]">
        {STAGES.map((stage) => {
          const cards = filtered.filter((e) => e.stage === stage.key)
          return (
            <div key={stage.key} className="bg-page border border-border rounded-card p-2.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="text-[12px] font-bold">{stage.label}</div>
                <div className="text-[11.5px] text-ink-4 font-semibold">{cards.length}</div>
              </div>
              {cards.map((e) => (
                <EnquiryCard key={e.id} enquiry={e} ownerName={ownerName(e.assigned_to)} />
              ))}
              {cards.length === 0 && <div className="text-[11.5px] text-ink-5 px-1">—</div>}
            </div>
          )
        })}
      </div>

      {showNew && <NewEnquiryForm onClose={() => setShowNew(false)} />}
    </div>
  )
}
