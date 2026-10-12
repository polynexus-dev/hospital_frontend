import { useState } from "react"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"

const CATEGORIES = [
  ["unauthorised_access", "Someone saw or used records they shouldn't"],
  ["data_breach", "Patient data sent to or taken by the wrong person"],
  ["lost_device", "Lost or stolen phone, laptop, USB drive or files"],
  ["phishing", "Suspicious email, call or a compromised password"],
  ["ransomware", "Virus, ransomware or locked files"],
  ["data_loss", "Records missing or damaged"],
  ["outage", "System down or attacked"],
  ["other", "Something else"],
] as const

const field = "w-full px-3 py-2 border border-border-strong rounded-control text-[13px] bg-surface"

/** Any staff member can report a security incident or data breach the moment
 *  they notice it: the reporting deadlines (CERT-In 6 hours, DPDP 72 hours)
 *  run from then. Administrators handle it in Security & Governance. */
export function ReportIncidentCard() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>("unauthorised_access")
  const [personal, setPersonal] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await api.post<{ id: number }>("/governance/incidents/", {
        title, description, category, personal_data_affected: personal, severity: personal ? "high" : "medium",
      })
      setMessage({ ok: true, text: `Reported as incident #${res.id}. Your administrators have been told. Don't delete anything related to it.` })
      setOpen(false)
      setTitle("")
      setDescription("")
    } catch (err) {
      setMessage({ ok: false, text: extractApiError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padded>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Eyebrow>Report a security incident</Eyebrow>
          <p className="text-[12.5px] text-ink-4">Lost device, wrong person saw records, suspicious email, virus? Report it now: the legal deadlines start when it's noticed.</p>
        </div>
        {!open && <Button size="sm" variant="danger" onClick={() => { setOpen(true); setMessage(null) }}>Report incident</Button>}
      </div>
      {message && <div className={`mt-2 text-[12.5px] ${message.ok ? "text-success-text" : "text-danger-text"}`}>{message.text}</div>}
      {open && (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2.5">
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="What happened">
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input className={field} required maxLength={200} placeholder="Short title, e.g. Ward laptop stolen" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className={field} required rows={4} placeholder="What happened, when, and what you've done so far" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={personal} onChange={(e) => setPersonal(e.target.checked)} />
            Patient or staff personal data may be affected
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={busy}>{busy ? "Reporting…" : "Report incident"}</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </Card>
  )
}
