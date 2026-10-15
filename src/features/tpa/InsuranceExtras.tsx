import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { FieldInput, ResourceTable } from "../../components/resource/ResourceTable"
import { col, doctorField } from "../nabh/fields"

// MedNet M2.22 insurance parity: the insurance inbox and per-case
// correspondence (INS-1), the pre-auth form + NHCX bundle (INS-2), and
// non-payable item lists (PH-1).

const inputCls = "w-full px-3 py-2 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const cardCls = "bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4"
const labelCls = "block text-xs font-semibold text-ink-3"
const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "")

export type CaseRef = { type: "pre_auth" | "claim"; id: number; label?: string }

interface InboxCase { type: "pre_auth" | "claim"; id: number; patient: string; tpa: string; status: string; amount: string; claim_number?: string }
interface Inbox {
  counts: { open_queries: number; overdue_queries: number; preauths_awaiting: number; claims_ageing: number; to_review: number }
  to_review: { message: number; kind: string; subject: string; email_from: string; received_at: string; amount: string | null; case: InboxCase | null }[]
  queries: { message: number; kind: string; subject: string; received_at: string; respond_by: string | null; overdue: boolean; case: InboxCase }[]
  preauths_awaiting: { case: InboxCase; waiting_days: number; tat_days: number }[]
  claims_ageing: { case: InboxCase; days: number }[]
}

const caseName = (c: InboxCase) => `${c.type === "pre_auth" ? `Pre-auth #${c.id}` : `Claim ${c.claim_number || `#${c.id}`}`} · ${c.patient} · ${c.tpa}`

export function InsuranceInbox() {
  const [data, setData] = useState<Inbox | null>(null)
  const [tpa, setTpa] = useState<unknown>(null)
  const [open, setOpen] = useState<CaseRef | null>(null)
  const [reviewing, setReviewing] = useState<Inbox["to_review"][number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () => api.get<Inbox>(`/tpa/messages/inbox/${tpa ? `?tpa=${tpa}` : ""}`).then(setData).catch((e) => setError(extractApiError(e)))
  useEffect(() => { load() }, [tpa]) // eslint-disable-line react-hooks/exhaustive-deps
  const row = (c: InboxCase, right: React.ReactNode, extra?: React.ReactNode) => (
    <button key={`${c.type}-${c.id}-${String(extra ?? "")}`} onClick={() => setOpen({ type: c.type, id: c.id, label: caseName(c) })}
      className="w-full text-left flex items-start justify-between gap-3 px-3 py-2 rounded-lg hover:bg-page dark:hover:bg-slate-900">
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{caseName(c)}</div>
        {extra && <div className="text-xs text-ink-3">{extra}</div>}
      </div>
      <div className="text-xs text-right shrink-0">{right}</div>
    </button>
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1">
          {data && ([
            ["Emails to review", data.counts.to_review, data.counts.to_review > 0],
            ["Open queries", data.counts.open_queries, false],
            ["Overdue replies", data.counts.overdue_queries, data.counts.overdue_queries > 0],
            ["Pre-auths past TAT", data.counts.preauths_awaiting, data.counts.preauths_awaiting > 0],
            ["Claims > 30 days", data.counts.claims_ageing, data.counts.claims_ageing > 0],
          ] as [string, number, boolean][]).map(([label, n, warn]) => (
            <div key={label} className={`rounded-lg border px-3 py-2 ${warn ? "border-warning-text/40 bg-warning-bg" : "border-border dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-4">{label}</div>
              <div className="text-xl font-bold">{n}</div>
            </div>
          ))}
        </div>
        <label className={`${labelCls} min-w-64`}>Insurer / TPA<div className="mt-1"><FieldInput field={{ key: "tpa", label: "TPA", type: "fk", source: "/tpa/companies/" }} value={tpa} onChange={setTpa} /></div></label>
      </div>
      {error && <div className="text-sm text-danger-text">{error}</div>}
      {data && data.to_review.length > 0 && (
        <section className={cardCls}>
          <h3 className="font-bold">Emails to review ({data.to_review.length})</h3>
          <p className="text-sm text-ink-4">Imported from the insurer mailbox. Approvals, enhancements, rejections and settlements — and mail that matched no case — take effect only once confirmed here.</p>
          <div className="divide-y divide-border-soft dark:divide-slate-700">
            {data.to_review.map((m) => (
              <div key={m.message} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{m.subject}</div>
                  <div className="text-xs text-ink-4">{m.email_from} · {fmt(m.received_at)} · looks like: {m.kind.replace("_", " ")}{m.amount ? ` ${inr(m.amount)}` : ""} · {m.case ? caseName(m.case) : "no case matched"}</div>
                </div>
                <button onClick={() => setReviewing(m)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white">Review</button>
              </div>
            ))}
          </div>
        </section>
      )}
      {data && (
        <div className="grid lg:grid-cols-3 gap-4">
          <section className={cardCls}>
            <h3 className="font-bold">Queries to answer</h3>
            {data.queries.length === 0 ? <p className="text-sm text-ink-4">None open.</p> : data.queries.map((q) => row(q.case,
              q.respond_by ? <span className={q.overdue ? "text-danger-text font-semibold" : "text-ink-3"}>Reply by {q.respond_by}</span> : null, q.subject))}
          </section>
          <section className={cardCls}>
            <h3 className="font-bold">Pre-auths waiting on the insurer</h3>
            {data.preauths_awaiting.length === 0 ? <p className="text-sm text-ink-4">None past turnaround.</p> : data.preauths_awaiting.map((p) => row(p.case,
              <span className="text-warning-text font-semibold">{p.waiting_days} d (TAT {p.tat_days} d)</span>, inr(p.case.amount)))}
          </section>
          <section className={cardCls}>
            <h3 className="font-bold">Claims ageing</h3>
            {data.claims_ageing.length === 0 ? <p className="text-sm text-ink-4">None over 30 days.</p> : data.claims_ageing.map((c) => row(c.case,
              <span className="text-warning-text font-semibold">{c.days} days</span>, `${inr(c.case.amount)} · ${c.case.status.replace("_", " ")}`))}
          </section>
        </div>
      )}
      {open && <CaseThreadModal target={open} onClose={() => { setOpen(null); load() }} />}
      {reviewing && <ReviewEmailModal item={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); load() }} />}
    </div>
  )
}

const REVIEW_KINDS: [string, string][] = [["query", "Query"], ["documents", "Documents requested"], ["approval", "Approval"], ["enhancement_ok", "Enhancement approved"], ["rejection", "Rejection"], ["settlement", "Settlement advice"], ["note", "Note"]]

function ReviewEmailModal({ item, onClose, onDone }: { item: Inbox["to_review"][number]; onClose: () => void; onDone: () => void }) {
  const [caseType, setCaseType] = useState<"pre_auth" | "claim">(item.case?.type ?? "pre_auth")
  const [caseId, setCaseId] = useState<unknown>(item.case?.id ?? null)
  const [kind, setKind] = useState(item.kind)
  const [amount, setAmount] = useState(item.amount ?? "")
  const [body, setBody] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get<any>(`/tpa/messages/${item.message}/`).then((m) => setBody(m.body ?? "")).catch(() => undefined) }, [item.message])
  const confirm = async () => {
    setError(null)
    try {
      await api.post(`/tpa/messages/${item.message}/confirm/`, {
        ...(caseId ? { [caseType === "pre_auth" ? "preauth_request" : "claim"]: Number(caseId) } : {}), kind, ...(NEEDS_AMOUNT.includes(kind) ? { amount } : {}),
      })
      onDone()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const dismiss = async () => {
    try {
      await api.post(`/tpa/messages/${item.message}/dismiss/`, {})
      onDone()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-xl w-full max-h-[92vh] overflow-y-auto rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold">{item.subject}</h2>
          <p className="text-sm text-ink-4">{item.email_from} · {fmt(item.received_at)}</p>
        </div>
        {body && <div className="text-sm whitespace-pre-wrap max-h-56 overflow-y-auto rounded-lg bg-page dark:bg-slate-900 p-3">{body}</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className={labelCls}>Case
            <select className={`${inputCls} mt-1`} value={caseType} onChange={(e) => { setCaseType(e.target.value as "pre_auth" | "claim"); setCaseId(null) }}>
              <option value="pre_auth">Pre-auth</option><option value="claim">Claim</option>
            </select>
          </label>
          <label className={labelCls}>{caseType === "pre_auth" ? "Pre-auth" : "Claim"}
            <div className="mt-1">
              <FieldInput field={caseType === "pre_auth"
                ? { key: "preauth", label: "Pre-auth", type: "fk", source: "/tpa/pre-auth/", sourceLabel: (r: any) => `#${r.id} ${r.patient_name} · ${r.tpa_name}` }
                : { key: "claim", label: "Claim", type: "fk", source: "/tpa/claims/", sourceLabel: (r: any) => `${r.claim_number || `#${r.id}`} ${r.patient_name} · ${r.tpa_name}` }}
                value={caseId} onChange={setCaseId} />
            </div>
          </label>
          <label className={labelCls}>Type
            <select className={`${inputCls} mt-1`} value={kind} onChange={(e) => setKind(e.target.value)}>
              {REVIEW_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {NEEDS_AMOUNT.includes(kind) && <label className={labelCls}>Amount (₹)<input type="number" step="0.01" className={`${inputCls} mt-1`} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>}
        </div>
        {error && <div className="text-sm text-danger-text">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink-4">Later</button>
          <button onClick={dismiss} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border-strong dark:border-slate-600">Not insurance mail</button>
          <button onClick={confirm} disabled={!caseId} className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white disabled:opacity-50">Confirm</button>
        </div>
      </div>
    </div>
  )
}

/** The mailbox insurers write to, polled every few minutes into the inbox. */
export function MailboxCard() {
  const [mb, setMb] = useState<Record<string, any> | null>(null)
  const [password, setPassword] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.get<Record<string, any>>("/tpa/mailbox/").then((r) => setMb(r.configured ? r : { host: "", port: 993, use_ssl: true, username: "", folder: "INBOX", is_active: true })).catch((e) => setError(extractApiError(e)))
  }, [])
  if (!mb) return error ? <div className="text-sm text-danger-text">{error}</div> : null
  const save = async () => {
    setError(null)
    setNotice(null)
    try {
      setMb(await api.put<Record<string, any>>("/tpa/mailbox/", { ...mb, ...(password ? { password } : {}) }))
      setPassword("")
      setNotice("Saved. New mail is fetched every 5 minutes.")
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const check = async () => {
    setError(null)
    try {
      const r = await api.post<Record<string, any>>("/tpa/mailbox/", {})
      setMb(r)
      setNotice(r.last_error ? null : `Fetched: ${r.imported} new email(s).`)
      if (r.last_error) setError(r.last_error)
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <section className={`${cardCls} max-w-2xl`}>
      <div>
        <h2 className="text-lg font-bold">Insurer mailbox</h2>
        <p className="text-sm text-ink-4">The address insurers and TPAs write to. Mail is read (not marked read), matched to the pre-auth or claim and added to the Insurance Inbox. Use an app password.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className={`${labelCls} sm:col-span-2`}>IMAP host<input className={`${inputCls} mt-1`} value={mb.host ?? ""} onChange={(e) => setMb({ ...mb, host: e.target.value })} placeholder="imap.gmail.com" /></label>
        <label className={labelCls}>Port<input type="number" className={`${inputCls} mt-1`} value={mb.port ?? 993} onChange={(e) => setMb({ ...mb, port: Number(e.target.value) })} /></label>
        <label className={`${labelCls} sm:col-span-2`}>Username<input className={`${inputCls} mt-1`} value={mb.username ?? ""} onChange={(e) => setMb({ ...mb, username: e.target.value })} /></label>
        <label className={labelCls}>Folder<input className={`${inputCls} mt-1`} value={mb.folder ?? "INBOX"} onChange={(e) => setMb({ ...mb, folder: e.target.value })} /></label>
        <label className={`${labelCls} sm:col-span-2`}>Password {mb.has_password ? "(saved — leave blank to keep)" : ""}<input type="password" autoComplete="new-password" className={`${inputCls} mt-1`} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className={`${labelCls} flex items-end gap-2 pb-2`}><input type="checkbox" checked={!!mb.use_ssl} onChange={(e) => setMb({ ...mb, use_ssl: e.target.checked })} /> SSL</label>
        <label className={`${labelCls} flex items-center gap-2`}><input type="checkbox" checked={!!mb.is_active} onChange={(e) => setMb({ ...mb, is_active: e.target.checked })} /> Fetch automatically</label>
      </div>
      {mb.last_checked_at && <p className="text-xs text-ink-4">Last checked {fmt(mb.last_checked_at)}{mb.last_error ? ` — failed: ${mb.last_error}` : ""}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} className="px-4 py-2 text-sm font-semibold rounded-lg bg-success text-white">Save</button>
        {mb.configured && <button onClick={check} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border-strong dark:border-slate-600">Fetch now</button>}
        {notice && <span className="text-sm text-success-text">{notice}</span>}
        {error && <span className="text-sm text-danger-text">{error}</span>}
      </div>
    </section>
  )
}

interface Msg { id: number; direction: "in" | "out"; kind: string; kind_label: string; subject: string; body: string; amount: string | null; respond_by: string | null; received_at: string; resolved_at: string | null; is_open: boolean; recorded_by_name: string; attachment: string | null }

const INCOMING: [string, string][] = [["query", "Query"], ["documents", "Documents requested"], ["approval", "Approval"], ["enhancement_ok", "Enhancement approved"], ["rejection", "Rejection"], ["settlement", "Settlement advice"], ["note", "Note"]]
const OUTGOING: [string, string][] = [["reply", "Reply to query"], ["enhancement", "Enhancement request"], ["note", "Note"]]
const NEEDS_AMOUNT = ["approval", "enhancement_ok", "settlement"]

/** One pre-auth's or claim's correspondence, with a form to log what came in or went out. */
export function CaseThreadModal({ target, onClose }: { target: CaseRef; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [direction, setDirection] = useState<"in" | "out">("in")
  const [kind, setKind] = useState("query")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [amount, setAmount] = useState("")
  const [respondBy, setRespondBy] = useState("")
  const [error, setError] = useState<string | null>(null)
  const key = target.type === "pre_auth" ? "preauth_request" : "claim"
  const load = () => api.get<any>(`/tpa/messages/?${key}=${target.id}&page_size=200`).then((r) => setMsgs(r.results ?? r)).catch((e) => setError(extractApiError(e)))
  useEffect(() => { load() }, [target.id, target.type]) // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = (direction === "in" ? INCOMING : OUTGOING).filter(([k]) => !(target.type === "claim" && ["approval", "enhancement_ok"].includes(k)) && !(target.type === "pre_auth" && k === "settlement"))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post("/tpa/messages/", {
        [key]: target.id, direction, kind, subject, body,
        ...(NEEDS_AMOUNT.includes(kind) ? { amount } : {}), ...(respondBy && ["query", "documents"].includes(kind) ? { respond_by: respondBy } : {}),
      })
      setSubject(""); setBody(""); setAmount(""); setRespondBy("")
      load()
    } catch (err) {
      setError(extractApiError(err))
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Correspondence</h2>
            <p className="text-sm text-ink-4">{target.label ?? `${target.type === "pre_auth" ? "Pre-auth" : "Claim"} #${target.id}`}</p>
          </div>
          <button onClick={onClose} className="text-ink-4 text-xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="space-y-2">
          {msgs.length === 0 && <p className="text-sm text-ink-4">Nothing recorded yet.</p>}
          {[...msgs].reverse().map((m) => (
            <div key={m.id} className={`rounded-lg border px-3 py-2 text-sm ${m.direction === "in" ? "border-border dark:border-slate-700" : "border-brand-border bg-brand-tint/40 ml-8"}`}>
              <div className="flex justify-between gap-2 text-xs text-ink-4">
                <span className="font-semibold">{m.direction === "in" ? "Insurer" : "Hospital"} · {m.kind_label}{m.amount ? ` · ${inr(m.amount)}` : ""}</span>
                <span>{fmt(m.received_at)}{m.recorded_by_name ? ` · ${m.recorded_by_name}` : ""}</span>
              </div>
              <div className="font-semibold mt-0.5">{m.subject}</div>
              {m.body && <div className="text-ink-3 whitespace-pre-wrap">{m.body}</div>}
              {m.is_open && <div className={`text-xs font-semibold mt-1 ${m.respond_by && m.respond_by < new Date().toISOString().slice(0, 10) ? "text-danger-text" : "text-warning-text"}`}>Open — reply by {m.respond_by}</div>}
              {m.resolved_at && <div className="text-xs text-success-text mt-1">Answered {fmt(m.resolved_at)}</div>}
            </div>
          ))}
        </div>
        <form onSubmit={save} className="space-y-3 border-t border-border-soft dark:border-slate-700 pt-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className={labelCls}>From
              <select className={`${inputCls} mt-1`} value={direction} onChange={(e) => { const d = e.target.value as "in" | "out"; setDirection(d); setKind(d === "in" ? "query" : "reply") }}>
                <option value="in">Insurer / TPA</option><option value="out">Hospital</option>
              </select>
            </label>
            <label className={labelCls}>Type
              <select className={`${inputCls} mt-1`} value={kind} onChange={(e) => setKind(e.target.value)}>
                {kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          </div>
          <label className={labelCls}>Subject<input required className={`${inputCls} mt-1`} value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
          <label className={labelCls}>Details<textarea rows={2} className={`${inputCls} mt-1`} value={body} onChange={(e) => setBody(e.target.value)} /></label>
          <div className="grid sm:grid-cols-2 gap-3">
            {NEEDS_AMOUNT.includes(kind) && direction === "in" && <label className={labelCls}>Amount (₹)<input required type="number" step="0.01" className={`${inputCls} mt-1`} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>}
            {["query", "documents"].includes(kind) && <label className={labelCls}>Reply by (blank = insurer's TAT)<input type="date" className={`${inputCls} mt-1`} value={respondBy} onChange={(e) => setRespondBy(e.target.value)} /></label>}
          </div>
          {error && <div className="text-sm text-danger-text">{error}</div>}
          <div className="flex justify-end"><button type="submit" className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white">Record</button></div>
        </form>
      </div>
    </div>
  )
}

interface CostLine { category: string; description: string; amount: string }
const PREAUTH_FIELDS = ["member_id", "treating_doctor", "admission_type", "expected_admission_date", "expected_stay_days", "room_category", "diagnosis_code", "diagnosis", "procedure_name", "procedure_code", "clinical_summary"] as const

/** The pre-auth form: what the insurer / NHCX needs, readiness, and sending it over NHCX. */
export function PreAuthFormModal({ preauthId, onClose, onSaved }: { preauthId: number; onClose: () => void; onSaved: () => void }) {
  const [pa, setPa] = useState<Record<string, any> | null>(null)
  const [lines, setLines] = useState<CostLine[]>([])
  const [nhcx, setNhcx] = useState<{ ready: boolean; missing: string[] } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadNhcx = () => api.get<{ ready: boolean; missing: string[] }>(`/tpa/pre-auth/${preauthId}/nhcx/`).then(setNhcx).catch(() => setNhcx(null))
  useEffect(() => {
    api.get<Record<string, any>>(`/tpa/pre-auth/${preauthId}/`).then((r) => { setPa(r); setLines((r.cost_breakdown ?? []).map((l: any) => ({ ...l, amount: String(l.amount) }))) }).catch((e) => setError(extractApiError(e)))
    loadNhcx()
  }, [preauthId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!pa) return null
  const set = (k: string, v: unknown) => setPa({ ...pa, [k]: v })
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)

  const save = async () => {
    setError(null)
    setNotice(null)
    try {
      const body: Record<string, unknown> = Object.fromEntries(PREAUTH_FIELDS.map((k) => [k, pa[k] === "" ? null : pa[k]]))
      for (const k of ["member_id", "diagnosis_code", "diagnosis", "procedure_name", "procedure_code", "clinical_summary", "room_category", "admission_type"]) body[k] = pa[k] ?? ""
      const clean = lines.filter((l) => l.amount !== "")
      body.cost_breakdown = clean.map((l) => ({ ...l, amount: Number(l.amount) }))
      if (clean.length) body.claim_amount = total
      setPa(await api.patch<Record<string, any>>(`/tpa/pre-auth/${preauthId}/`, body))
      setNotice("Saved.")
      onSaved()
      loadNhcx()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const submit = async () => {
    setError(null)
    setNotice(null)
    try {
      await api.post(`/tpa/pre-auth/${preauthId}/nhcx-submit/`, {})
      setNotice("Sent over NHCX.")
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const text = (k: string, label: string, type = "text") => (
    <label className={labelCls}>{label}<input type={type} className={`${inputCls} mt-1`} value={pa[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></label>
  )

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-3xl w-full max-h-[92vh] overflow-y-auto rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Pre-auth #{pa.id} — {pa.patient_name}</h2>
            <p className="text-sm text-ink-4">{pa.tpa_name} · policy {pa.policy_number}</p>
          </div>
          <button onClick={onClose} className="text-ink-4 text-xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {text("member_id", "Member / card ID")}
          <label className={labelCls}>Treating doctor<div className="mt-1"><FieldInput field={doctorField("treating_doctor", "Treating doctor", false)} value={pa.treating_doctor} onChange={(v) => set("treating_doctor", v)} /></div></label>
          <label className={labelCls}>Admission
            <select className={`${inputCls} mt-1`} value={pa.admission_type ?? "planned"} onChange={(e) => set("admission_type", e.target.value)}>
              <option value="planned">Planned</option><option value="emergency">Emergency</option>
            </select>
          </label>
          {text("expected_admission_date", "Expected admission", "date")}
          {text("expected_stay_days", "Expected stay (days)", "number")}
          <label className={labelCls}>Room category
            <select className={`${inputCls} mt-1`} value={pa.room_category ?? ""} onChange={(e) => set("room_category", e.target.value)}>
              <option value="">—</option><option value="general">General</option><option value="semi_private">Semi-private</option><option value="private">Private</option><option value="icu">ICU</option>
            </select>
          </label>
          {text("diagnosis_code", "Diagnosis ICD-10 code")}
          <div className="sm:col-span-2">{text("diagnosis", "Diagnosis")}</div>
          <div className="sm:col-span-2">{text("procedure_name", "Proposed procedure / line of treatment")}</div>
          {text("procedure_code", "Procedure code")}
        </div>
        <label className={labelCls}>Clinical summary<textarea rows={3} className={`${inputCls} mt-1`} value={pa.clinical_summary ?? ""} onChange={(e) => set("clinical_summary", e.target.value)} /></label>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Estimated cost</h3>
            <button type="button" className="text-xs font-semibold text-brand" onClick={() => setLines([...lines, { category: "", description: "", amount: "" }])}>+ Add line</button>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <select aria-label="Category" className={`${inputCls} w-40`} value={l.category} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}>
                <option value="">Category</option>{["room", "procedure", "surgeon", "anaesthesia", "ot", "medicines", "consumables", "investigations", "implants", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input aria-label="Description" className={inputCls} placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <input aria-label="Amount" type="number" className={`${inputCls} w-36`} placeholder="₹" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              <button type="button" aria-label="Remove line" className="text-ink-4" onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <div className="text-sm font-semibold text-right">Total {inr(lines.length ? total : pa.claim_amount)}</div>
        </div>
        {nhcx && (
          <div className={`rounded-lg px-3 py-2 text-sm ${nhcx.ready ? "bg-success-bg text-success-text" : "bg-warning-bg text-warning-text"}`}>
            {nhcx.ready ? "Ready to send over NHCX." : <>For NHCX, still needed: {nhcx.missing.join(" · ")}</>}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {notice && <span className="mr-auto text-sm text-success-text">{notice}</span>}
          {error && <span className="mr-auto text-sm text-danger-text">{error}</span>}
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink-4">Close</button>
          <button onClick={submit} disabled={!nhcx?.ready} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border-strong dark:border-slate-600 disabled:opacity-50">Send over NHCX</button>
          <button onClick={save} className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white">Save</button>
        </div>
      </div>
    </div>
  )
}

export function NonPayablePanel() {
  return (
    <div className="space-y-6">
      <ResourceTable config={{
        title: "Non-payable item lists",
        description: "Items insurers don't pay for (e.g. the IRDAI list). A list with no insurer applies to every insurer. Matching lines on insurance bills are charged to the patient; the rest is claimable.",
        endpoint: "/tpa/non-payable-lists/", createLabel: "New list",
        columns: [col("name", "List"), col("tpa_name", "Insurer"), { key: "applies_to_categories", label: "Bill categories", render: (r) => (r.applies_to_categories ?? []).join(", ") || "insurance" }, col("item_count", "Items"), col("is_active", "Active")],
        fields: [{ key: "name", label: "Name", required: true, placeholder: "IRDAI non-payable items" }, { key: "tpa_company", label: "Insurer / TPA (blank = all)", type: "fk", source: "/tpa/companies/" },
          { key: "applies_to_categories", label: "Bill categories (JSON; blank = insurance)", type: "json", placeholder: '["insurance", "corporate"]' }, { key: "is_active", label: "Active", type: "boolean", defaultValue: true }],
      }} />
      <ResourceTable config={{
        title: "Non-payable items",
        description: "Each item matches bill lines by one of: a service tariff, a medicine name, or a word in the line's description.",
        endpoint: "/tpa/non-payable-items/", createLabel: "Add item",
        columns: [col("list_name", "List"), col("group_label", "Group"), col("matches", "Matches"), col("note", "Note")],
        fields: [{ key: "non_payable_list", label: "List", type: "fk", source: "/tpa/non-payable-lists/", required: true },
          { key: "group", label: "Group", type: "select", options: [{ value: "list_1", label: "List I — not payable" }, { value: "list_2", label: "List II — part of room charges" }, { value: "list_3", label: "List III — part of procedure charges" }, { value: "list_4", label: "List IV — part of treatment costs" }, { value: "other", label: "Insurer-specific" }], defaultValue: "list_1" },
          { key: "keyword", label: "Keyword in the bill line", placeholder: "e.g. gloves" }, { key: "tariff", label: "or Service tariff", type: "fk", source: "/finance/tariff/" },
          { key: "medicine", label: "or Medicine", type: "fk", source: "/pharmacy/medicines/" }, { key: "note", label: "Note" }],
      }} />
    </div>
  )
}

export function NHCXSetupCard() {
  const [p, setP] = useState({ participant_code: "", hfr_id: "", rohini_id: "" })
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get<typeof p>("/tpa/nhcx-profile/").then(setP).catch((e) => setError(extractApiError(e))) }, [])
  const save = async () => {
    setError(null)
    try {
      setP(await api.put<typeof p>("/tpa/nhcx-profile/", p))
      setNotice("Saved.")
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <section className={`${cardCls} max-w-2xl`}>
      <div>
        <h2 className="text-lg font-bold">NHCX set-up</h2>
        <p className="text-sm text-ink-4">The hospital's identity on the National Health Claims Exchange. Each insurer's participant code is set in the Insurer & TPA directory. Pre-auths can be sent once the hospital is onboarded and the NHCX gateway is connected.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {([["participant_code", "Participant code"], ["hfr_id", "HFR ID"], ["rohini_id", "ROHINI ID"]] as const).map(([k, l]) => (
          <label key={k} className={labelCls}>{l}<input className={`${inputCls} mt-1`} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="px-4 py-2 text-sm font-semibold rounded-lg bg-success text-white">Save</button>
        {notice && <span className="text-sm text-success-text">{notice}</span>}
        {error && <span className="text-sm text-danger-text">{error}</span>}
      </div>
    </section>
  )
}
