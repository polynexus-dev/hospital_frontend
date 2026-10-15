import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { ApiError, api, extractApiError } from "../../api/client"
import {
  advanceBalance, checkDuplicates, listApprovers, listDistricts, listOptions, listStates, lookupPincode, previewVisit, printDocument, registerVisit,
} from "../../api/frontdesk"
import type { DuplicateMatch, PinLookup, RegistrationResult } from "../../api/frontdesk"

// OPD front desk (NABH AAC.1/AAC.2, FPM.3): find or register the patient,
// open the visit, bill and take payment in one save. Keyboard-first:
// Ctrl+S saves, Ctrl+N starts a new registration.

const TITLES = ["", "Mr", "Mrs", "Ms", "Master", "Baby", "Dr"]
const PAYERS = [
  ["self", "Self-pay"], ["corporate", "Corporate"], ["tpa", "TPA"], ["insurance", "Insurance"], ["scheme", "Govt scheme"], ["health_camp", "Health camp"],
] as const
const RATE_CATEGORIES = ["general", "private", "insurance", "corporate", "staff"]
const PAY_MODES = [["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["bank_transfer", "Bank transfer"], ["cheque", "Cheque"], ["advance", "From advance"]] as const

const input = "w-full h-8 px-2.5 border border-border-strong rounded-control text-[13px] bg-surface focus:border-brand outline-none"
const label = "block text-[11px] font-semibold text-ink-3 mb-1"

type Row = Record<string, any>

interface Payment {
  method: string
  amount: string
  reference: string
}

const blankPatient = () => ({
  title: "", first_name: "", last_name: "", gender: "", date_of_birth: "", age_years: "", age_months: "",
  mobile: "", whatsapp: "", whatsapp_same: true, email: "", nationality: "IN", passport_number: "",
  pincode: "", state: "", district: "", sub_district: "", village_or_area: "", address: "", is_vvip: false, tags: "",
})

const blankVisit = () => ({
  department: "", doctor: "", visit_type: "", case_type: "new_complaint", payer_type: "self", rate_category: "",
  corporate_client: "", tpa: "", scheme: "", campaign: "", insurance_policy: "", referred_by: "", referral_note: "", marketing_person: "",
})

const money = (v: string | number) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

async function openPdf(path: string) {
  const blob = await printDocument(path)
  window.open(URL.createObjectURL(blob), "_blank")
}

export function OPDRegistrationPage() {
  const [params] = useSearchParams()
  const [registerOnly, setRegisterOnly] = useState(params.get("mode") === "register")
  const [existing, setExisting] = useState<Row | null>(null)
  const [patient, setPatient] = useState(blankPatient)
  const [useAge, setUseAge] = useState(false)
  const [abha, setAbha] = useState("")
  const [visit, setVisit] = useState(blankVisit)
  const [consents, setConsents] = useState<Record<number, boolean>>({})
  const [consentMethod, setConsentMethod] = useState("written")
  const [packages, setPackages] = useState<number[]>([])
  const [discount, setDiscount] = useState({ mode: "percent", value: "", reason: "", approver: "", password: "" })
  const [settlement, setSettlement] = useState<"receipt" | "credit">("receipt")
  const [payments, setPayments] = useState<Payment[]>([{ method: "cash", amount: "", reference: "" }])
  const [search, setSearch] = useState("")
  const [dupes, setDupes] = useState<DuplicateMatch[]>([])
  const [pin, setPin] = useState<PinLookup | null>(null)
  const [error, setError] = useState<string>("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<RegistrationResult | null>(null)
  const firstField = useRef<HTMLInputElement>(null)

  const setP = (k: string, v: unknown) => setPatient((p) => ({ ...p, [k]: v }))
  const setV = (k: string, v: unknown) => setVisit((p) => ({ ...p, [k]: v }))

  // --- reference data (each list is empty if that module isn't licensed)
  const departments = useQuery({ queryKey: ["fd-departments"], queryFn: () => listOptions<Row>("/departments/?page_size=200") })
  const doctors = useQuery({ queryKey: ["fd-doctors"], queryFn: () => listOptions<Row>("/doctors/?page_size=300&is_active=true") })
  const referrers = useQuery({ queryKey: ["fd-referrers"], queryFn: () => listOptions<Row>("/referrals/doctors/?page_size=300") })
  const pkgList = useQuery({ queryKey: ["fd-packages"], queryFn: () => listOptions<Row>("/packages/catalog/?is_active=true&page_size=200") })
  const corporates = useQuery({ queryKey: ["fd-corporates"], queryFn: () => listOptions<Row>("/packages/corporate-clients/?page_size=200") })
  const tpas = useQuery({ queryKey: ["fd-tpas"], queryFn: () => listOptions<Row>("/tpa/companies/?page_size=200&is_active=true") })
  const schemes = useQuery({ queryKey: ["fd-schemes"], queryFn: () => listOptions<Row>("/schemes/schemes/?page_size=200") })
  const camps = useQuery({ queryKey: ["fd-camps"], queryFn: () => listOptions<Row>("/packages/campaigns/?page_size=200") })
  const notices = useQuery({ queryKey: ["fd-notices"], queryFn: () => listOptions<Row>("/privacy/consent-notices/?is_active=true&language=en&page_size=50") })
  const states = useQuery({ queryKey: ["fd-states"], queryFn: listStates })
  const districts = useQuery({ queryKey: ["fd-districts", patient.state], queryFn: () => listDistricts(patient.state), enabled: !!patient.state })
  const approvers = useQuery({ queryKey: ["fd-approvers"], queryFn: listApprovers })
  const staff = useQuery({ queryKey: ["fd-staff"], queryFn: () => listOptions<Row>("/users/?is_active=true&page_size=300") })
  const policies = useQuery({
    queryKey: ["fd-policies", existing?.id],
    queryFn: () => listOptions<Row>(`/finance/insurance-policies/?patient=${existing!.id}`),
    enabled: !!existing && visit.payer_type === "insurance",
  })
  const searchResults = useQuery({
    queryKey: ["fd-search", search],
    queryFn: () => listOptions<Row>(`/patients/?search=${encodeURIComponent(search)}&page_size=8`),
    enabled: search.trim().length >= 2,
  })

  const doctorOptions = useMemo(
    () => (doctors.data ?? []).filter((d) => !visit.department || String(d.department) === String(visit.department)),
    [doctors.data, visit.department],
  )

  // --- live preview: new/follow-up and the charges
  const preview = useQuery({
    queryKey: ["fd-preview", registerOnly, visit.doctor, existing?.id, visit.rate_category, packages.join(","), visit.visit_type],
    queryFn: () => previewVisit(registerOnly
      ? { register_only: "1", patient: existing ? String(existing.id) : "", rate_category: visit.rate_category }
      : { doctor: String(visit.doctor), patient: existing ? String(existing.id) : "", rate_category: visit.rate_category, packages: packages.join(","), visit_type: visit.visit_type }),
    enabled: registerOnly || !!visit.doctor,
  })
  const advance = useQuery({ queryKey: ["fd-advance", existing?.id], queryFn: () => advanceBalance(existing!.id), enabled: !!existing })

  const gross = Number(preview.data?.total ?? 0)
  const discountAmount = discount.value ? (discount.mode === "percent" ? (gross * Number(discount.value)) / 100 : Number(discount.value)) : 0
  const discountPercent = gross ? (discountAmount * 100) / gross : 0
  const limit = Number(preview.data?.policy.discount_limit_percent ?? 100)
  const needsApprover = discountAmount > 0 && discountPercent > limit
  const afterDiscount = Math.max(0, gross - discountAmount)
  const net = preview.data?.policy.round_down_to_rupee === false ? afterDiscount : Math.floor(afterDiscount + 1e-9)
  const roundOff = afterDiscount - net
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const creditAllowed = (preview.data?.policy.credit_payer_types ?? []).includes(visit.payer_type)
  const sendForApproval = needsApprover && !discount.approver

  // Keep the single payment line equal to the net until the user splits it.
  useEffect(() => {
    if (payments.length === 1 && payments[0].method !== "advance") {
      setPayments([{ ...payments[0], amount: net ? net.toFixed(2) : "" }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net])

  // --- live duplicate check while typing a new patient
  useEffect(() => {
    if (existing || (!patient.mobile && !patient.first_name)) {
      setDupes([])
      return
    }
    const t = setTimeout(() => {
      checkDuplicates({ first_name: patient.first_name, last_name: patient.last_name, mobile: patient.mobile, date_of_birth: patient.date_of_birth || undefined })
        .then(setDupes).catch(() => setDupes([]))
    }, 500)
    return () => clearTimeout(t)
  }, [existing, patient.first_name, patient.last_name, patient.mobile, patient.date_of_birth])

  // --- PIN code fills the address
  useEffect(() => {
    if (patient.pincode.length !== 6) {
      setPin(null)
      return
    }
    lookupPincode(patient.pincode).then((res) => {
      setPin(res)
      if (res.found) setPatient((p) => ({ ...p, state: res.state ?? p.state, district: res.district ?? p.district, sub_district: res.sub_districts?.[0] ?? p.sub_district }))
    }).catch(() => setPin(null))
  }, [patient.pincode])

  const selectExistingPatient = async (id: number) => {
    const p = await api.get<Row>(`/patients/${id}/`)
    setExisting(p)
    setSearch("")
    setDupes([])
  }

  const reset = useCallback(() => {
    setExisting(null); setPatient(blankPatient()); setUseAge(false); setAbha(""); setVisit(blankVisit()); setConsents({})
    setPackages([]); setDiscount({ mode: "percent", value: "", reason: "", approver: "", password: "" }); setSettlement("receipt")
    setPayments([{ method: "cash", amount: "", reference: "" }]); setError(""); setFieldErrors({}); setResult(null); setPin(null)
    setTimeout(() => firstField.current?.focus(), 0)
  }, [])

  const save = useCallback(async (confirmNotDuplicate = false) => {
    setSaving(true)
    setError("")
    setFieldErrors({})
    const p: Row = { ...patient }
    if (p.whatsapp_same) p.whatsapp = ""
    delete p.whatsapp_same
    p.tags = String(p.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean)
    if (useAge) delete p.date_of_birth
    else { delete p.age_years; delete p.age_months }
    if (p.nationality === "IN") p.passport_number = ""
    const v: Row = Object.fromEntries(Object.entries(visit).filter(([, val]) => val !== ""))
    const body: Row = {
      ...(registerOnly ? { register_only: true } : {}),
      ...(existing ? { patient_id: existing.id } : { patient: p }),
      confirm_not_duplicate: confirmNotDuplicate,
      abha_number: abha,
      consents: Object.entries(consents).filter(([, on]) => on).map(([notice]) => ({ notice: Number(notice), status: "granted", method: consentMethod })),
      visit: registerOnly ? { rate_category: visit.rate_category } : v,
      billing: {
        packages,
        ...(discountAmount > 0 ? { [discount.mode === "percent" ? "discount_percent" : "discount_amount"]: discount.value, discount_reason: discount.reason } : {}),
        ...(needsApprover && discount.approver ? { approver: Number(discount.approver), approver_password: discount.password } : {}),
        settlement,
        payments: settlement === "credit" || sendForApproval ? [] : payments.filter((x) => Number(x.amount) > 0),
      },
    }
    try {
      const res = await registerVisit(body)
      setResult(res)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.body as { matches?: DuplicateMatch[] }
        setDupes(data.matches ?? [])
        setError("This person is already registered. Use the existing record below, or save as a different person if you're sure.")
      } else if (err instanceof ApiError && err.status === 400 && err.body && typeof err.body === "object") {
        const flat: Record<string, string> = {}
        for (const [k, val] of Object.entries(err.body as Record<string, unknown>)) flat[k] = Array.isArray(val) ? val.join(" ") : typeof val === "object" ? JSON.stringify(val) : String(val)
        setFieldErrors(flat)
        setError(Object.values(flat)[0] ?? "Please check the form.")
      } else {
        setError(extractApiError(err))
      }
    } finally {
      setSaving(false)
    }
  }, [patient, visit, existing, abha, consents, consentMethod, packages, discount, discountAmount, needsApprover, settlement, payments, sendForApproval, useAge, registerOnly])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!saving && !result) void save() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); reset() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [save, reset, saving, result])

  const err = (k: string) => fieldErrors[k] && <div className="text-[11px] text-danger-text mt-0.5">{fieldErrors[k]}</div>

  if (result) {
    return (
      <Card padded>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] text-ink-4">Registered</div>
            <div className="text-[20px] font-bold">{result.patient.full_name}</div>
            <div className="text-[13px] text-ink-3">UHID <span className="font-mono font-semibold">{result.patient.uhid}</span>{result.visit ? ` · ${result.visit.visit_number} · ${result.visit.visit_type_label}` : " · registered without a visit"}</div>
            {result.visit && <div className="text-[13px] text-ink-3">Dr. {result.visit.doctor_name}{result.visit.department_name ? ` · ${result.visit.department_name}` : ""}</div>}
          </div>
          {result.visit && (
            <div className="text-center rounded-card bg-accent-tint px-6 py-3">
              <div className="text-[11px] uppercase tracking-wider text-accent font-semibold">Token</div>
              <div className="text-[36px] font-bold text-accent leading-none">{result.visit.token ?? "—"}</div>
            </div>
          )}
        </div>
        {result.bill && (
          <div className="mt-4 text-[13px]">
            Bill <span className="font-mono">{result.bill.bill_number}</span>: net {money(result.bill.net)} ·{" "}
            {result.awaiting_discount_approval ? <Pill tone="warn">⏳ Discount awaiting approval: take payment after it's approved</Pill>
              : result.bill.status === "paid" ? <Pill tone="ok">✓ Paid</Pill> : <Pill tone="warn">Billed on credit</Pill>}
          </div>
        )}
        {result.warnings.map((w) => <div key={w} className="mt-2 text-[12.5px] text-warning-text">⚠ {w}</div>)}
        <div className="mt-4 flex flex-wrap gap-2">
          {result.links.receipt && <Button variant="primary" onClick={() => openPdf(result.links.receipt!)}>Print receipt</Button>}
          <Button variant="secondary" onClick={() => openPdf(result.links.card)}>Print registration card</Button>
          <Button variant="secondary" onClick={() => openPdf(result.links.sticker + "?copies=3")}>Print 3 stickers</Button>
          <Button variant="secondary" onClick={reset}>New registration (Ctrl+N)</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3 min-h-full flex flex-col">
      {/* Find patient */}
      <Card padded>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-64">
            <input ref={firstField} autoFocus aria-label="Find patient" className={input} placeholder="Find patient: name, mobile or UHID (returning patients)" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search.trim().length >= 2 && (
              <div className="absolute z-20 left-0 right-0 top-9 bg-surface border border-border rounded-control shadow-lg max-h-72 overflow-y-auto">
                {(searchResults.data ?? []).length === 0 && <div className="px-3 py-2 text-[12.5px] text-ink-4">{searchResults.isFetching ? "Searching…" : "No match. Fill in the form for a new patient."}</div>}
                {(searchResults.data ?? []).map((r) => (
                  <button key={r.id} type="button" onClick={() => selectExistingPatient(r.id)} className="w-full text-left px-3 py-2 text-[13px] hover:bg-page border-b border-border-faint">
                    <span className="font-semibold">{r.full_name}</span> <span className="font-mono text-ink-4">{r.uhid}</span>
                    <span className="text-ink-4"> · {r.gender || "—"} · {r.date_of_birth || "age not recorded"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {existing ? (
            <div className="flex items-center gap-2 text-[13px]">
              <Pill tone="info">Returning: {existing.full_name} · {existing.uhid}</Pill>
              <Button size="sm" variant="ghost" onClick={() => setExisting(null)}>Register someone new instead</Button>
            </div>
          ) : <Pill tone="neutral">New patient</Pill>}
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input type="checkbox" checked={registerOnly} onChange={(e) => setRegisterOnly(e.target.checked)} /> Register only (no visit)
          </label>
        </div>
      </Card>

      {/* Patient details */}
      {!existing && (
        <Card padded>
          <div className="text-[13px] font-semibold mb-2">Patient</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
            <label className="block "><span className={label}>Title</span><select className={input} value={patient.title} onChange={(e) => setP("title", e.target.value)}>{TITLES.map((t) => <option key={t} value={t}>{t || "—"}</option>)}</select></label>
            <label className="block md:col-span-2"><span className={label}>First name *</span><input className={input} value={patient.first_name} onChange={(e) => setP("first_name", e.target.value)} />{err("first_name")}</label>
            <label className="block md:col-span-2"><span className={label}>Last name</span><input className={input} value={patient.last_name} onChange={(e) => setP("last_name", e.target.value)} /></label>
            <label className="block "><span className={label}>Gender *</span><select className={input} value={patient.gender} onChange={(e) => setP("gender", e.target.value)}><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
            <div className="md:col-span-2">
              <label className={label}>
                <button type="button" className={`mr-2 ${!useAge ? "text-brand underline" : ""}`} onClick={() => setUseAge(false)}>Date of birth</button>/
                <button type="button" className={`ml-2 ${useAge ? "text-brand underline" : ""}`} onClick={() => setUseAge(true)}>Age</button>
              </label>
              {useAge ? (
                <div className="flex gap-1.5">
                  <input aria-label="Age in years" className={input} inputMode="numeric" placeholder="Years" value={patient.age_years} onChange={(e) => setP("age_years", e.target.value.replace(/\D/g, ""))} />
                  <input aria-label="Age in months" className={input} inputMode="numeric" placeholder="Months" value={patient.age_months} onChange={(e) => setP("age_months", e.target.value.replace(/\D/g, ""))} />
                </div>
              ) : <input aria-label="Date of birth" type="date" className={input} value={patient.date_of_birth} onChange={(e) => setP("date_of_birth", e.target.value)} />}
              {err("date_of_birth")}
            </div>
            <div className="md:col-span-2"><label className={label}>Mobile *</label><div className="flex"><span className="h-8 px-2 flex items-center border border-r-0 border-border-strong rounded-l-control text-[12px] text-ink-4 bg-page">+91</span><input aria-label="Mobile number" className={`${input} rounded-l-none`} inputMode="tel" maxLength={10} value={patient.mobile} onChange={(e) => setP("mobile", e.target.value.replace(/\D/g, ""))} /></div>{err("mobile")}</div>
            <div className="md:col-span-2">
              <label className={label}>WhatsApp <input type="checkbox" aria-label="WhatsApp same as mobile" className="ml-2" checked={patient.whatsapp_same} onChange={(e) => setP("whatsapp_same", e.target.checked)} /> same as mobile</label>
              <input aria-label="WhatsApp number" className={input} disabled={patient.whatsapp_same} inputMode="tel" value={patient.whatsapp_same ? patient.mobile : patient.whatsapp} onChange={(e) => setP("whatsapp", e.target.value.replace(/\D/g, ""))} />
            </div>
            <label className="block md:col-span-2"><span className={label}>Email</span><input className={input} type="email" value={patient.email} onChange={(e) => setP("email", e.target.value)} />{err("email")}</label>
            <label className="block md:col-span-2"><span className={label}>ABHA number</span><input className={`${input} font-mono`} placeholder="14 digits" value={abha} onChange={(e) => setAbha(e.target.value)} />{err("abha_number")}</label>
            <label className="block "><span className={label}>Nationality</span><select className={input} value={patient.nationality} onChange={(e) => setP("nationality", e.target.value)}><option value="IN">Indian</option><option value="NP">Nepal</option><option value="BD">Bangladesh</option><option value="LK">Sri Lanka</option><option value="AE">UAE</option><option value="US">USA</option><option value="GB">UK</option><option value="XX">Other</option></select></label>
            {patient.nationality !== "IN" && <label className="block md:col-span-2"><span className={label}>Passport number</span><input className={`${input} font-mono uppercase`} value={patient.passport_number} onChange={(e) => setP("passport_number", e.target.value)} /></label>}
            <div className="flex items-end gap-2"><label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={patient.is_vvip} onChange={(e) => setP("is_vvip", e.target.checked)} /> VVIP</label></div>
            <label className="block md:col-span-2"><span className={label}>Tags (comma separated)</span><input className={input} placeholder="senior citizen, staff family" value={patient.tags} onChange={(e) => setP("tags", e.target.value)} /></label>
          </div>

          {dupes.length > 0 && (
            <div className="mt-3 rounded-control border border-warning bg-warning-bg px-3 py-2">
              <div className="text-[12.5px] font-semibold text-warning-text mb-1">⚠ Possible existing registration</div>
              {dupes.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] py-1">
                  <span><b>{d.name}</b> <span className="font-mono">{d.uhid}</span> · {d.match === "exact" ? "exact match" : "possible match"}: {d.reasons.join(", ")}</span>
                  <Button size="sm" variant="secondary" onClick={() => selectExistingPatient(d.id)}>Use this patient</Button>
                </div>
              ))}
            </div>
          )}

          <div className="text-[13px] font-semibold mt-4 mb-2">Address</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
            <div><label className={label}>PIN code</label><input aria-label="PIN code" className={`${input} font-mono`} inputMode="numeric" maxLength={6} value={patient.pincode} onChange={(e) => setP("pincode", e.target.value.replace(/\D/g, ""))} />
              {pin && !pin.found && <div className="text-[11px] text-ink-4 mt-0.5">{pin.directory_loaded ? "PIN not found; fill in below" : "PIN directory not loaded; fill in below"}</div>}</div>
            <label className="block "><span className={label}>State</span><select className={input} value={patient.state} onChange={(e) => setP("state", e.target.value)}><option value="">—</option>{(states.data ?? []).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}</select></label>
            <label className="block "><span className={label}>District</span><input className={input} list="fd-districts" value={patient.district} onChange={(e) => setP("district", e.target.value)} /><datalist id="fd-districts">{(districts.data ?? []).map((d) => <option key={d} value={d} />)}</datalist></label>
            <label className="block "><span className={label}>Taluka / tehsil</span><input className={input} list="fd-subdistricts" value={patient.sub_district} onChange={(e) => setP("sub_district", e.target.value)} /><datalist id="fd-subdistricts">{(pin?.sub_districts ?? []).map((d) => <option key={d} value={d} />)}</datalist></label>
            <label className="block md:col-span-2"><span className={label}>Village / area</span><input className={input} list="fd-areas" value={patient.village_or_area} onChange={(e) => setP("village_or_area", e.target.value)} /><datalist id="fd-areas">{(pin?.areas ?? []).map((d) => <option key={d} value={d} />)}</datalist></label>
            <label className="block md:col-span-6"><span className={label}>House / street</span><input className={input} value={patient.address} onChange={(e) => setP("address", e.target.value)} /></label>
          </div>
        </Card>
      )}

      {/* Consent */}
      {(notices.data ?? []).length > 0 && (
        <Card padded>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="text-[13px] font-semibold">Consent (read or give the notice to the patient; tick only what they agree to)</div>
            <select className={`${input} w-auto`} value={consentMethod} onChange={(e) => setConsentMethod(e.target.value)}><option value="written">Signed form</option><option value="verbal">Verbal, witnessed</option><option value="digital">Digital</option></select>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {(notices.data ?? []).map((n) => (
              <label key={n.id} className="flex items-center gap-1.5 text-[12.5px]" title={n.body}>
                <input type="checkbox" checked={!!consents[n.id]} onChange={(e) => setConsents((c) => ({ ...c, [n.id]: e.target.checked }))} /> {n.purpose_label}
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Visit and payer */}
      {!registerOnly && <Card padded>
        <div className="text-[13px] font-semibold mb-2">Visit</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
          <label className="block md:col-span-2"><span className={label}>Department</span><select className={input} value={visit.department} onChange={(e) => { setV("department", e.target.value); setV("doctor", "") }}><option value="">All</option>{(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className="block md:col-span-2"><span className={label}>Doctor *</span><select className={input} value={visit.doctor} onChange={(e) => setV("doctor", e.target.value)}><option value="">—</option>{doctorOptions.map((d) => <option key={d.id} value={d.id}>Dr. {d.name}{d.speciality ? ` · ${d.speciality}` : ""}</option>)}</select>{err("doctor")}</label>
          <label className="block "><span className={label}>Visit type</span><select className={input} value={visit.visit_type} onChange={(e) => setV("visit_type", e.target.value)}><option value="">Auto{preview.data ? `: ${preview.data.visit_type_label}` : ""}</option><option value="new">New</option><option value="follow_up">Follow-up (paid)</option><option value="free_follow_up">Follow-up (free)</option></select></label>
          <label className="block "><span className={label}>Case</span><select className={input} value={visit.case_type} onChange={(e) => setV("case_type", e.target.value)}><option value="new_complaint">New complaint</option><option value="old_complaint">Same complaint</option></select></label>
        </div>
        {preview.data && <div className="text-[12px] text-ink-4 mt-1.5">{preview.data.reason}</div>}

        <div className="flex flex-wrap gap-1.5 mt-3" role="radiogroup" aria-label="Who pays">
          {PAYERS.map(([value, text]) => (
            <button key={value} type="button" role="radio" aria-checked={visit.payer_type === value} onClick={() => setV("payer_type", value)}
              className={`h-8 px-3 rounded-control border text-[12.5px] font-semibold ${visit.payer_type === value ? "border-accent bg-accent-tint text-accent" : "border-border-strong text-ink-3"}`}>
              {text}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 mt-2.5">
          {visit.payer_type === "corporate" && <label className="block md:col-span-2"><span className={label}>Corporate</span><select className={input} value={visit.corporate_client} onChange={(e) => setV("corporate_client", e.target.value)}><option value="">—</option>{(corporates.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          {visit.payer_type === "tpa" && <label className="block md:col-span-2"><span className={label}>TPA</span><select className={input} value={visit.tpa} onChange={(e) => setV("tpa", e.target.value)}><option value="">—</option>{(tpas.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          {visit.payer_type === "scheme" && <label className="block md:col-span-2"><span className={label}>Scheme</span><select className={input} value={visit.scheme} onChange={(e) => setV("scheme", e.target.value)}><option value="">—</option>{(schemes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          {visit.payer_type === "insurance" && (
            <label className="block md:col-span-2"><span className={label}>Insurance policy</span>
              <select className={input} value={visit.insurance_policy} onChange={(e) => setV("insurance_policy", e.target.value)}>
                <option value="">{existing ? ((policies.data ?? []).length ? "—" : "No policy on file (add under Accounts)") : "Register first, then add the policy"}</option>
                {(policies.data ?? []).map((pol) => <option key={pol.id} value={pol.id}>{pol.insurer} · {pol.policy_number}{pol.eligibility_status ? ` · ${pol.eligibility_status}` : ""}</option>)}
              </select>
            </label>
          )}
          <label className="block md:col-span-2"><span className={label}>{visit.payer_type === "health_camp" ? "Camp" : "Came from a camp? (optional)"}</span><select className={input} value={visit.campaign} onChange={(e) => setV("campaign", e.target.value)}><option value="">—</option>{(camps.data ?? []).filter((c) => c.status !== "completed" || String(c.id) === String(visit.campaign)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="block "><span className={label}>Rate category</span><select className={input} value={visit.rate_category} onChange={(e) => setV("rate_category", e.target.value)}><option value="">Default</option>{RATE_CATEGORIES.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
          <label className="block md:col-span-2"><span className={label}>Referred by</span><select className={input} value={visit.referred_by} onChange={(e) => setV("referred_by", e.target.value)}><option value="">Self / walk-in</option>{(referrers.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label className="block md:col-span-2"><span className={label}>Referral note</span><input className={input} value={visit.referral_note} onChange={(e) => setV("referral_note", e.target.value)} /></label>
          <label className="block md:col-span-2"><span className={label}>Marketing person (referral payouts only)</span>
            <select className={input} value={visit.marketing_person} onChange={(e) => setV("marketing_person", e.target.value)}>
              <option value="">—</option>
              {(staff.data ?? []).map((u) => <option key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}</option>)}
            </select>
          </label>
        </div>
      </Card>}

      {/* Billing */}
      {(!registerOnly || gross > 0) && <Card padded>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-[13px] font-semibold">Billing</div>
          {existing && advance.data && Number(advance.data.balance) > 0 && <Pill tone="info">Advance balance {money(advance.data.balance)}</Pill>}
        </div>
        {(pkgList.data ?? []).length > 0 && (
          <div className="mb-2.5"><label className={label}>Packages</label>
            <div className="flex flex-wrap gap-x-4 gap-y-1">{(pkgList.data ?? []).map((pk) => (
              <label key={pk.id} className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={packages.includes(pk.id)} onChange={(e) => setPackages((cur) => (e.target.checked ? [...cur, pk.id] : cur.filter((x) => x !== pk.id)))} /> {pk.name} ({money(pk.price)})</label>
            ))}</div>
          </div>
        )}
        <table className="w-full text-[13px] mb-2">
          <tbody>
            {(preview.data?.charges ?? []).map((c, i) => (
              <tr key={i} className="border-b border-border-faint"><td className="py-1.5">{c.description}</td><td className="py-1.5 text-right font-mono">{money(c.amount)}</td></tr>
            ))}
            {!visit.doctor && <tr><td className="py-1.5 text-ink-4">Choose a doctor to see the charges.</td></tr>}
          </tbody>
        </table>
        {(preview.data?.warnings ?? []).map((w) => <div key={w} className="text-[12px] text-warning-text">⚠ {w}</div>)}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 mt-2">
          <div><label className={label}>Discount</label><div className="flex gap-1"><select aria-label="Discount type" className={`${input} w-16`} value={discount.mode} onChange={(e) => setDiscount({ ...discount, mode: e.target.value })}><option value="percent">%</option><option value="amount">₹</option></select><input aria-label="Discount" className={input} inputMode="decimal" value={discount.value} onChange={(e) => setDiscount({ ...discount, value: e.target.value.replace(/[^\d.]/g, "") })} /></div></div>
          {discountAmount > 0 && <label className="block md:col-span-2"><span className={label}>Reason *</span><input className={input} value={discount.reason} onChange={(e) => setDiscount({ ...discount, reason: e.target.value })} />{err("discount_reason")}</label>}
          {needsApprover && (
            <>
              <label className="block "><span className={label}>Approver (over {limit}%)</span><select className={input} value={discount.approver} onChange={(e) => setDiscount({ ...discount, approver: e.target.value })}><option value="">Send for approval</option>{(approvers.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              {discount.approver && <label className="block "><span className={label}>Approver's password</span><input type="password" className={input} value={discount.password} onChange={(e) => setDiscount({ ...discount, password: e.target.value })} /></label>}
            </>
          )}
        </div>
        {err("discount")}

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-72">
            <div className="flex gap-3 mb-2" role="radiogroup" aria-label="Settlement">
              <label className="flex items-center gap-1.5 text-[12.5px]"><input type="radio" checked={settlement === "receipt"} onChange={() => setSettlement("receipt")} /> Pay now</label>
              <label className={`flex items-center gap-1.5 text-[12.5px] ${creditAllowed ? "" : "text-ink-5"}`}><input type="radio" disabled={!creditAllowed} checked={settlement === "credit"} onChange={() => setSettlement("credit")} /> Credit{creditAllowed ? "" : " (not for this payer)"}</label>
            </div>
            {settlement === "receipt" && !sendForApproval && payments.map((pay, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <select aria-label="Payment mode" className={`${input} w-36`} value={pay.method} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>{PAY_MODES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                <input aria-label="Payment amount" className={`${input} w-28 font-mono`} inputMode="decimal" placeholder="Amount" value={pay.amount} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^\d.]/g, "") } : x)))} />
                {pay.method !== "cash" && <input className={input} placeholder={pay.method === "upi" ? "UPI ref" : "Reference"} value={pay.reference} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} />}
                {payments.length > 1 && <Button size="sm" variant="ghost" onClick={() => setPayments(payments.filter((_, j) => j !== i))}>✕</Button>}
              </div>
            ))}
            {settlement === "receipt" && !sendForApproval && <Button size="sm" variant="ghost" onClick={() => setPayments([...payments, { method: "upi", amount: Math.max(0, net - paid).toFixed(2), reference: "" }])}>+ Split payment</Button>}
            {sendForApproval && <div className="text-[12.5px] text-warning-text">⏳ The discount goes to an approver; take payment after it's approved.</div>}
            {err("payments")}{err("settlement")}
          </div>
          <div className="min-w-56 text-[13px]">
            <div className="flex justify-between"><span className="text-ink-4">Total</span><span className="font-mono">{money(gross)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between"><span className="text-ink-4">Discount ({discountPercent.toFixed(1)}%)</span><span className="font-mono">−{money(discountAmount)}</span></div>}
            {roundOff > 0.001 && <div className="flex justify-between"><span className="text-ink-4">Rounded down</span><span className="font-mono">−{money(roundOff)}</span></div>}
            <div className="flex justify-between text-[16px] font-bold border-t border-border mt-1 pt-1"><span>Net</span><span className="font-mono">{money(net)}</span></div>
            {settlement === "receipt" && !sendForApproval && Math.abs(paid - net) > 0.009 && <div className="text-[12px] text-danger-text text-right">Payments {money(paid)} ≠ net</div>}
          </div>
        </div>
      </Card>}

      {/* Save bar: positioned naturally after billing so content never goes behind it */}
      <div className="mt-3 bg-surface border border-border rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="text-[12.5px] text-danger-text min-h-[1em]">{error}</div>
        <div className="flex flex-wrap justify-end gap-2.5">
          {error.startsWith("This person is already registered") && <Button variant="secondary" disabled={saving} onClick={() => save(true)}>Save as a different person</Button>}
          <Button variant="secondary" onClick={reset}>Clear (Ctrl+N)</Button>
          <Button variant="action" disabled={saving || (!registerOnly && !visit.doctor) || (registerOnly && !!existing) || (!existing && (!patient.first_name || !patient.mobile))} onClick={() => save()}>
            {saving ? "Saving…" : registerOnly ? (gross > 0 ? `Register & collect ${money(net)} (Ctrl+S)` : "Register patient (Ctrl+S)") : sendForApproval ? "Register & send discount for approval" : settlement === "credit" ? "Register & bill on credit (Ctrl+S)" : `Register & collect ${money(net)} (Ctrl+S)`}
          </Button>
        </div>
      </div>
    </div>
  )
}
