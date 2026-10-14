import { useEffect, useState } from "react"
import { API_BASE_URL, ApiError, extractApiError, getSubdomain, triggerBlobDownload } from "../../api/client"

// Patient portal (AAC.2.f, AAC.3.l, AAC.4.k, COP.1.l, AAC.7.a, AAC.8, FPM.3.f).
// Uses its own "Portal <token>" credential — never the staff JWT client.

const TOKEN_KEY = "patient_portal_token"

function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

async function portal<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken()
  const isForm = init.body instanceof FormData  // file uploads: the browser sets the multipart boundary
  const res = await fetch(`${API_BASE_URL}/portal${path}`, {
    method: init.method ?? "GET",
    headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Portal ${token}` } : {}) },
    body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
  })
  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      // no body
    }
    throw new ApiError(res.status, body, `Portal request failed (${res.status})`)
  }
  const ct = res.headers.get("content-type") ?? ""
  return (ct.includes("json") ? res.json() : res.blob()) as Promise<T>
}

function Login({ onDone }: { onDone: () => void }) {
  const [hospital, setHospital] = useState(getSubdomain() ?? "")
  const [mobile, setMobile] = useState("")
  const [otp, setOtp] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const send = async () => {
    setError(null)
    try {
      await portal("/auth/request-otp/", { method: "POST", body: { hospital, mobile } })
      setSent(true)
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  const verify = async () => {
    setError(null)
    try {
      const res = await portal<{ token: string }>("/auth/verify-otp/", { method: "POST", body: { hospital, mobile, otp } })
      sessionStorage.setItem(TOKEN_KEY, res.token)
      onDone()
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-success-bg p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-7 space-y-4">
        <h1 className="text-xl font-bold text-ink">Patient portal</h1>
        <p className="text-sm text-ink-4">Sign in with your registered mobile number. One sign-in shows everyone in your family registered on this number.</p>
        {!getSubdomain() && <input className="w-full px-3 py-2 border rounded-lg" placeholder="Hospital code" value={hospital} onChange={(e) => setHospital(e.target.value)} />}
        <input className="w-full px-3 py-2 border rounded-lg" placeholder="Mobile number" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} disabled={sent} />
        {sent && <input className="w-full px-3 py-2 border rounded-lg tracking-[0.3em]" placeholder="6-digit OTP" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />}
        {sent && <p className="text-xs text-ink-4">If this number is registered with us, an OTP has been sent by SMS.</p>}
        {error && <div className="text-sm text-danger-text">{error}</div>}
        <button onClick={sent ? verify : send} className="w-full py-2.5 rounded-xl bg-success text-white font-semibold">{sent ? "Verify & sign in" : "Send OTP"}</button>
      </div>
    </div>
  )
}

function PortalDocuments({ stages, patientId, onUploaded, onError }: { stages: any[]; patientId: number; onUploaded: (m: string) => void; onError: (e: string | null) => void }) {
  const [busy, setBusy] = useState<number | null>(null)
  if (!stages?.length) return <section className="bg-white rounded-xl border px-4 py-3 text-sm">Nothing is needed from you right now. ✅</section>
  const upload = async (requirement: number, name: string, file: File) => {
    onError(null)
    setBusy(requirement)
    const fd = new FormData()
    fd.append("patient", String(patientId))
    fd.append("requirement", String(requirement))
    fd.append("file", file)
    try {
      await portal("/documents/", { method: "POST", body: fd })
      onUploaded(`Thank you. "${name}" uploaded.`)
    } catch (e) {
      onError(extractApiError(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      {stages.map((st) => (
        <section key={st.stage} className="bg-white rounded-xl border">
          <h2 className="px-4 py-3 font-semibold border-b">Documents for {st.stage_label.toLowerCase()}</h2>
          {st.items.map((i: any) => (
            <div key={i.requirement} className="px-4 py-3 border-b last:border-0 text-sm flex flex-wrap items-center justify-between gap-2">
              <span>{i.satisfied ? "✅" : "⬜"} {i.name}{!i.required && <span className="text-ink-4"> (optional)</span>}</span>
              {!i.satisfied && (
                <label className={`px-3 py-1.5 rounded-lg text-white text-sm font-medium cursor-pointer ${busy === i.requirement ? "bg-ink-4" : "bg-success-text"}`}>
                  {busy === i.requirement ? "Uploading…" : "Upload"}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" disabled={busy !== null}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(i.requirement, i.name, f); e.target.value = "" }} />
                </label>
              )}
            </div>
          ))}
        </section>
      ))}
      <p className="text-xs text-ink-4">Photos or PDFs up to the hospital's size limit. A clear photo of the document is fine.</p>
    </>
  )
}

type Tab = "appointments" | "reports" | "prescriptions" | "discharge" | "bills" | "documents" | "video" | "feedback" | "info"

export function PatientPortal() {
  const [authed, setAuthed] = useState(!!getToken())
  const [me, setMe] = useState<any>(null)
  const [patientId, setPatientId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>("appointments")
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!authed) return
    portal<any>("/me/")
      .then((m) => {
        setMe(m)
        setPatientId(m.patients[0]?.id ?? null)
      })
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY)
        setAuthed(false)
      })
  }, [authed])

  const endpoints: Record<Tab, string> = {
    appointments: "/appointments/", reports: "/reports/", prescriptions: "/prescriptions/", discharge: "/discharge-summaries/",
    bills: "/bills/", documents: "/documents/", video: "/teleconsultations/", feedback: "/measures/", info: "/care-information/",
  }
  useEffect(() => {
    if (!patientId) return
    setData(null)
    setError(null)
    portal<any>(`${endpoints[tab]}?patient=${patientId}`).then(setData).catch((e) => setError(extractApiError(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, patientId, reload])

  if (!authed) return <Login onDone={() => setAuthed(true)} />
  if (!me) return <div className="p-8 text-ink-4">Loading…</div>

  const download = async (path: string, name: string) => triggerBlobDownload(await portal<Blob>(path), name)

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-success-text text-white px-5 py-4 flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="text-xs opacity-80">{me.hospital}</div>
          <div className="text-lg font-bold">Patient portal</div>
        </div>
        <div className="flex items-center gap-3">
          <select className="text-ink rounded-lg px-2 py-1 text-sm" value={patientId ?? ""} onChange={(e) => setPatientId(Number(e.target.value))}>
            {me.patients.map((p: any) => <option key={p.id} value={p.id}>{p.name} · {p.uhid}</option>)}
          </select>
          <button onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setAuthed(false) }} className="text-sm underline">Sign out</button>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto bg-white border-b px-3">
        {([["appointments", "Appointments"], ["reports", "Reports"], ["prescriptions", "Prescriptions"], ["discharge", "Discharge"], ["bills", "Bills"], ["documents", "Documents"], ["video", "Video consults"], ["feedback", "Feedback"], ["info", "Hospital info"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setMsg(null) }} className={`px-3 py-3 text-sm font-semibold whitespace-nowrap border-b-2 ${tab === k ? "border-success text-success-text" : "border-transparent text-ink-4"}`}>{l}</button>
        ))}
      </nav>
      <main className="max-w-4xl mx-auto p-4 space-y-3">
        {msg && <div className="text-sm bg-success-bg text-success-text rounded-lg p-3">{msg}</div>}
        {error && <div className="text-sm bg-danger-bg text-danger-text rounded-lg p-3">{error}</div>}
        {!data ? <div className="text-ink-4 text-sm">Loading…</div> : (
          <>
            {tab === "appointments" && <Appointments rows={data} patientId={patientId!} onBooked={(m) => { setMsg(m); setReload((n) => n + 1) }} />}
            {tab === "reports" && (
              <>
                <List title="Laboratory reports" rows={data.laboratory} render={(r: any) => <><b>{r.order_number}</b> · {new Date(r.date).toLocaleDateString()} · {r.tests.join(", ")} <button className="ml-2 text-success-text font-semibold" onClick={() => download(`/reports/lab/${r.id}/pdf/`, `${r.order_number}.pdf`)}>Download PDF</button></>} />
                <List title="Radiology reports" rows={data.radiology} render={(r: any) => <><b>{r.study}</b> · {new Date(r.date).toLocaleDateString()}{r.amended ? " · amended" : ""}<div className="text-ink-3">{r.impression}</div></>} />
              </>
            )}
            {tab === "prescriptions" && <List title="Prescriptions" rows={data} render={(r: any) => <><b>{new Date(r.date).toLocaleDateString()}</b> · {r.doctor} · {r.diagnosis}<div className="text-ink-3">{(r.medications ?? []).map((m: any) => m.name ?? m).join(", ")}</div><button className="text-success-text font-semibold" onClick={() => download(`/prescriptions/${r.id}/pdf/`, `prescription-${r.id}.pdf`)}>Download PDF</button></>} />}
            {tab === "discharge" && <List title="Discharge summaries" rows={data} render={(r: any) => <><b>{new Date(r.admitted_at).toLocaleDateString()} → {r.discharged_at ? new Date(r.discharged_at).toLocaleDateString() : "—"}</b><div>Diagnosis: {r.final_diagnosis}</div><div className="whitespace-pre-wrap text-ink-3">{r.discharge_medications}</div><div className="text-ink-3">Follow-up: {r.follow_up_instructions}</div></>} />}
            {tab === "bills" && (
              <>
                <div className="bg-white rounded-xl p-4 border"><div className="text-xs text-ink-4">Outstanding</div><div className="text-2xl font-bold">₹{data.outstanding}</div></div>
                <List title="Bills" rows={data.bills} render={(b: any) => (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><b>{new Date(b.date).toLocaleDateString()}</b> · ₹{b.net_amount} · paid ₹{b.paid} · balance ₹{b.balance} · {b.status}</span>
                    {b.balance > 0 && b.status !== "cancelled" && (
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-success-text text-white text-sm font-medium"
                        onClick={async () => {
                          setError(null)
                          try {
                            const res = await portal<{ pay_url: string }>(`/bills/${b.id}/pay/`, { method: "POST", body: { patient: patientId } })
                            window.location.assign(res.pay_url)
                          } catch (e) {
                            setError(extractApiError(e))
                          }
                        }}
                      >
                        Pay ₹{b.balance} online
                      </button>
                    )}
                  </div>
                )} />
                <p className="text-xs text-ink-4">UPI, cards, netbanking and wallets. The bill updates here as soon as the payment goes through.</p>
              </>
            )}
            {tab === "video" && <List title="Video consultations" rows={data} render={(c: any) => <><b>{new Date(c.scheduled_at).toLocaleString()}</b> · {c.doctor} · {c.status}{c.join_token && <a className="ml-2 text-success-text font-semibold" href={`/tele/join/${c.join_token}`}>Join</a>}</>} />}
            {tab === "feedback" && <Feedback instruments={data} patientId={patientId!} onDone={setMsg} />}
            {tab === "documents" && <PortalDocuments stages={data.stages} patientId={patientId!} onUploaded={(m) => { setMsg(m); setReload((n) => n + 1) }} onError={setError} />}
            {tab === "info" && <List title="Information for patients" rows={data} render={(i: any) => <><b>{i.title}</b><div className="whitespace-pre-wrap text-ink-3">{i.body}</div></>} />}
          </>
        )}
      </main>
    </div>
  )
}

function List({ title, rows, render }: { title: string; rows: any[]; render: (r: any) => React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border">
      <h2 className="px-4 py-3 font-semibold border-b">{title}</h2>
      {rows?.length ? rows.map((r, i) => <div key={r.id ?? i} className="px-4 py-3 border-b last:border-0 text-sm">{render(r)}</div>) : <div className="px-4 py-3 text-sm text-ink-4">Nothing here yet.</div>}
    </section>
  )
}

function Appointments({ rows, patientId, onBooked }: { rows: any[]; patientId: number; onBooked: (m: string) => void }) {
  const [payLinks, setPayLinks] = useState<Record<number, string>>({})
  const [doctors, setDoctors] = useState<any[]>([])
  const [doctor, setDoctor] = useState<string>("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [slots, setSlots] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    portal<any[]>("/doctors/").then(setDoctors).catch(() => setDoctors([]))
  }, [])
  useEffect(() => {
    if (doctor) portal<any[]>(`/doctors/${doctor}/slots/?date=${date}`).then(setSlots).catch(() => setSlots([]))
  }, [doctor, date])
  const book = async (slot: number) => {
    setError(null)
    try {
      const r = await portal<any>("/appointments/", { method: "POST", body: { slot, patient: patientId } })
      const when = `${r.doctor} on ${r.date} at ${String(r.time).slice(0, 5)}`
      if (r.payment === "required" && r.pay_url) {
        // The slot is held while they pay; Razorpay brings them back to the portal.
        onBooked(`Slot held with ${when}. Taking you to pay ₹${r.amount}…`)
        window.location.assign(r.pay_url)
        return
      }
      if (r.payment === "optional" && r.pay_url) {
        onBooked(`Booked with ${when}. You can pay ₹${r.amount} now (Your appointments → Pay) or at the hospital.`)
        setPayLinks((m) => ({ ...m, [r.id]: r.pay_url }))
        return
      }
      onBooked(`Booked with ${when}.${r.amount ? ` Fee ₹${r.amount}, payable at the hospital.` : ""}${r.note ? ` ${r.note}` : ""}`)
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <>
      <section className="bg-white rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Book an appointment</h2>
        <div className="flex flex-wrap gap-2">
          <select className="border rounded-lg px-3 py-2 text-sm" value={doctor} onChange={(e) => setDoctor(e.target.value)}>
            <option value="">Choose doctor</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}{d.speciality ? ` — ${d.speciality}` : ""}</option>)}
          </select>
          <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {doctor && (
          <div className="flex flex-wrap gap-2">
            {slots.length ? slots.map((s) => <button key={s.id} onClick={() => book(s.id)} className="px-3 py-1.5 rounded-lg bg-success-bg text-success-text text-sm font-semibold hover:bg-success-bg">{String(s.start_time).slice(0, 5)}</button>) : <span className="text-sm text-ink-4">No free slots that day.</span>}
          </div>
        )}
        {error && <div className="text-sm text-danger-text">{error}</div>}
      </section>
      <List title="Your appointments" rows={rows} render={(a: any) => (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <b>{a.date} {String(a.time).slice(0, 5)}</b> · {a.doctor} · {a.status}{a.token ? ` · token ${a.token}` : ""}
            {a.paid_online && <span className="text-success-text"> · paid</span>}
            {a.awaiting_payment_until && a.status === "booked" && (
              <span className="text-warning-text"> · held until {new Date(a.awaiting_payment_until).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}: pay to confirm</span>
            )}
          </span>
          {payLinks[a.id] && !a.paid_online && (
            <a href={payLinks[a.id]} className="px-3 py-1.5 rounded-lg bg-success-text text-white text-sm font-medium">Pay now</a>
          )}
        </div>
      )} />
    </>
  )
}

function Feedback({ instruments, patientId, onDone }: { instruments: Record<string, any>; patientId: number; onDone: (m: string) => void }) {
  const [key, setKey] = useState(Object.keys(instruments)[0])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [complaint, setComplaint] = useState("")
  const inst = instruments[key]
  const submit = async () => {
    await portal("/measures/", { method: "POST", body: { instrument: key, answers, patient: patientId } })
    setAnswers({})
    onDone("Thank you — your feedback has been recorded.")
  }
  return (
    <>
      <section className="bg-white rounded-xl border p-4 space-y-3">
        <select className="border rounded-lg px-3 py-2 text-sm" value={key} onChange={(e) => { setKey(e.target.value); setAnswers({}) }}>
          {Object.entries(instruments).map(([k, v]: [string, any]) => <option key={k} value={k}>{v.title}</option>)}
        </select>
        {inst.questions.map((q: any) => (
          <div key={q.id} className="text-sm">
            <div className="mb-1">{q.text}</div>
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: q.scale === 10 ? 11 : q.scale }, (_, i) => (q.scale === 10 ? i : i + 1)).map((n) => (
                <button key={n} onClick={() => setAnswers({ ...answers, [q.id]: n })} className={`w-9 h-9 rounded-lg text-sm font-semibold ${answers[q.id] === n ? "bg-success text-white" : "bg-chip-bg"}`}>{n}</button>
              ))}
            </div>
          </div>
        ))}
        <button disabled={Object.keys(answers).length < inst.questions.length} onClick={submit} className="px-4 py-2 rounded-lg bg-success text-white font-semibold disabled:opacity-50">Submit</button>
      </section>
      <section className="bg-white rounded-xl border p-4 space-y-2">
        <h2 className="font-semibold">Raise a complaint</h2>
        <textarea className="w-full border rounded-lg p-2 text-sm" rows={3} value={complaint} onChange={(e) => setComplaint(e.target.value)} />
        <button disabled={!complaint.trim()} onClick={async () => { await portal("/complaints/", { method: "POST", body: { description: complaint, patient: patientId } }); setComplaint(""); onDone("Complaint registered — our team will contact you.") }} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm disabled:opacity-50">Submit complaint</button>
      </section>
    </>
  )
}
