import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/QueryStates"
import { ApiError, triggerBlobDownload } from "../../api/client"
import {
  approveLicenseRequest, blockSaaSStaff, cancelLicenseRequest, downloadLicense, listLicenseRequests, listSaaSStaff,
  rejectLicenseRequest, setLicenceRight, unblockSaaSStaff,
} from "../../api/saas"
import { useAuthStore } from "../../store/auth"
import type { LicenseRequest, SaaSStaff } from "../../types/api"

function errorText(err: unknown) {
  if (err instanceof ApiError && err.body && typeof err.body === "object") {
    const body = err.body as Record<string, unknown>
    if (typeof body.detail === "string") return body.detail
    return Object.values(body).map((v) => (Array.isArray(v) ? v.join(" ") : String(v))).join(" ")
  }
  return "Something went wrong."
}

/** Every licence step needs a fresh code from the authenticator app. */
function askOtp(action: string) {
  const code = window.prompt(`${action}\n\nEnter the current 6-digit code from your authenticator app:`)?.trim()
  return code && /^\d{6}$/.test(code) ? code : null
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

function terms(r: LicenseRequest) {
  const p = r.params
  const machine = !p.machine_fingerprint || p.machine_fingerprint === "*" ? "any machine" : `${p.machine_fingerprint.slice(0, 12)}…`
  return `${p.duration_days} days · ${p.max_users || "∞"} users · ${p.max_beds || "∞"} beds · ${p.features.length} features · ${machine}`
}

const REQUEST_TONE = { pending: "warn", approved: "ok", rejected: "bad", cancelled: "neutral" } as const

/** Licence requests: SaaS Owners approve or reject; licence managers see their own. */
export function LicenceRequestsPanel() {
  const queryClient = useQueryClient()
  const isOwner = useAuthStore((s) => s.user?.licence_role === "approver")
  const [showAll, setShowAll] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const requests = useQuery({
    queryKey: ["saas-licence-requests", showAll],
    queryFn: () => listLicenseRequests(showAll ? "" : "pending"),
  })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["saas-licence-requests"] })
    queryClient.invalidateQueries({ queryKey: ["saas-all-licences"] })
  }
  const onError = (err: unknown) => setMessage({ ok: false, text: errorText(err) })

  const approve = useMutation({
    mutationFn: ({ id, otp }: { id: number; otp: string }) => approveLicenseRequest(id, otp),
    onSuccess: async ({ license }) => {
      setMessage({ ok: true, text: `${license.license_id} signed and downloaded. Send the file to the hospital.` })
      refresh()
      triggerBlobDownload(await downloadLicense(license.id), `${license.license_id}.lic`)
    },
    onError,
  })
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => rejectLicenseRequest(id, note),
    onSuccess: () => { setMessage({ ok: true, text: "Request rejected." }); refresh() },
    onError,
  })
  const cancel = useMutation({ mutationFn: cancelLicenseRequest, onSuccess: refresh, onError })

  const rows = requests.data?.results ?? []

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="text-[13px] font-semibold">Licence requests</div>
          <div className="text-[12px] text-ink-4">
            {isOwner
              ? "Nothing is signed until a SaaS Owner approves it with a 2FA code. Check the hospital has paid first."
              : "Your requests. A SaaS Owner approves each one before the licence exists."}
          </div>
        </div>
        <Button size="sm" variant={showAll ? "primary" : "secondary"} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Showing all" : "Pending only"}
        </Button>
      </CardHeader>
      {message && (
        <div className={`mx-3.5 mt-3 rounded-control px-3 py-2 text-[12px] font-semibold ${message.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
          {message.text}
        </div>
      )}
      <div className="p-3.5 overflow-x-auto">
        {requests.isLoading ? <LoadingState /> : requests.isError ? <ErrorState message="Couldn't load requests." /> : rows.length === 0 ? (
          <EmptyState message={showAll ? "No requests yet." : "Nothing waiting for approval."} />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-4 border-b border-border">
                <th className="py-2 pr-3 font-semibold">Hospital</th>
                <th className="py-2 pr-3 font-semibold">Terms</th>
                <th className="py-2 pr-3 font-semibold">Requested by</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border-soft align-top">
                  <td className="py-2.5 pr-3 font-semibold">{r.hospital_name}</td>
                  <td className="py-2.5 pr-3 text-[12px]">{terms(r)}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-mono text-[12px]">{r.requested_by_code ?? "—"}</div>
                    <div className="text-[11px] text-ink-4">{r.requested_by_email} · {date(r.created_at)}</div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Pill tone={REQUEST_TONE[r.status]}>{r.status}</Pill>
                    {r.license_id && <div className="font-mono text-[11px] mt-1">{r.license_id}</div>}
                    {r.decided_by_code && <div className="text-[11px] text-ink-4">by {r.decided_by_code}{r.decision_note ? ` — ${r.decision_note}` : ""}</div>}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-1.5">
                        {isOwner && (
                          <>
                            <Button size="sm" variant="primary" disabled={approve.isPending}
                              onClick={() => { const otp = askOtp(`Approve and sign a licence for ${r.hospital_name}?`); if (otp) approve.mutate({ id: r.id, otp }) }}>
                              Approve
                            </Button>
                            <Button size="sm" variant="secondary" disabled={reject.isPending}
                              onClick={() => { const note = window.prompt("Reason for rejecting (the requester sees this):"); if (note !== null) reject.mutate({ id: r.id, note }) }}>
                              Reject
                            </Button>
                          </>
                        )}
                        {!isOwner && (
                          <Button size="sm" variant="secondary" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>Cancel</Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}

/** SaaS Owners: who may request licences, and blocking staff who leave. */
export function LicenceTeamPanel() {
  const queryClient = useQueryClient()
  const me = useAuthStore((s) => s.user?.id)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const staff = useQuery({ queryKey: ["saas-staff"], queryFn: listSaaSStaff })
  const done = (text: string) => { setMessage({ ok: true, text }); queryClient.invalidateQueries({ queryKey: ["saas-staff"] }) }
  const onError = (err: unknown) => setMessage({ ok: false, text: errorText(err) })

  const right = useMutation({
    mutationFn: ({ s, grant, otp }: { s: SaaSStaff; grant: boolean; otp: string }) => setLicenceRight(s.id, grant, otp),
    onSuccess: (s) => done(`${s.staff_code} ${s.can_issue_licenses ? "can now request licences" : "can no longer request licences"}.`),
    onError,
  })
  const block = useMutation({
    mutationFn: ({ s, reason, otp }: { s: SaaSStaff; reason: string; otp: string }) => blockSaaSStaff(s.id, reason, otp),
    onSuccess: (s) => done(`${s.staff_code} blocked: signed out everywhere, licence right removed, pending requests cancelled.`),
    onError,
  })
  const unblock = useMutation({ mutationFn: (s: SaaSStaff) => unblockSaaSStaff(s.id), onSuccess: (s) => done(`${s.staff_code} unblocked. Licence right stays off until you grant it again.`), onError })

  const rows = staff.data?.results ?? []

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="text-[13px] font-semibold">Licence team</div>
          <div className="text-[12px] text-ink-4">
            Polynexus staff and their permanent codes. Only people you allow here can request licences; each code is printed in the licences they request.
            When someone leaves, Block them — their sessions end immediately.
          </div>
        </div>
      </CardHeader>
      {message && (
        <div className={`mx-3.5 mt-3 rounded-control px-3 py-2 text-[12px] font-semibold ${message.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
          {message.text}
        </div>
      )}
      <div className="p-3.5 overflow-x-auto">
        {staff.isLoading ? <LoadingState /> : staff.isError ? <ErrorState message="Couldn't load staff." /> : rows.length === 0 ? (
          <EmptyState message="No Polynexus staff accounts." />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-4 border-b border-border">
                <th className="py-2 pr-3 font-semibold">Code</th>
                <th className="py-2 pr-3 font-semibold">Person</th>
                <th className="py-2 pr-3 font-semibold">Role</th>
                <th className="py-2 pr-3 font-semibold">Licences</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const isOwner = s.saas_role === "saas_owner" || !s.saas_role
                return (
                  <tr key={s.id} className="border-b border-border-soft align-top">
                    <td className="py-2.5 pr-3 font-mono text-[12px]">{s.staff_code ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold">{s.name || s.email}</div>
                      <div className="text-[11px] text-ink-4">{s.email}{!s.is_2fa_enabled && " · 2FA off"}</div>
                    </td>
                    <td className="py-2.5 pr-3">{s.saas_role_label || "Owner"}</td>
                    <td className="py-2.5 pr-3">
                      {s.is_blocked ? <Pill tone="bad">Blocked</Pill>
                        : isOwner ? <Pill tone="ok">Approves</Pill>
                        : s.can_issue_licenses ? <Pill tone="warn">May request</Pill>
                        : <span className="text-ink-4">—</span>}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {s.id !== me && (
                        <div className="flex justify-end gap-1.5">
                          {!isOwner && !s.is_blocked && (
                            <Button size="sm" variant="secondary" disabled={right.isPending}
                              onClick={() => {
                                const grant = !s.can_issue_licenses
                                const otp = askOtp(grant ? `Allow ${s.staff_code} to request licences?` : `Remove ${s.staff_code}'s licence right?`)
                                if (otp) right.mutate({ s, grant, otp })
                              }}>
                              {s.can_issue_licenses ? "Remove right" : "Allow licences"}
                            </Button>
                          )}
                          {s.is_blocked ? (
                            <Button size="sm" variant="secondary" disabled={unblock.isPending} onClick={() => unblock.mutate(s)}>Unblock</Button>
                          ) : (
                            <Button size="sm" variant="secondary" disabled={block.isPending}
                              onClick={() => {
                                const reason = window.prompt(`Block ${s.staff_code} (${s.email})? They are signed out everywhere immediately.\n\nReason:`, "Left Polynexus")
                                if (reason === null) return
                                const otp = askOtp(`Confirm blocking ${s.staff_code}.`)
                                if (otp) block.mutate({ s, reason, otp })
                              }}>
                              Block
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}
