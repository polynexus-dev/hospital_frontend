import { useEffect, useState } from "react"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"
import { ModuleHub } from "../../components/resource/ModuleHub"
import { col, opts, patientField } from "./fields"

// Government schemes — PM-JAY, CGHS, ECHS: beneficiaries, package lists and the
// pre-auth → claim → settlement workflow, priced onto the admission's bill.

const inr = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
const inputCls = "w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", preauth_submitted: "Pre-auth submitted", preauth_query: "Pre-auth query", preauth_approved: "Pre-auth approved",
  preauth_rejected: "Pre-auth rejected", discharged: "Discharged — claim pending", claim_submitted: "Claim submitted", claim_query: "Claim query",
  claim_approved: "Claim approved", claim_rejected: "Claim rejected", settled: "Settled",
}

interface Step { to: string; label: string; tone?: "danger"; fields?: { key: string; label: string; type?: "number" | "checkbox"; required?: boolean }[] }
const NEXT: Record<string, Step[]> = {
  draft: [{ to: "preauth_submitted", label: "Submit pre-auth", fields: [{ key: "amount", label: "Amount requested (blank = package total)", type: "number" }] },
    { to: "discharged", label: "Mark discharged (no pre-auth scheme)" }],
  preauth_submitted: [
    { to: "preauth_approved", label: "Pre-auth approved", fields: [{ key: "preauth_number", label: "Pre-auth number", required: true }, { key: "amount", label: "Approved amount", type: "number" }] },
    { to: "preauth_query", label: "Query raised", fields: [{ key: "note", label: "Query" }] },
    { to: "preauth_rejected", label: "Rejected", tone: "danger", fields: [{ key: "note", label: "Reason" }] }],
  preauth_query: [{ to: "preauth_submitted", label: "Resubmit pre-auth" }, { to: "preauth_rejected", label: "Rejected", tone: "danger", fields: [{ key: "note", label: "Reason" }] }],
  preauth_rejected: [{ to: "preauth_submitted", label: "Resubmit pre-auth" }],
  preauth_approved: [{ to: "discharged", label: "Mark discharged" }],
  discharged: [{ to: "claim_submitted", label: "Submit claim", fields: [{ key: "claim_number", label: "Claim number" }, { key: "override_documents", label: "Submit even though documents are missing", type: "checkbox" }] }],
  claim_submitted: [
    { to: "claim_approved", label: "Claim approved", fields: [{ key: "amount", label: "Approved amount (blank = full claim)", type: "number" }, { key: "deduction_reason", label: "Deduction reason (if less)" }] },
    { to: "claim_query", label: "Query raised", fields: [{ key: "note", label: "Query" }] },
    { to: "claim_rejected", label: "Rejected", tone: "danger", fields: [{ key: "note", label: "Reason" }] }],
  claim_query: [{ to: "claim_submitted", label: "Reply & resubmit" }, { to: "claim_rejected", label: "Rejected", tone: "danger", fields: [{ key: "note", label: "Reason" }] }],
  claim_rejected: [{ to: "claim_submitted", label: "Appeal / resubmit" }],
  claim_approved: [{ to: "settled", label: "Record settlement", fields: [{ key: "utr_number", label: "UTR number", required: true }, { key: "amount", label: "Amount received (blank = approved)", type: "number" }] }],
}

function CaseCard({ c, onChange }: { c: any; onChange: (next: any) => void }) {
  const [packages, setPackages] = useState<any[]>([])
  const [pkg, setPkg] = useState("")
  const [step, setStep] = useState<Step | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)
  const [billInfo, setBillInfo] = useState<any>(null)
  const editablePackages = ["draft", "preauth_query", "preauth_rejected"].includes(c.status)

  useEffect(() => {
    if (editablePackages) api.get<any>(`/schemes/packages/?page_size=500&is_active=true`).then((r) => setPackages((r.results ?? r).filter((p: any) => p.scheme_code === c.scheme_code))).catch(() => setPackages([]))
  }, [c.scheme_code, editablePackages])

  const run = async (fn: () => Promise<any>) => {
    setError(null)
    try {
      const res = await fn()
      if (res?.id) onChange(res)
      return res
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const post = (path: string, body: object = {}) => api.post<any>(`/schemes/cases/${c.id}/${path}`, body)

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-white dark:bg-slate-800">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <div className="font-semibold">{c.patient_name} <span className="text-slate-400 font-normal">· {c.beneficiary_label}</span></div>
          <div className="text-sm text-slate-500">{c.diagnosis || "No diagnosis recorded"}{c.admission ? ` · admission #${c.admission}` : ""}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase font-semibold text-emerald-700">{STATUS_LABEL[c.status] ?? c.status}</div>
          <div className="text-sm">Claim {inr(c.claim_amount)}{c.claim_due_by && c.status === "discharged" ? ` · due ${c.claim_due_by}` : ""}</div>
        </div>
      </div>

      <div className="text-sm">
        <div className="text-xs font-semibold text-slate-500 mb-1">Packages</div>
        {c.packages.length ? c.packages.map((p: any) => (
          <div key={p.id} className="flex justify-between gap-2">
            <span>{p.code} — {p.name} × {p.quantity}</span>
            <span>{inr(Number(p.rate) * p.quantity)}{editablePackages && <button className="ml-2 text-rose-600 text-xs" onClick={() => run(() => post("remove-package/", { package: p.package }))}>remove</button>}</span>
          </div>
        )) : <div className="text-slate-400">None yet.</div>}
        {editablePackages && (
          <div className="flex gap-2 mt-2">
            <select className={inputCls} value={pkg} onChange={(e) => setPkg(e.target.value)}>
              <option value="">Add a package…</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name} ({inr(p.rate)})</option>)}
            </select>
            <button disabled={!pkg} onClick={() => run(() => post("add-package/", { package: pkg })).then(() => setPkg(""))} className="px-3 text-sm font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50">Add</button>
          </div>
        )}
      </div>

      <div className="text-sm">
        <div className="text-xs font-semibold text-slate-500 mb-1">Documents</div>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
          {c.document_checklist.map((d: string) => (
            <label key={d} className="flex items-center gap-2">
              <input type="checkbox" checked={!!c.documents?.[d]} onChange={(e) => run(() => post("documents/", { document: d, attached: e.target.checked }))} />
              <span className={c.documents?.[d] ? "" : "text-slate-500"}>{d}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => run(() => post("apply-to-bill/")).then((r) => { if (r) { setBillInfo(r); onChange({ ...c, claim_amount: r.claim_amount }) } })}
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700">Apply to bill</button>
        <button onClick={async () => triggerBlobDownload(await api.getBlob(`/schemes/cases/${c.id}/claim-pack/`), `claim-${c.id}.pdf`)}
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-slate-700">Claim pack PDF</button>
        {(NEXT[c.status] ?? []).map((s) => (
          <button key={s.to} onClick={() => { setStep(s); setForm({}) }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${s.tone === "danger" ? "bg-rose-50 text-rose-700" : "bg-emerald-600 text-white"}`}>{s.label}</button>
        ))}
      </div>
      {billInfo && <div className="text-sm text-slate-600">Bill {billInfo.bill_number}: net {inr(billInfo.net_amount)} · scheme pays {inr(billInfo.claim_amount)} · patient pays {inr(billInfo.patient_payable)}</div>}

      {step && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
          {(step.fields ?? []).map((f) => f.type === "checkbox" ? (
            <label key={f.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />{f.label}</label>
          ) : (
            <label key={f.key} className="block text-xs font-semibold text-slate-600">{f.label}{f.required && " *"}
              <input type={f.type === "number" ? "number" : "text"} className={`${inputCls} mt-1`} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </label>
          ))}
          <div className="flex gap-2">
            <button onClick={() => run(() => post("transition/", { to: step.to, ...form })).then((r) => r && setStep(null))} className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white">Confirm: {step.label}</button>
            <button onClick={() => setStep(null)} className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700">Cancel</button>
          </div>
        </div>
      )}
      {error && <div className="text-sm text-rose-700">{error}</div>}
      {c.history?.length > 0 && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">History ({c.history.length})</summary>
          {c.history.map((h: any, i: number) => <div key={i}>{new Date(h.at).toLocaleString()} · {h.by} · {STATUS_LABEL[h.from] ?? h.from} → {STATUS_LABEL[h.to] ?? h.to}{h.note ? ` — ${h.note}` : ""}</div>)}
        </details>
      )}
    </div>
  )
}

function ClaimsPanel() {
  const [dash, setDash] = useState<any>(null)
  const [cases, setCases] = useState<any[]>([])
  const [status, setStatus] = useState("")
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ beneficiary: "", admission: "", diagnosis: "" })
  const [beneficiaries, setBeneficiaries] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    api.get<any>("/schemes/cases/dashboard/").then(setDash).catch(() => setDash(null))
    api.get<any>(`/schemes/cases/?page_size=100${status ? `&status=${status}` : ""}`).then((r) => setCases(r.results ?? r)).catch((e) => setError(extractApiError(e)))
  }
  useEffect(load, [status]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (creating) api.get<any>("/schemes/beneficiaries/?page_size=500&eligibility=eligible").then((r) => setBeneficiaries(r.results ?? r)).catch(() => setBeneficiaries([]))
  }, [creating])

  const create = async () => {
    setError(null)
    try {
      await api.post("/schemes/cases/", { beneficiary: draft.beneficiary, admission: draft.admission || null, diagnosis: draft.diagnosis })
      setCreating(false)
      setDraft({ beneficiary: "", admission: "", diagnosis: "" })
      load()
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  return (
    <div className="space-y-5">
      {dash && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[["Outstanding claims", inr(dash.outstanding_amount)], ["Claims overdue", String(dash.claims_overdue.length)],
            ["Avg days to settle", dash.average_days_to_settle ?? "—"], ["Rejection rate", dash.claim_rejection_rate != null ? `${dash.claim_rejection_rate}%` : "—"]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <div className="text-xs text-slate-500">{l}</div><div className="text-2xl font-bold">{v}</div>
            </div>
          ))}
        </div>
      )}
      {dash?.claims_overdue.length > 0 && (
        <div className="text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
          Claims past their submission deadline: {dash.claims_overdue.map((o: any) => `${o.beneficiary} (${o.days_late} days late)`).join(", ")}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <select className={`${inputCls} w-56`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setCreating((v) => !v)} className="ml-auto px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg">+ New scheme case</button>
      </div>
      {creating && (
        <div className="border border-slate-200 rounded-xl p-4 grid md:grid-cols-3 gap-3 bg-white dark:bg-slate-800">
          <label className="text-xs font-semibold text-slate-600">Beneficiary (verified eligible)
            <select className={`${inputCls} mt-1`} value={draft.beneficiary} onChange={(e) => setDraft({ ...draft, beneficiary: e.target.value })}>
              <option value="">Choose…</option>
              {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.patient_name} — {b.scheme_code?.toUpperCase()} {b.beneficiary_id}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Admission ID<input className={`${inputCls} mt-1`} value={draft.admission} onChange={(e) => setDraft({ ...draft, admission: e.target.value })} placeholder="From the IPD admission" /></label>
          <label className="text-xs font-semibold text-slate-600">Diagnosis<input className={`${inputCls} mt-1`} value={draft.diagnosis} onChange={(e) => setDraft({ ...draft, diagnosis: e.target.value })} /></label>
          <div className="md:col-span-3"><button onClick={create} disabled={!draft.beneficiary} className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white disabled:opacity-50">Create case</button></div>
        </div>
      )}
      {error && <div className="text-sm text-rose-700">{error}</div>}
      <div className="space-y-3">
        {cases.length ? cases.map((c) => <CaseCard key={c.id} c={c} onChange={(next) => { setCases((cs) => cs.map((x) => (x.id === next.id ? next : x))); api.get<any>("/schemes/cases/dashboard/").then(setDash).catch(() => undefined) }} />)
          : <div className="text-sm text-slate-500">No scheme cases{status ? " with this status" : ""}.</div>}
      </div>
    </div>
  )
}

export function SchemesPage() {
  return (
    <ModuleHub
      title="Government Schemes"
      subtitle="PM-JAY, CGHS, ECHS — beneficiary verification, package pricing, pre-authorisation, claims and settlement"
      tabs={[
        { key: "claims", label: "Claims", render: () => <ClaimsPanel /> },
        {
          key: "beneficiaries", label: "Beneficiaries",
          resource: {
            title: "Scheme beneficiaries", endpoint: "/schemes/beneficiaries/", createLabel: "Add beneficiary",
            filters: [{ key: "eligibility", label: "Eligibility", type: "select", options: opts("unverified", "eligible", "ineligible") }],
            columns: [col("patient_name", "Patient"), { key: "scheme_code", label: "Scheme", render: (r) => String(r.scheme_code ?? "").toUpperCase() }, col("beneficiary_id", "Beneficiary ID"),
              col("family_id", "Family ID"), col("card_valid_to", "Card valid to"), { key: "eligibility", label: "Eligibility" }],
            fields: [patientField(), { key: "scheme", label: "Scheme", type: "fk", source: "/schemes/schemes/", required: true },
              { key: "beneficiary_id", label: "Beneficiary / card ID", required: true }, { key: "family_id", label: "Family ID" }, { key: "relation", label: "Relation to card holder" },
              { key: "card_valid_to", label: "Card valid to", type: "date" }],
            actions: [{ label: "Record verification", path: "verify/", tone: "primary", prompt: [
              { key: "eligibility", label: "Result from the scheme portal / BIS", type: "select", options: opts("eligible", "ineligible"), required: true },
              { key: "card_valid_to", label: "Card valid to", type: "date" }, { key: "notes", label: "Notes" }] }],
          },
        },
        {
          key: "schemes", label: "Schemes",
          resource: {
            title: "Schemes the hospital is empanelled for", endpoint: "/schemes/schemes/", createLabel: "Add scheme",
            columns: [col("name", "Scheme"), col("code", "Code"), col("billing_mode", "Billing"), col("empanelment_number", "Empanelment no."),
              col("claim_submission_days", "Claim within (days)"), col("copay_percent", "Co-pay %"), col("is_active", "Active")],
            fields: [{ key: "name", label: "Name", required: true }, { key: "code", label: "Code (also the rate category, e.g. cghs)", required: true },
              { key: "billing_mode", label: "Billing", type: "select", options: [{ value: "package", label: "Package rates (PM-JAY style)" }, { value: "rate_list", label: "Scheme rate list (CGHS / ECHS style)" }], required: true },
              { key: "payer", label: "Payer" }, { key: "empanelment_number", label: "Empanelment / HOSP ID" }, { key: "preauth_required", label: "Pre-auth required", type: "boolean", defaultValue: true },
              { key: "claim_submission_days", label: "Submit claim within (days of discharge)", type: "number", defaultValue: 15 }, { key: "copay_percent", label: "Patient co-pay %", type: "number", defaultValue: 0 },
              { key: "claim_portal_url", label: "Claim portal URL" }],
            toolbar: [{ label: "Add PM-JAY, CGHS, ECHS", path: "install-defaults/", method: "post" }],
            actions: [{ label: "Import packages (CSV)", path: "import-packages/", prompt: [
              { key: "csv", label: "CSV — columns: code, name, rate [, specialty, expected_los_days, preauth_required, implant_included, includes]", type: "textarea", required: true }] }],
          },
        },
        {
          key: "packages", label: "Packages",
          resource: {
            title: "Scheme packages / procedures", endpoint: "/schemes/packages/", createLabel: "Add package",
            filters: [{ key: "scheme", label: "Scheme", type: "fk", source: "/schemes/schemes/" }],
            columns: [{ key: "scheme_code", label: "Scheme", render: (r) => String(r.scheme_code ?? "").toUpperCase() }, col("code", "Code"), col("name", "Package"), col("specialty", "Specialty"),
              { key: "rate", label: "Rate", render: (r) => inr(r.rate) }, col("expected_los_days", "LOS (days)"), col("preauth_required", "Pre-auth"), col("is_active", "Active")],
            fields: [{ key: "scheme", label: "Scheme", type: "fk", source: "/schemes/schemes/", required: true }, { key: "code", label: "Code", required: true }, { key: "name", label: "Name", required: true },
              { key: "specialty", label: "Specialty" }, { key: "rate", label: "Rate", type: "number", required: true }, { key: "expected_los_days", label: "Expected LOS (days)", type: "number" },
              { key: "includes", label: "What's included", type: "textarea" }, { key: "implant_included", label: "Implant included", type: "boolean", defaultValue: true },
              { key: "preauth_required", label: "Pre-auth required", type: "boolean", defaultValue: true }],
          },
        },
      ]}
    />
  )
}
