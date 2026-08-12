import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Avatar } from "../../components/ui/Avatar"
import { Button } from "../../components/ui/Button"
import { NeutralTag } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"
import { lookupPatientByMobile, getPatientTimeline } from "../../api/patients"
import { listCalls, operatorProductivity } from "../../api/telephony"
import { listHisBilling } from "../../api/integrations"
import { listTemplates } from "../../api/communications"
import { api } from "../../api/client"
import { useAuthStore } from "../../store/auth"
import type { Call, PatientLookup } from "../../types/api"

const CALL_REASONS: { value: string; label: string }[] = [
  { value: "opd", label: "OPD" },
  { value: "surgical", label: "Surgical" },
  { value: "second_opinion", label: "Second opinion" },
  { value: "billing", label: "Billing / TPA" },
  { value: "report", label: "Report" },
  { value: "complaint", label: "Complaint" },
  { value: "other", label: "Other" },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function ConsolePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [numberInput, setNumberInput] = useState("")
  const [activeNumber, setActiveNumber] = useState("")
  const [reason, setReason] = useState(CALL_REASONS[0].value)
  const [notes, setNotes] = useState("")

  const recentCalls = useQuery({
    queryKey: ["calls", "recent"],
    queryFn: () => listCalls({ ordering: "-started_at" }),
  })

  const myShift = useQuery({
    queryKey: ["calls", "operator-productivity", "today"],
    queryFn: () => operatorProductivity({ start: todayIso() }),
  })
  const myShiftRow = myShift.data?.find((r) => r.operator_id === user?.id)

  const lookup = useQuery({
    queryKey: ["patients", "lookup", activeNumber],
    queryFn: () => lookupPatientByMobile(activeNumber),
    enabled: !!activeNumber,
  })

  const patient: PatientLookup | undefined = lookup.data?.[0]

  const timeline = useQuery({
    queryKey: ["patients", patient?.id, "timeline"],
    queryFn: () => getPatientTimeline(patient!.id),
    enabled: !!patient,
  })

  const billing = useQuery({
    queryKey: ["his-billing", patient?.id],
    queryFn: () => listHisBilling(patient!.id),
    enabled: !!patient,
  })
  const outstandingDues = billing.data?.results.reduce((sum, r) => sum + Number(r.outstanding_amount), 0) ?? 0

  const templates = useQuery({
    queryKey: ["templates", "whatsapp", reason],
    queryFn: () => listTemplates({ channel: "whatsapp" }),
    enabled: !!patient,
  })
  const matchingTemplate = templates.data?.results.find((t) => t.is_active && t.purpose.includes(reason))
    ?? templates.data?.results.find((t) => t.is_active)

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const logCall = useMutation({
    mutationFn: () =>
      api.post<Call>("/calls/", {
        direction: "inbound",
        status: "answered",
        from_number: activeNumber,
        patient: patient?.id ?? null,
        call_reason: reason,
        notes,
        started_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      setNotes("")
      showToast(`Call log saved successfully for ${patient?.full_name || activeNumber} ✓`)
      queryClient.invalidateQueries({ queryKey: ["calls", "recent"] })
      if (patient) queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "timeline"] })
    },
  })

  const raiseCallback = useMutation({
    mutationFn: () =>
      api.post("/callback-tasks/", {
        phone_number: activeNumber,
        patient: patient?.id ?? null,
        sla_due_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      }),
    onSuccess: () => {
      showToast(`15-Minute SLA Callback Task Raised for ${activeNumber} ✓`)
    },
  })


  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveNumber(numberInput.trim())
  }

  return (
    <div className="space-y-3 min-w-[980px]">
      {toastMessage && (
        <div className="bg-success text-white font-semibold px-4 py-2.5 rounded-control text-[13px] flex justify-between items-center shadow-lg">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-white hover:opacity-75">✕</button>
        </div>
      )}
      <div className="grid grid-cols-[248px_minmax(430px,1fr)_262px] gap-3 items-start">

      <div className="flex flex-col gap-3.5">
        <Card padded>
          <Eyebrow>My shift</Eyebrow>
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
            <div>
              <div className="text-[21px] font-semibold tracking-[-.02em]">{myShiftRow?.calls_handled ?? "—"}</div>
              <div className="text-[11.5px] text-ink-4">Calls handled</div>
            </div>
            <div>
              <div className="text-[21px] font-semibold tracking-[-.02em]">
                {myShiftRow?.avg_duration_seconds ? `${Math.round(myShiftRow.avg_duration_seconds)}s` : "—"}
              </div>
              <div className="text-[11.5px] text-ink-4">Avg talk time</div>
            </div>
            <div>
              <div className="text-[21px] font-semibold tracking-[-.02em] text-success">{myShiftRow?.answered ?? "—"}</div>
              <div className="text-[11.5px] text-ink-4">Answered</div>
            </div>
            <div>
              <div className="text-[21px] font-semibold tracking-[-.02em]">{myShiftRow?.missed ?? "—"}</div>
              <div className="text-[11.5px] text-ink-4">Missed</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="px-3.5 py-2.5 border-b border-border-soft flex items-center justify-between">
            <Eyebrow>Recent calls</Eyebrow>
          </div>
          {recentCalls.isLoading && <LoadingState />}
          {recentCalls.data?.results.slice(0, 10).map((call) => (
            <button
              key={call.id}
              onClick={() => {
                setActiveNumber(call.from_number)
                setNumberInput(call.from_number)
              }}
              className="w-full text-left px-3.5 py-2.5 border-b border-border-faint hover:bg-page flex flex-col gap-0.5"
            >
              <div className="flex justify-between items-center gap-2">
                <span className="text-[13px] font-semibold font-mono truncate">{call.from_number}</span>
                <NeutralTag>{call.status}</NeutralTag>
              </div>
              <div className="text-[11px] text-ink-4">{new Date(call.started_at).toLocaleString()}</div>
            </button>
          ))}
          {recentCalls.data?.results.length === 0 && <div className="px-3.5 py-3 text-[12.5px] text-ink-4">No calls logged yet.</div>}
        </Card>
      </div>

      <div className="flex flex-col gap-3.5">
        <Card>
          <div className="p-4 border-b border-border-soft space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-4">
              <span className="font-semibold">Simulate Inbound Caller:</span>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: "Asha Patil", num: "9823012345" },
                  { label: "Sunita Pawar", num: "9890998877" },
                  { label: "New Caller", num: "9123456789" },
                ].map((preset) => (
                  <button
                    key={preset.num}
                    type="button"
                    onClick={() => {
                      setNumberInput(preset.num)
                      setActiveNumber(preset.num)
                    }}
                    className="px-2 py-1 text-[11.5px] bg-chip-bg hover:bg-brand-tint text-chip-text font-semibold rounded-tag border border-border-strong"
                  >
                    {preset.label} ({preset.num})
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleLookup} className="flex gap-2">
              <input
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                placeholder="Enter caller's mobile number"
                className="flex-1 h-9 px-3 border border-border-strong rounded-control text-[13px] font-mono outline-none focus:border-brand"
              />
              <Button type="submit" variant="primary">Screen-pop</Button>
            </form>
          </div>


          {activeNumber && (
            <>
              <div className="p-4 flex gap-4 border-b border-border-soft">
                {patient ? (
                  <>
                    <Avatar name={patient.full_name} size={46} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <div className="text-[19px] font-semibold">{patient.full_name}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <NeutralTag>Patient #{patient.id}</NeutralTag>
                        <NeutralTag>{patient.preferred_language}</NeutralTag>
                        <NeutralTag>{patient.mobile}</NeutralTag>
                        {patient.insurance_provider && <NeutralTag>{patient.insurance_provider}</NeutralTag>}
                        {outstandingDues > 0 && <NeutralTag>Dues ₹{outstandingDues.toLocaleString("en-IN")}</NeutralTag>}
                        {patient.referring_doctor_name && <NeutralTag>Ref: {patient.referring_doctor_name}</NeutralTag>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${patient.id}`)}>
                      Open 360
                    </Button>
                  </>
                ) : lookup.isFetching ? (
                  <div className="text-[13px] text-ink-4">Looking up {activeNumber}…</div>
                ) : (
                  <div className="text-[13px] text-ink-4">
                    No patient on file for {activeNumber}. You can still log this call — a new enquiry can be created from the
                    Enquiries screen.
                  </div>
                )}
              </div>

              {patient && (
                <div className="p-4 border-b border-border-soft">
                  <Eyebrow>Recent interactions</Eyebrow>
                  <div className="flex flex-col gap-2">
                    {timeline.data?.slice(0, 5).map((ev) => (
                      <div key={ev.id} className="flex gap-2.5 items-start">
                        <NeutralTag>{ev.event_type}</NeutralTag>
                        <div className="flex-1 min-w-0 text-[13px] leading-relaxed">{ev.summary}</div>
                        <div className="text-[11.5px] text-ink-5 flex-none">
                          {new Date(ev.occurred_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                    {timeline.data?.length === 0 && <div className="text-[12.5px] text-ink-4">No prior interactions.</div>}
                  </div>
                </div>
              )}

              <div className="p-4">
                <Eyebrow>Call reason</Eyebrow>
                <div className="flex flex-wrap gap-1.5 mb-3.5">
                  {CALL_REASONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setReason(r.value)}
                      className={`text-[12.5px] font-semibold px-2.5 py-1.5 rounded-chip border ${
                        reason === r.value ? "border-brand bg-brand-tint text-brand" : "border-border-strong text-ink-3"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <Eyebrow>Notes</Eyebrow>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-border rounded-control p-2.5 text-[13px] leading-relaxed outline-none focus:border-brand mb-3"
                  placeholder="What did the caller ask for?"
                />
                <Button variant="primary" className="w-full" onClick={() => logCall.mutate()} disabled={!activeNumber || logCall.isPending}>
                  {logCall.isPending ? "Saving…" : "Save call log"}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-3.5">
        <Card padded>
          <Eyebrow>Do it on this call</Eyebrow>
          <div className="flex flex-col gap-1.5">
            <button
              disabled={!patient}
              onClick={() => navigate(`/appointments?patient=${patient?.id}`)}
              className="border border-border-strong rounded-control px-2.5 py-2 text-[13px] font-semibold text-brand text-left hover:bg-brand-tint disabled:opacity-40"
            >
              Book appointment
            </button>
            <button
              disabled={!patient}
              onClick={() => navigate(`/inbox?patient=${patient?.id}`)}
              className="border border-border-strong rounded-control px-2.5 py-2 text-[13px] font-semibold text-brand text-left hover:bg-brand-tint disabled:opacity-40"
            >
              Send WhatsApp — slot options
            </button>
            <button
              disabled={!patient || outstandingDues <= 0}
              onClick={() => navigate(`/inbox?patient=${patient?.id}`)}
              className="border border-border-strong rounded-control px-2.5 py-2 text-[13px] font-semibold text-brand text-left hover:bg-brand-tint disabled:opacity-40"
            >
              Share payment link{outstandingDues > 0 ? ` · ₹${outstandingDues.toLocaleString("en-IN")}` : ""}
            </button>
            <button
              disabled={!activeNumber}
              onClick={() => raiseCallback.mutate()}
              className="border border-border-strong rounded-control px-2.5 py-2 text-[13px] font-semibold text-brand text-left hover:bg-brand-tint disabled:opacity-40"
            >
              {raiseCallback.isSuccess ? "Callback task raised ✓" : "Raise callback task"}
            </button>
          </div>
        </Card>

        {patient && (
          <Card padded>
            <Eyebrow>Template preview</Eyebrow>
            {matchingTemplate ? (
              <>
                <div className="border border-border rounded-control bg-page p-2.5 text-[13px] leading-relaxed text-ink-2 whitespace-pre-wrap">
                  {matchingTemplate.body}
                </div>
                <div className="text-[11.5px] text-ink-4 mt-2">{matchingTemplate.name} · {matchingTemplate.language}</div>
              </>
            ) : (
              <div className="text-[12px] text-ink-4">No active WhatsApp template configured for this reason yet.</div>
            )}
          </Card>
        )}

        <Card padded>
          <Eyebrow>Recording & consent</Eyebrow>
          {(() => {
            const lastCall = recentCalls.data?.results.find((c) => c.from_number === activeNumber)
            if (!lastCall) {
              return (
                <div className="text-[12px] text-ink-3 leading-relaxed">
                  Recording and consent capture happen at the telephony provider once one is wired up (see backend
                  apps.telephony.adapters). Manual call logs above are audit-logged automatically.
                </div>
              )
            }
            return (
              <div className="flex flex-col gap-2 text-[12.5px]">
                <div className="flex items-center gap-2">
                  <div className={`w-[7px] h-[7px] rounded-full ${lastCall.consent_recorded ? "bg-success" : "bg-border-strong"}`} />
                  <span className="text-ink-3">{lastCall.consent_recorded ? "Consent recorded" : "No consent on file"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-[7px] h-[7px] rounded-full ${lastCall.recording_url ? "bg-success" : "bg-border-strong"}`} />
                  <span className="text-ink-3">{lastCall.recording_url ? "Recording available" : "No recording on file"}</span>
                </div>
                <div className="text-[11.5px] text-ink-4">Retention 180 days per DPDP policy. Audit-logged.</div>
              </div>
            )
          })()}
        </Card>
      </div>
    </div>
    </div>
  )
}

