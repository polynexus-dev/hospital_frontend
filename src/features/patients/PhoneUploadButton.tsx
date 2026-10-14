import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"

interface LinkInfo { session: number; token: string; expires_at: string; uploads: number; max_files: number; open: boolean; category: string; requirement: string }

const CATEGORIES = [["other", "Other"], ["id_proof", "ID proof"], ["insurance_card", "Insurance card"], ["report", "Diagnostic report"], ["prescription", "Prescription"], ["consent", "Consent form"]]

/** "Upload from phone": a QR code the patient (or staff) scans to upload photos / PDFs into this patient's documents. */
export function PhoneUploadButton({ patientId, requirement, category: fixedCategory, label = "Upload from phone" }: {
  patientId: number; requirement?: number; category?: string; label?: string
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(fixedCategory ?? "other")
  const [link, setLink] = useState<LinkInfo | null>(null)
  const [qr, setQr] = useState("")
  const [error, setError] = useState<string | null>(null)
  const url = link ? `${window.location.origin}/m/upload/${link.token}` : ""

  const start = async () => {
    setError(null)
    try {
      const res = await api.post<LinkInfo>(`/patients/${patientId}/upload-link/`, { category, requirement })
      setLink(res)
      setQr(await QRCode.toDataURL(`${window.location.origin}/m/upload/${res.token}`, { width: 220, margin: 1 }))
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  // Watch for uploads while the QR is on screen.
  useEffect(() => {
    if (!link) return
    const t = window.setInterval(async () => {
      try {
        const s = await api.get<LinkInfo>(`/patients/${patientId}/upload-link/${link.session}/`)
        if (s.uploads !== link.uploads) {
          queryClient.invalidateQueries({ queryKey: ["document-checklist", patientId] })
          queryClient.invalidateQueries({ queryKey: ["patient-documents", patientId] })
        }
        setLink((l) => (l ? { ...l, uploads: s.uploads, open: s.open } : l))
      } catch {
        // keep polling
      }
    }, 4000)
    return () => window.clearInterval(t)
  }, [link?.session]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = async () => {
    if (link?.open) {
      try {
        await api.post(`/patients/${patientId}/upload-link/${link.session}/`, {})
      } catch {
        // it expires on its own
      }
    }
    setOpen(false)
    setLink(null)
    setQr("")
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{label}</Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={close}>
          <div className="bg-white dark:bg-slate-800 max-w-sm w-full rounded-xl p-6 space-y-3 text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Upload from phone</h2>
            {!link ? (
              <>
                {!fixedCategory && (
                  <label className="block text-left text-xs font-semibold text-ink-3">Document type
                    <select className="w-full mt-1 px-3 py-2 text-sm border border-border-strong rounded-lg bg-white dark:bg-slate-900" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                )}
                <p className="text-sm text-ink-4">Makes a QR code valid for 30 minutes (up to 10 files). Scan it with the phone's camera — no app or sign-in needed.</p>
                <Button onClick={start}>Show QR code</Button>
              </>
            ) : (
              <>
                {qr && <img src={qr} alt="QR code for uploading documents" className="mx-auto w-[220px] h-[220px]" />}
                <div className="text-[12px] text-ink-4 break-all">{url}</div>
                <div className="text-sm">
                  {link.uploads} of {link.max_files} uploaded · {link.open ? `valid till ${new Date(link.expires_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "closed"}
                </div>
              </>
            )}
            {error && <div className="text-sm text-danger-text">{error}</div>}
            <Button variant="secondary" onClick={close}>{link ? "Done" : "Cancel"}</Button>
          </div>
        </div>
      )}
    </>
  )
}
