import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { API_BASE_URL } from "../../api/client"

// Public page opened by scanning the "Upload from phone" QR code. No
// sign-in: the signed token in the URL says which patient and document type.

interface Info { hospital: string; patient: string; uhid: string; category: string; requirement: string; expires_at: string; uploads: number; max_files: number; open: boolean }

export function MobileUploadPage() {
  const { token = "" } = useParams()
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string[]>([])
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const endpoint = `${API_BASE_URL}/mobile-upload/${encodeURIComponent(token)}/`

  useEffect(() => {
    fetch(endpoint).then(async (r) => {
      const body = await r.json().catch(() => ({}))
      if (r.ok) setInfo(body)
      else setError(body.detail ?? "This link isn't valid.")
    }).catch(() => setError("Couldn't reach the hospital. Check your internet connection."))
  }, [endpoint])

  const send = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    const fd = new FormData()
    fd.append("file", file)
    try {
      const r = await fetch(endpoint, { method: "POST", body: fd })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(body.detail ?? body.file ?? "Upload failed.")
      } else {
        setInfo(body)
        setDone((d) => [...d, file.name])
      }
    } catch {
      setError("Upload failed. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-page dark:bg-slate-900 px-4 py-8 text-ink dark:text-slate-100">
      <div className="max-w-sm mx-auto bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4">
        {info ? (
          <>
            <div>
              <div className="text-sm text-ink-4">{info.hospital}</div>
              <h1 className="text-lg font-bold">Upload {info.requirement || info.category.toLowerCase()}</h1>
              <div className="text-sm text-ink-3">For {info.patient}{info.uhid ? ` (UHID ${info.uhid})` : ""}</div>
            </div>
            {info.open ? (
              <>
                <button disabled={busy} onClick={() => cameraRef.current?.click()} className="w-full py-3 rounded-lg bg-brand text-white font-semibold disabled:opacity-50">
                  {busy ? "Uploading…" : "Take a photo"}
                </button>
                <button disabled={busy} onClick={() => fileRef.current?.click()} className="w-full py-3 rounded-lg border border-border-strong font-semibold disabled:opacity-50">
                  Choose a photo or PDF
                </button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a photo"
                  onChange={(e) => { send(e.target.files?.[0]); e.target.value = "" }} />
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" aria-label="Choose a file"
                  onChange={(e) => { send(e.target.files?.[0]); e.target.value = "" }} />
                <div className="text-xs text-ink-4">{info.uploads} of {info.max_files} files · link valid till {new Date(info.expires_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
              </>
            ) : (
              <div className="text-sm text-warning-text">This link has expired or is full. Ask the hospital staff for a new QR code.</div>
            )}
            {done.length > 0 && (
              <ul className="text-sm text-success-text space-y-0.5">{done.map((n, i) => <li key={i}>✓ {n} uploaded</li>)}</ul>
            )}
          </>
        ) : !error ? <div className="text-sm text-ink-4">Loading…</div> : null}
        {error && <div className="text-sm text-danger-text" role="alert">{error}</div>}
      </div>
    </div>
  )
}
