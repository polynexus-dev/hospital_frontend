import { useEffect, useRef, useState } from "react"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { API_BASE_URL, api, extractApiError } from "../../api/client"

const mediaUrl = (u: string) => (/^https?:/.test(u) ? u : new URL(u, new URL(API_BASE_URL, window.location.href).origin).toString())

interface Sig { signature_image: string; stamp_image: string; signature_width_mm: number; stamp_width_mm: number; registration_number: string }

/** My signature and stamp, printed on prescriptions, lab reports and other signed documents. */
export function SignatureCard() {
  const [s, setS] = useState<Sig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const sigRef = useRef<HTMLInputElement>(null)
  const stampRef = useRef<HTMLInputElement>(null)
  useEffect(() => { api.get<Sig>("/users/me/signature/").then(setS).catch((e) => setError(extractApiError(e))) }, [])

  const send = async (fd: FormData, msg: string) => {
    setError(null)
    setNotice(null)
    try {
      setS(await api.put<Sig>("/users/me/signature/", fd, { isFormData: true }))
      setNotice(msg)
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const upload = (key: "signature_image" | "stamp_image", file?: File) => {
    if (!file) return
    const fd = new FormData()
    fd.append(key, file)
    send(fd, key === "signature_image" ? "Signature saved." : "Stamp saved.")
  }
  const saveSettings = () => {
    if (!s) return
    const fd = new FormData()
    fd.append("signature_width_mm", String(s.signature_width_mm))
    fd.append("stamp_width_mm", String(s.stamp_width_mm))
    fd.append("registration_number", s.registration_number)
    send(fd, "Saved.")
  }
  const remove = (what: "signature" | "stamp") => {
    const fd = new FormData()
    fd.append(`remove_${what}`, "true")
    send(fd, "Removed.")
  }
  if (!s) return error ? <Card padded><div className="text-sm text-danger-text">{error}</div></Card> : null
  // On screen, 1 mm ≈ 3.78 px — a fair preview of the printed size.
  const px = (mm: number) => Math.round(mm * 3.78)
  return (
    <Card padded>
      <div className="space-y-3">
        <div>
          <div className="text-[15px] font-semibold">Signature &amp; stamp</div>
          <div className="text-[12.5px] text-ink-4">Printed on prescriptions, verified lab reports and documents you sign. A PNG with a transparent background prints best.</div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {(["signature", "stamp"] as const).map((what) => {
            const url = what === "signature" ? s.signature_image : s.stamp_image
            const widthKey = what === "signature" ? "signature_width_mm" : "stamp_width_mm"
            return (
              <div key={what} className="border border-border rounded-lg p-3 space-y-2">
                <div className="text-[12px] font-semibold uppercase text-ink-4">{what === "signature" ? "Signature" : "Stamp / seal"}</div>
                <div className="h-[130px] flex items-end">
                  {url ? <img src={mediaUrl(url)} alt={what} style={{ width: px(s[widthKey]) }} className="max-h-[130px] object-contain" /> : <span className="text-[12.5px] text-ink-5">Not uploaded</span>}
                </div>
                <label className="text-[12px] text-ink-3 flex items-center gap-2">Printed width
                  <input type="range" min={10} max={80} value={s[widthKey]} onChange={(e) => setS({ ...s, [widthKey]: Number(e.target.value) })} aria-label={`${what} width`} />
                  <span className="w-12">{s[widthKey]} mm</span>
                </label>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => (what === "signature" ? sigRef : stampRef).current?.click()}>{url ? "Replace" : "Upload"}</Button>
                  {url && <Button size="sm" variant="secondary" onClick={() => remove(what)}>Remove</Button>}
                </div>
              </div>
            )
          })}
        </div>
        <input ref={sigRef} type="file" accept="image/png,image/jpeg" className="hidden" aria-label="Signature image" onChange={(e) => { upload("signature_image", e.target.files?.[0]); e.target.value = "" }} />
        <input ref={stampRef} type="file" accept="image/png,image/jpeg" className="hidden" aria-label="Stamp image" onChange={(e) => { upload("stamp_image", e.target.files?.[0]); e.target.value = "" }} />
        <label className="text-[12px] text-ink-3 block max-w-sm">Council registration number (printed under your name)
          <input className="w-full mt-1 h-8 px-2.5 border border-border-strong rounded-control text-[13px] bg-transparent" value={s.registration_number} onChange={(e) => setS({ ...s, registration_number: e.target.value })} />
        </label>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveSettings}>Save sizes &amp; registration no.</Button>
          {notice && <span className="text-[12px] text-success-text">{notice}</span>}
          {error && <span className="text-[12px] text-danger-text">{error}</span>}
        </div>
      </div>
    </Card>
  )
}
