import { useQuery } from "@tanstack/react-query"
import type { WorkflowStep } from "../../api/workflows"
import { listTemplates } from "../../api/communications"

const input = "px-2.5 py-1.5 bg-white border border-border-strong rounded-md text-[12.5px]"

const CONDITION_FIELDS: { value: string; label: string; options?: string[] }[] = [
  { value: "stage", label: "Enquiry stage (now)", options: ["new", "contacted", "scheduled", "visited", "completed", "follow_up", "lost"] },
  { value: "to_stage", label: "Moved to stage", options: ["new", "contacted", "scheduled", "visited", "completed", "follow_up", "lost"] },
  { value: "from_stage", label: "Moved from stage", options: ["new", "contacted", "scheduled", "visited", "completed", "follow_up", "lost"] },
  { value: "source", label: "Source", options: ["ivr", "whatsapp", "website", "walk_in", "referral", "google", "meta", "other"] },
  { value: "urgency", label: "Urgency", options: ["low", "normal", "high", "urgent"] },
  { value: "score", label: "Lead score (0–100)" },
  { value: "department", label: "Department name" },
  { value: "service_requested", label: "Service requested" },
  { value: "assigned", label: "Has an owner", options: ["true", "false"] },
  { value: "contacted", label: "Has been contacted", options: ["true", "false"] },
  { value: "is_patient", label: "Is a registered patient", options: ["true", "false"] },
]

const OPS: { value: string; label: string }[] = [
  { value: "eq", label: "is" }, { value: "ne", label: "is not" }, { value: "in", label: "is one of (comma-separated)" },
  { value: "gte", label: "at least" }, { value: "lte", label: "at most" }, { value: "contains", label: "contains" },
  { value: "is_set", label: "is set" }, { value: "not_set", label: "is empty" },
]

const WAITS = [
  { label: "15 minutes", minutes: 15 }, { label: "1 hour", minutes: 60 }, { label: "4 hours", minutes: 240 },
  { label: "1 day", minutes: 1440 }, { label: "2 days", minutes: 2880 }, { label: "1 week", minutes: 10080 },
]

/** The settings of one workflow step, in plain words. */
export function StepConfigEditor({ step, onChange }: { step: WorkflowStep; onChange: (config: Record<string, any>) => void }) {
  const cfg = step.config || {}
  const set = (patch: Record<string, any>) => onChange({ ...cfg, ...patch })
  const templates = useQuery({
    queryKey: ["message-templates-for-workflows"],
    queryFn: () => listTemplates({ page_size: "200" }),
    enabled: step.action_type === "send_whatsapp" || step.action_type === "send_sms",
  })

  if (step.step_type === "trigger") return null

  if (step.step_type === "condition") {
    const legacy = !cfg.field && cfg.condition
    const field = CONDITION_FIELDS.find((f) => f.value === cfg.field)
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[12.5px]">
        <span className="text-ink-3">Continue only if</span>
        <select aria-label="Field" className={input} value={cfg.field || ""} onChange={(e) => set({ field: e.target.value, op: cfg.op || "eq", condition: undefined })}>
          <option value="">{legacy ? `(old rule: ${cfg.condition})` : "choose…"}</option>
          {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select aria-label="Operator" className={input} value={cfg.op || "eq"} onChange={(e) => set({ op: e.target.value })}>
          {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {!["is_set", "not_set"].includes(cfg.op) && (
          field?.options && ["eq", "ne"].includes(cfg.op || "eq") ? (
            <select aria-label="Value" className={input} value={cfg.value ?? ""} onChange={(e) => set({ value: e.target.value })}>
              <option value="">choose…</option>
              {field.options.map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
            </select>
          ) : (
            <input aria-label="Value" className={`${input} w-40`} value={cfg.value ?? ""} onChange={(e) => set({ value: e.target.value })} />
          )
        )}
      </div>
    )
  }

  if (step.action_type === "wait_delay") {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[12.5px]">
        <span className="text-ink-3">Wait</span>
        <select aria-label="Wait" className={input} value={WAITS.some((w) => w.minutes === Number(cfg.delay_minutes)) ? cfg.delay_minutes : "custom"}
          onChange={(e) => e.target.value !== "custom" && set({ delay_minutes: Number(e.target.value) })}>
          {WAITS.map((w) => <option key={w.minutes} value={w.minutes}>{w.label}</option>)}
          <option value="custom">custom (minutes)…</option>
        </select>
        <input aria-label="Minutes" type="number" min={1} className={`${input} w-24`} value={cfg.delay_minutes ?? 15} onChange={(e) => set({ delay_minutes: Number(e.target.value) })} />
        <span className="text-ink-4">minutes; the next steps then check what's true at that time.</span>
      </div>
    )
  }

  if (step.action_type === "send_whatsapp" || step.action_type === "send_sms") {
    const channel = step.action_type === "send_whatsapp" ? "whatsapp" : "sms"
    const purposes = [...new Set((templates.data?.results ?? []).filter((t) => t.channel === channel).map((t) => t.purpose))].sort()
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[12.5px]">
        <span className="text-ink-3">Message template</span>
        <select aria-label="Message template" className={input} value={cfg.purpose || cfg.template || ""} onChange={(e) => set({ purpose: e.target.value, template: undefined })}>
          <option value="">choose…</option>
          {[...new Set([...purposes, "enquiry_follow_up", "no_show_recall"])].map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
        </select>
        {channel === "whatsapp" && (
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={cfg.fallback_sms !== false} onChange={(e) => set({ fallback_sms: e.target.checked })} /> SMS if WhatsApp fails</label>
        )}
        <span className="text-ink-4 basis-full">Sent to the patient, or to the lead if they aren't registered yet. Lost leads and opted-out numbers are skipped.</span>
      </div>
    )
  }

  if (step.action_type === "create_task") {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[12.5px]">
        <input aria-label="Task title" className={`${input} min-w-[260px] flex-1`} placeholder="e.g. Call enquiry #{enquiry_id} today" value={cfg.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
        <select aria-label="Assign to" className={input} value={cfg.assign_to || "owner"} onChange={(e) => set({ assign_to: e.target.value })}>
          <option value="owner">the enquiry's owner</option>
          <option value="manager">the escalation manager</option>
        </select>
        <select aria-label="Priority" className={input} value={cfg.priority || "normal"} onChange={(e) => set({ priority: e.target.value })}>
          {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-ink-3">due in</span>
        <input aria-label="Due in minutes" type="number" min={5} className={`${input} w-20`} value={cfg.due_in_minutes ?? 60} onChange={(e) => set({ due_in_minutes: Number(e.target.value) })} />
        <span className="text-ink-4">min. Use {"{enquiry_id}"}, {"{source}"}, {"{stage}"}; don't put names in titles.</span>
      </div>
    )
  }

  if (step.action_type === "escalate") {
    return (
      <div className="mt-2 text-[12.5px]">
        <input aria-label="Escalation note" className={`${input} w-full`} placeholder="What the manager should do" value={cfg.note ?? ""} onChange={(e) => set({ note: e.target.value })} />
      </div>
    )
  }
  return null
}
