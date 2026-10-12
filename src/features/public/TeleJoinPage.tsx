import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { api, extractApiError } from "../../api/client"

/** Patient-side join page for a video consultation — consent, then the room (embedded Jitsi). */
export function TeleJoinPage() {
  const { token } = useParams()
  const [info, setInfo] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [roomUrl, setRoomUrl] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/telemedicine/join/${token}/`, { skipAuth: true }).then(setInfo).catch((e) => setError(extractApiError(e)))
  }, [token])

  const join = async () => {
    setError(null)
    try {
      const res = await api.post<{ join_url: string }>(`/telemedicine/join/${token}/`, { consent: true }, { skipAuth: true })
      setRoomUrl(res.join_url)
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  if (roomUrl)
    return (
      <div className="h-screen flex flex-col bg-slate-900">
        <div className="text-white px-4 py-2 text-sm">{info?.hospital} · Consultation with {info?.doctor}</div>
        <iframe title="Video consultation" src={roomUrl} allow="camera; microphone; fullscreen; display-capture" className="flex-1 w-full border-0" />
      </div>
    )

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-7 space-y-4">
        {error && !info ? (
          <div className="text-danger-text">{error}</div>
        ) : !info ? (
          <div className="text-ink-4">Loading…</div>
        ) : (
          <>
            <div>
              <div className="text-xs uppercase text-ink-4">{info.hospital}</div>
              <h1 className="text-xl font-bold">Video consultation with {info.doctor}</h1>
              <div className="text-sm text-ink-3">Hello {info.patient_first_name} — scheduled {new Date(info.scheduled_at).toLocaleString()}</div>
            </div>
            <div className="text-sm text-ink-2 bg-page rounded-lg p-3">
              This is a teleconsultation under the Telemedicine Practice Guidelines 2020. The doctor may not be able to examine you physically and may ask you to visit the hospital.
              Your consultation notes and any prescription become part of your medical record.
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
              I consent to this teleconsultation.
            </label>
            {error && <div className="text-sm text-danger-text">{error}</div>}
            <button disabled={!consent} onClick={join} className="w-full py-3 rounded-xl bg-success text-white font-semibold disabled:opacity-50">Join consultation</button>
          </>
        )}
      </div>
    </div>
  )
}
