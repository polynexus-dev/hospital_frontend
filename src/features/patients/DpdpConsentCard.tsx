import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { ErrorState, LoadingState } from "../../components/ui/QueryStates"
import type { Tone } from "../../components/ui/tone"
import { extractApiError } from "../../api/client"
import { getConsentSummary, recordConsent, withdrawConsent } from "../../api/privacy"
import type { ConsentSummaryRow } from "../../api/privacy"

const STATUS: Record<string, { label: string; tone: Tone }> = {
  granted: { label: "✓ Granted", tone: "ok" },
  declined: { label: "✕ Declined", tone: "neutral" },
  withdrawn: { label: "↩ Withdrawn", tone: "warn" },
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

/** DPDP Act 2023: the patient's consent for each purpose, against the exact
 *  notice version shown to them, with one-step withdrawal. */
export function DpdpConsentCard({ patientId }: { patientId: number }) {
  const queryClient = useQueryClient()
  const [asking, setAsking] = useState<ConsentSummaryRow | null>(null)
  const [method, setMethod] = useState("written")
  const [givenBy, setGivenBy] = useState("self")
  const [guardian, setGuardian] = useState("")
  const [error, setError] = useState("")

  const summary = useQuery({ queryKey: ["dpdp-consents", patientId], queryFn: () => getConsentSummary(patientId) })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dpdp-consents", patientId] })
    queryClient.invalidateQueries({ queryKey: ["patient-consent", patientId] })  // messaging opt-outs follow consent
  }
  const onError = (e: unknown) => setError(extractApiError(e))

  const record = useMutation({
    mutationFn: (status: "granted" | "declined") =>
      recordConsent({ patient: patientId, notice: asking!.current_notice!.id, status, method, given_by: givenBy, guardian_name: guardian }),
    onSuccess: () => { setAsking(null); setError(""); refresh() },
    onError,
  })
  const withdraw = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => withdrawConsent(id, reason),
    onSuccess: refresh,
    onError,
  })

  const start = (row: ConsentSummaryRow) => {
    setAsking(row)
    setMethod("written")
    setGivenBy("self")
    setGuardian("")
    setError("")
  }

  return (
    <Card padded>
      <Eyebrow>Consent for use of personal data (DPDP)</Eyebrow>
      <p className="text-[12px] text-ink-4 mb-3">
        Read the notice to the patient (or give them a copy), then record their answer. Withdrawing is as easy as giving consent.
      </p>
      {error && <div className="mb-2 text-[12.5px] text-danger-text">{error}</div>}
      {summary.isLoading ? <LoadingState /> : summary.isError ? <ErrorState message="Couldn't load consents." /> : (
        <div className="divide-y divide-border-faint border border-border-faint rounded-control">
          {summary.data!.map((row) => {
            const consent = row.consent
            const state = consent ? STATUS[consent.status] : null
            return (
              <div key={row.purpose} className="px-3 py-2.5 text-[13px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{row.purpose_label}</div>
                    <div className="text-[11.5px] text-ink-4">
                      {consent
                        ? `${consent.status === "withdrawn" && consent.withdrawn_at ? `Withdrawn ${date(consent.withdrawn_at)}` : `Recorded ${date(consent.created_at)}`} · notice v${consent.notice_version} · ${consent.method}${consent.given_by === "guardian" ? ` · by ${consent.guardian_name}` : ""}${consent.captured_by_name ? ` · ${consent.captured_by_name}` : ""}`
                        : row.current_notice ? "Not asked yet" : "No notice published for this purpose"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {state && <Pill tone={state.tone}>{state.label}</Pill>}
                    {row.outdated && <Pill tone="warn">⚠ Notice changed: ask again</Pill>}
                    {row.current_notice && (!consent || consent.status !== "granted" || row.outdated) && (
                      <Button size="sm" variant="secondary" onClick={() => start(row)}>{consent ? "Ask again" : "Record"}</Button>
                    )}
                    {consent?.status === "granted" && (
                      <Button size="sm" variant="secondary" disabled={withdraw.isPending}
                        onClick={() => { const reason = window.prompt(`Withdraw consent for "${row.purpose_label}"? Reason (optional):`); if (reason !== null) withdraw.mutate({ id: consent.id, reason }) }}>
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>

                {asking?.purpose === row.purpose && row.current_notice && (
                  <div className="mt-2.5 rounded-control border border-border bg-page p-3">
                    <div className="text-[12px] font-semibold mb-1">{row.current_notice.title} (v{row.current_notice.version})</div>
                    <div className="text-[12.5px] text-ink-2 whitespace-pre-wrap mb-3">{row.current_notice.body}</div>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="text-[11.5px] text-ink-3">How
                        <select className="block mt-1 h-8 px-2 border border-border-strong rounded-control text-[12.5px] bg-surface" value={method} onChange={(e) => setMethod(e.target.value)}>
                          <option value="written">Signed form</option>
                          <option value="digital">Digital (tablet/OTP)</option>
                          <option value="verbal">Verbal, witnessed by staff</option>
                        </select>
                      </label>
                      <label className="text-[11.5px] text-ink-3">Given by
                        <select className="block mt-1 h-8 px-2 border border-border-strong rounded-control text-[12.5px] bg-surface" value={givenBy} onChange={(e) => setGivenBy(e.target.value)}>
                          <option value="self">The patient</option>
                          <option value="guardian">Parent or lawful guardian</option>
                          <option value="nominee">Nominee</option>
                        </select>
                      </label>
                      {givenBy !== "self" && (
                        <label className="text-[11.5px] text-ink-3">Name
                          <input className="block mt-1 h-8 px-2 border border-border-strong rounded-control text-[12.5px] bg-surface" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
                        </label>
                      )}
                      <div className="flex gap-1.5 ml-auto">
                        <Button size="sm" variant="primary" disabled={record.isPending} onClick={() => record.mutate("granted")}>Patient agrees</Button>
                        <Button size="sm" variant="secondary" disabled={record.isPending} onClick={() => record.mutate("declined")}>Declines</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
