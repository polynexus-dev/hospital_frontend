import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { api, extractApiError } from "../../api/client"

type Provider = "google" | "microsoft"

interface Connection {
  id: number
  provider: Provider
  provider_display: string
  account_email: string
  status: "active" | "error" | "revoked"
  status_display: string
  last_synced_at: string | null
  last_error: string
  push_appointments: boolean
  block_busy_slots: boolean
  busy_slots: number
}

interface DoctorRow {
  doctor_id: number
  doctor: string
  speciality: string
  connection: Connection | null
}

interface CalendarsResponse {
  providers: Record<Provider, boolean>
  doctors: DoctorRow[]
}

const PROVIDER_LABEL: Record<Provider, string> = { google: "Google Calendar", microsoft: "Outlook / Microsoft 365" }
const TONE = { active: "ok", error: "warn", revoked: "bad" } as const

/** Settings → Doctor calendars: two-way sync with each doctor's own
 *  Google / Outlook calendar (backend apps.appointments.calendar_sync).
 *  Doctors see their own row; staff who manage doctors see everyone. */
export function DoctorCalendarsCard() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  // Back from Google / Microsoft (?calendar=connected|error&reason=…): show the outcome once.
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(() => {
    const result = params.get("calendar")
    if (!result) return null
    return result === "connected"
      ? { ok: true, text: "Calendar connected. Upcoming appointments are being added, and busy times will block slots within a few minutes." }
      : { ok: false, text: params.get("reason") || "The calendar wasn't connected." }
  })
  const calendars = useQuery({
    queryKey: ["doctor-calendars"],
    queryFn: () => api.get<CalendarsResponse>("/calendar/connections/"),
    retry: false,
  })

  // …then tidy the URL so a refresh doesn't show it again.
  useEffect(() => {
    if (!params.get("calendar")) return
    const next = new URLSearchParams(params)
    next.delete("calendar")
    next.delete("reason")
    next.delete("tab")
    setParams(next, { replace: true })
  }, [params, setParams])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["doctor-calendars"] })
  const connect = useMutation({
    mutationFn: (v: { doctor: number; provider: Provider }) => api.post<{ url: string }>("/calendar/connect/", v),
    onSuccess: (r) => { window.location.href = r.url },
    onError: (e) => setBanner({ ok: false, text: extractApiError(e) }),
  })
  const update = useMutation({
    mutationFn: (v: { id: number; body: Partial<Connection> }) => api.patch(`/calendar/connections/${v.id}/`, v.body),
    onSuccess: refresh,
    onError: (e) => setBanner({ ok: false, text: extractApiError(e) }),
  })
  const sync = useMutation({
    mutationFn: (id: number) => api.post(`/calendar/connections/${id}/sync/`),
    onSuccess: refresh,
    onError: (e) => { refresh(); setBanner({ ok: false, text: extractApiError(e) }) },
  })
  const disconnect = useMutation({
    mutationFn: (id: number) => api.delete(`/calendar/connections/${id}/`),
    onSuccess: refresh,
    onError: (e) => setBanner({ ok: false, text: extractApiError(e) }),
  })

  if (calendars.isError || !calendars.data || calendars.data.doctors.length === 0) return null
  const { providers, doctors } = calendars.data
  const available = (Object.keys(providers) as Provider[]).filter((p) => providers[p])

  return (
    <Card padded>
      <Eyebrow>Doctor calendars</Eyebrow>
      <p className="text-[13px] mb-1">
        Connect a doctor's own Google or Outlook calendar. OPD appointments appear in it as soon as they're booked, and anything the
        doctor marks busy there (meetings, leave, OT) blocks those OPD slots so nobody books them.
      </p>
      <p className="text-[12px] text-ink-4 mb-3">
        Events show only the patient's initials and the reason, e.g. "OPD: A.P. (follow-up)", with a link back here. The doctor's own
        event titles are never read or stored, only their times.
      </p>
      {banner && (
        <div className={`mb-3 px-3 py-2 rounded-control text-[12.5px] flex justify-between gap-2 ${banner.ok ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"}`}>
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
      {available.length === 0 && (
        <div className="text-[12.5px] text-warning-text mb-3">
          Calendar sync isn't set up on this server yet (Google / Microsoft app credentials). Ask your Polynexus administrator.
        </div>
      )}
      <div className="divide-y divide-border-faint border-t border-border-faint">
        {doctors.map((d) => {
          const c = d.connection
          return (
            <div key={d.doctor_id} className="py-2.5 flex flex-wrap items-center gap-3 text-[13px]">
              <div className="min-w-[180px] flex-1">
                <div className="font-semibold">{d.doctor}</div>
                <div className="text-[11.5px] text-ink-4">{d.speciality}</div>
              </div>
              {c ? (
                <>
                  <div className="min-w-[220px] flex-1">
                    <div className="flex items-center gap-2">
                      <Pill tone={TONE[c.status]}>{c.status_display}</Pill>
                      <span className="text-[12px] text-ink-3">{c.provider_display} · {c.account_email}</span>
                    </div>
                    <div className="text-[11.5px] text-ink-4 mt-0.5">
                      {c.last_error || (c.last_synced_at ? `Synced ${new Date(c.last_synced_at).toLocaleString()}` : "First sync pending")}
                      {c.busy_slots > 0 && ` · ${c.busy_slots} slot${c.busy_slots > 1 ? "s" : ""} blocked by the calendar`}
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[12px]">
                    <input type="checkbox" checked={c.push_appointments} onChange={(e) => update.mutate({ id: c.id, body: { push_appointments: e.target.checked } })} />
                    Add appointments
                  </label>
                  <label className="flex items-center gap-1.5 text-[12px]">
                    <input type="checkbox" checked={c.block_busy_slots} onChange={(e) => update.mutate({ id: c.id, body: { block_busy_slots: e.target.checked } })} />
                    Busy times block slots
                  </label>
                  {c.status === "active" ? (
                    <Button size="sm" variant="secondary" onClick={() => sync.mutate(c.id)} disabled={sync.isPending}>Sync now</Button>
                  ) : (
                    providers[c.provider] && (
                      <Button size="sm" variant="primary" onClick={() => connect.mutate({ doctor: d.doctor_id, provider: c.provider })}>Reconnect</Button>
                    )
                  )}
                  <button
                    onClick={() => window.confirm(`Disconnect ${d.doctor}'s calendar? Upcoming appointment events are removed from it and calendar blocks are lifted.`) && disconnect.mutate(c.id)}
                    className="text-[12px] font-semibold text-danger-text"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  {available.map((p) => (
                    <Button key={p} size="sm" variant="secondary" onClick={() => connect.mutate({ doctor: d.doctor_id, provider: p })} disabled={connect.isPending}>
                      Connect {PROVIDER_LABEL[p]}
                    </Button>
                  ))}
                  {available.length === 0 && <span className="text-[12px] text-ink-4">Not connected</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
