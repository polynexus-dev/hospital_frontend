import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { login, verifyMfa, fetchMe, isMfaChallenge } from "../../api/auth"
import { rememberSessionChoice, useAuthStore } from "../../store/auth"
import { api, API_BASE_URL, ApiError, extractApiError, getSubdomain } from "../../api/client"
import { getPublicTenantBranding } from "../../api/saas"
import type { PublicTenantBranding } from "../../types/api"
import { DoctorIllustration } from "./DoctorIllustration"

type Tab = "patient" | "staff"
interface SSOButton { id: number; name: string; kind: "microsoft" | "google" | "oidc" }
interface Accreditation { id: number; name: string; issuing_body: string; certificate_number: string; valid_until: string | null; logo: string | null }

const TAB_KEY = "hms_login_tab"
const SSO_ERRORS: Record<string, string> = {
  no_account: "There's no staff account for that work email. Ask your administrator to add you.",
  domain_not_allowed: "That account isn't from this hospital's domain.",
  wrong_tenant: "That account belongs to a different organisation.",
  account_blocked: "This account has been blocked by an administrator.",
  account_inactive: "This account is not active.",
  identity_mismatch: "This staff account is linked to a different sign-in. Ask your administrator to reset the link.",
  email_unverified: "Your Google account's email isn't verified.",
  ip_blocked: "Sign-in isn't permitted from this network for your account.",
  expired: "The sign-in took too long — please try again.",
}

const inputCls =
  "w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
const labelCls = "block text-[11.5px] font-semibold tracking-[.06em] uppercase text-slate-600 mb-2"
const primaryBtn =
  "w-full h-12 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-[15px] font-semibold shadow-md shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-60"

const Icon = {
  at: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" /></svg>,
  lock: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  phone: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>,
  building: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 21V5l8-3 8 3v16" /><path d="M9 21v-4h6v4M9 9h1M14 9h1M9 13h1M14 13h1" /></svg>,
  eye: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  user: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  briefcase: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></svg>,
  arrow: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  shield: <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  check: <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l5 5 9-10" /></svg>,
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  )
}

function Field({ id, label, icon, right, children }: { id: string; label: string; icon: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <label htmlFor={id} className={labelCls}>{label}</label>
        {right}
      </div>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        {children}
      </div>
    </div>
  )
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)

  const subdomain = getSubdomain()
  const isSaasPortal = subdomain === "app" || subdomain === "admin"
  const [branding, setBranding] = useState<PublicTenantBranding | null>(null)
  const [accreditations, setAccreditations] = useState<Accreditation[]>([])
  const [ssoButtons, setSsoButtons] = useState<SSOButton[]>([])
  const [passwordAllowed, setPasswordAllowed] = useState(true)
  const [showAdminPassword, setShowAdminPassword] = useState(false)

  const [tab, setTab] = useState<Tab>(() => {
    try {
      return (localStorage.getItem(TAB_KEY) as Tab) === "patient" && !isSaasPortal ? "patient" : "staff"
    } catch {
      return "staff"
    }
  })
  const chooseTab = (next: Tab) => {
    setTab(next)
    setError("")
    setNotice("")
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch {
      // storage unavailable — tab just won't be remembered
    }
  }

  // Staff sign-in state.
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(true)
  const [otp, setOtp] = useState("")
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [nextPath, setNextPath] = useState("")
  const [expired, setExpired] = useState(false) // NABH DOM.4.a
  const [newPassword, setNewPassword] = useState("")
  const [forgot, setForgot] = useState(false)
  // Patient portal state.
  const [hospitalCode, setHospitalCode] = useState(subdomain && !isSaasPortal ? subdomain : "")
  const [mobile, setMobile] = useState("")
  const [portalOtp, setPortalOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)

  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!subdomain || isSaasPortal) return
    getPublicTenantBranding(subdomain).then(setBranding).catch(() => setBranding(null))
    api // NABH AAC.7.b — accreditations shown on the login page.
      .get<any>(`/governance/public/accreditations/?subdomain=${encodeURIComponent(subdomain)}`, { skipAuth: true })
      .then((rows) => setAccreditations(Array.isArray(rows) ? rows : []))
      .catch(() => setAccreditations([]))
    api
      .get<{ providers: SSOButton[]; password_login: boolean }>(`/auth/sso/providers/?hospital=${encodeURIComponent(subdomain)}`, { skipAuth: true })
      .then((r) => { setSsoButtons(r.providers); setPasswordAllowed(r.password_login) })
      .catch(() => setSsoButtons([]))
  }, [subdomain, isSaasPortal])

  const hospitalName = isSaasPortal ? "SaaS Admin Console" : branding?.name || (subdomain ? subdomain.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : t("login.subtitle"))
  const hospitalTagline = isSaasPortal ? "Platform operations" : [branding?.city, branding?.state].filter(Boolean).join(", ") || "Health System"

  const completeLogin = async (after = nextPath) => {
    rememberSessionChoice(keepSignedIn)
    const me = await fetchMe()
    setUser(me)
    if (me.is_saas_admin || (!me.hospital && me.is_superuser)) navigate("/saas")
    else navigate(after && after.startsWith("/") ? after : "/dashboard")
  }

  // Back from the hospital's identity provider: #sso=<one-time code> or #sso_error=<code>.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const code = hash.get("sso")
    const ssoError = hash.get("sso_error")
    if (!code && !ssoError) return
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
    setTab("staff")
    if (ssoError) {
      setError(SSO_ERRORS[ssoError] ?? "Single sign-on didn't complete. Please try again or contact your administrator.")
      return
    }
    setLoading(true)
    api
      .post<any>("/auth/sso/exchange/", { code }, { skipAuth: true })
      .then(async (res) => {
        setNextPath(res.next || "")
        if (res.mfa_required) setMfaToken(res.mfa_token)
        else {
          setTokens(res.access, res.refresh)
          await completeLogin(res.next)
        }
      })
      .catch((err) => setError(extractApiError(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startSso = (b: SSOButton) => {
    const qs = new URLSearchParams({ return_to: window.location.origin, next: nextPath })
    window.location.assign(`${API_BASE_URL}/auth/sso/${b.id}/start/?${qs}`)
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const result = await login(email, password)
      if ((result as { password_expired?: boolean }).password_expired) {
        setExpired(true)
        setNotice("Your password has expired. Choose a new one to continue.")
        return
      }
      if (isMfaChallenge(result)) setMfaToken(result.mfa_token)
      else {
        setTokens(result.access, result.refresh)
        await completeLogin()
      }
    } catch (err) {
      const code = err instanceof ApiError ? (err.body as { code?: string } | null)?.code : undefined
      if (code === "account_locked" || code === "account_blocked" || code === "sso_required") setError(extractApiError(err))
      else if (err instanceof ApiError && err.status === 401) setError(t("login.invalid"))
      else setError(t("common.error"))
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaToken) return
    setError("")
    setLoading(true)
    try {
      const tokens = await verifyMfa(mfaToken, otp)
      setTokens(tokens.access, tokens.refresh)
      await completeLogin()
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 401)) setError(t("login.otpInvalid"))
      else setError(t("common.error"))
    } finally {
      setLoading(false)
    }
  }

  const handleExpiredChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await api.post("/auth/password/expired-change/", { email, old_password: password, new_password: newPassword }, { skipAuth: true })
      setExpired(false)
      setPassword("")
      setNewPassword("")
      setNotice("Password changed. Sign in with your new password.")
    } catch (err) {
      setError(extractApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      if (!otpSent) {
        await api.post("/portal/auth/request-otp/", { hospital: hospitalCode, mobile }, { skipAuth: true })
        setOtpSent(true)
        setNotice("If this number is registered with us, an OTP has been sent by SMS.")
      } else {
        const res = await api.post<{ token: string }>("/portal/auth/verify-otp/", { hospital: hospitalCode, mobile, otp: portalOtp }, { skipAuth: true })
        sessionStorage.setItem("patient_portal_token", res.token)
        navigate("/portal")
      }
    } catch (err) {
      setError(extractApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const showPasswordForm = passwordAllowed || showAdminPassword || isSaasPortal
  const title = expired ? "Change your password" : mfaToken ? t("login.otpTitle") : "Sign in to your account"
  const subtitle = expired ? notice : mfaToken ? t("login.otpSubtitle") : tab === "patient" ? "Use the mobile number registered with the hospital." : "Please enter your credentials to access your dashboard."

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white text-slate-800">
      <header className="flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor" aria-hidden><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg>
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-semibold text-slate-900">{hospitalName}</div>
            <div className="text-[10.5px] font-semibold tracking-[.12em] uppercase text-blue-700">{hospitalTagline}</div>
          </div>
        </div>
        {branding?.helpline_phone && (
          <a href={`tel:${branding.helpline_phone.replace(/[^\d+]/g, "")}`} className="hidden sm:flex items-center gap-2 text-[13px] font-medium text-rose-600">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> 24/7 Helpline: {branding.helpline_phone}
          </a>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-[920px] grid md:grid-cols-[1fr_1.15fr] bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-100 overflow-hidden">
          {/* Left: welcome panel */}
          <section className="hidden md:flex flex-col bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-100/60 p-8">
            <span className="self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[11.5px] font-medium text-blue-700 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> Patient &amp; Clinical Access
            </span>
            <h1 className="mt-4 text-[27px] leading-tight font-semibold text-slate-900">
              Your Health &amp; Wellness,<br /><span className="text-blue-800">Always Connected.</span>
            </h1>
            <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">
              Access medical records, appointments, test results, and virtual consultations in one secure place.
            </p>
            <DoctorIllustration className="w-full max-w-[300px] mx-auto my-6" />
            <div className="mt-auto pt-5 border-t border-blue-100 flex flex-col items-center gap-2">
              {accreditations.length > 0 ? (
                accreditations.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-[12px] text-slate-600">
                    {a.logo ? <img src={a.logo} alt={a.issuing_body} className="w-6 h-6 object-contain" /> : <span className="w-5 h-5 rounded bg-white shadow-sm flex items-center justify-center text-blue-700">{Icon.check}</span>}
                    <span><b>{a.name}</b> · {a.issuing_body}{a.valid_until ? ` · valid till ${a.valid_until}` : ""}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                  <span className="w-5 h-5 rounded bg-white shadow-sm flex items-center justify-center text-blue-700">{Icon.check}</span>
                  {branding?.helpline_phone ? "24/7 Care Access" : "Secure, encrypted access"}
                </div>
              )}
            </div>
          </section>

          {/* Right: sign-in */}
          <section className="p-7 sm:p-10">
            <h2 className="text-[24px] font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-[13.5px] text-slate-500">{subtitle}</p>

            {!expired && !mfaToken && !isSaasPortal && (
              <div className="mt-6 grid grid-cols-2 p-1 rounded-xl bg-slate-100" role="tablist">
                {([["patient", "Patient Portal", Icon.user], ["staff", "Doctor & Staff", Icon.briefcase]] as const).map(([key, label, icon]) => (
                  <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => chooseTab(key)}
                    className={`h-10 rounded-lg flex items-center justify-center gap-2 text-[13.5px] font-medium transition ${tab === key ? "bg-white text-blue-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6">
              {expired ? (
                <form onSubmit={handleExpiredChange} className="flex flex-col gap-4">
                  <Field id="new-password" label="New password" icon={Icon.lock}>
                    <input id="new-password" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
                  </Field>
                  <p className="text-[12px] text-slate-500">Must meet your hospital's password policy and differ from recent passwords.</p>
                  {error && <div className="text-[13px] text-rose-700">{error}</div>}
                  <button type="submit" disabled={loading} className={primaryBtn}>{loading ? t("common.loading") : "Change password"}</button>
                </form>
              ) : mfaToken ? (
                <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
                  <Field id="login-otp" label={t("login.otpLabel")} icon={Icon.lock}>
                    <input id="login-otp" type="text" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={6} value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className={`${inputCls} tracking-[0.3em]`} />
                  </Field>
                  {error && <div className="text-[13px] text-rose-700">{error}</div>}
                  <button type="submit" disabled={loading || otp.length !== 6} className={primaryBtn}>{loading ? t("common.loading") : t("login.otpSubmit")}</button>
                  <button type="button" onClick={() => { setMfaToken(null); setOtp(""); setError("") }} className="text-[13px] text-slate-500 hover:text-slate-700">{t("login.back")}</button>
                </form>
              ) : tab === "patient" && !isSaasPortal ? (
                <form onSubmit={handlePatientSubmit} className="flex flex-col gap-4">
                  {!(subdomain && !isSaasPortal) && (
                    <Field id="hospital-code" label="Hospital code" icon={Icon.building}>
                      <input id="hospital-code" required value={hospitalCode} onChange={(e) => setHospitalCode(e.target.value.trim().toLowerCase())} placeholder="e.g. city-hospital" className={inputCls} disabled={otpSent} />
                    </Field>
                  )}
                  <Field id="patient-mobile" label="Mobile number" icon={Icon.phone}>
                    <input id="patient-mobile" required inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Registered mobile number" className={inputCls} disabled={otpSent} />
                  </Field>
                  {otpSent && (
                    <Field id="patient-otp" label="One-time password" icon={Icon.lock}
                      right={<button type="button" className="text-[12px] font-medium text-blue-700" onClick={() => { setOtpSent(false); setPortalOtp(""); setNotice("") }}>Change number</button>}>
                      <input id="patient-otp" required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={portalOtp}
                        onChange={(e) => setPortalOtp(e.target.value.replace(/\D/g, ""))} placeholder="6-digit OTP" className={`${inputCls} tracking-[0.3em]`} />
                    </Field>
                  )}
                  {notice && !error && <div className="text-[13px] text-emerald-700">{notice}</div>}
                  {error && <div className="text-[13px] text-rose-700">{error}</div>}
                  <button type="submit" disabled={loading || (otpSent && portalOtp.length !== 6)} className={primaryBtn}>
                    {loading ? t("common.loading") : otpSent ? "Verify & open portal" : "Send OTP"} {!loading && Icon.arrow}
                  </button>
                  <p className="text-center text-[12.5px] text-slate-500">
                    First time visiting {branding?.name ?? "us"}? Your number is registered at your first visit
                    {branding?.helpline_phone ? <> — or call <a className="font-medium text-blue-700" href={`tel:${branding.helpline_phone.replace(/[^\d+]/g, "")}`}>{branding.helpline_phone}</a></> : ""}.
                  </p>
                </form>
              ) : (
                <>
                  {showPasswordForm && (
                    <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-4">
                      <Field id="login-email" label="Email address" icon={Icon.at}>
                        <input id="login-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. name@domain.com" className={inputCls} />
                      </Field>
                      <Field id="login-password" label={t("login.password")} icon={Icon.lock}
                        right={<button type="button" className="text-[12px] font-medium text-blue-700" onClick={() => setForgot((v) => !v)}>Forgot password?</button>}>
                        <input id="login-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password}
                          onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className={`${inputCls} pr-10`} />
                        <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide the password" : "Show the password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{Icon.eye}</button>
                      </Field>
                      {forgot && (
                        <div className="text-[12.5px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                          Ask your hospital administrator to reset it (Admin › Users › Set password).{ssoButtons.length > 0 && " Or sign in with your work account below."}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[12.5px]">
                        <label className="flex items-center gap-2 text-slate-600">
                          <input type="checkbox" checked={keepSignedIn} onChange={(e) => setKeepSignedIn(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                          Keep me signed in
                        </label>
                        <span className="flex items-center gap-1 text-slate-400">{Icon.lock} Encrypted session</span>
                      </div>
                      {notice && !error && <div className="text-[13px] text-emerald-700">{notice}</div>}
                      {error && <div className="text-[13px] text-rose-700">{error}</div>}
                      <button type="submit" disabled={loading} className={primaryBtn}>
                        {loading ? t("common.loading") : isSaasPortal ? "Sign in to console" : "Sign in to dashboard"} {!loading && Icon.arrow}
                      </button>
                    </form>
                  )}
                  {!showPasswordForm && error && <div className="text-[13px] text-rose-700 mb-3">{error}</div>}

                  {ssoButtons.length > 0 && (
                    <>
                      {showPasswordForm && (
                        <div className="flex items-center gap-3 my-6 text-[11px] font-semibold tracking-[.1em] uppercase text-slate-400">
                          <span className="flex-1 h-px bg-slate-200" /> Or sign in with <span className="flex-1 h-px bg-slate-200" />
                        </div>
                      )}
                      <div className={`grid gap-3 ${ssoButtons.length > 1 ? "sm:grid-cols-2" : ""}`}>
                        {ssoButtons.map((b) => (
                          <button key={b.id} type="button" onClick={() => startSso(b)}
                            className="h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-2 text-[13.5px] font-medium text-slate-700">
                            {b.kind === "google" ? <GoogleLogo /> : Icon.shield}
                            {b.kind === "google" ? "Continue with Google" : b.name}
                          </button>
                        ))}
                      </div>
                      {!showPasswordForm && (
                        <button type="button" onClick={() => setShowAdminPassword(true)} className="block mx-auto mt-5 text-[12.5px] text-slate-500 hover:text-slate-700">
                          Administrator? Sign in with a password
                        </button>
                      )}
                    </>
                  )}
                  {!isSaasPortal && (
                    <p className="mt-6 text-center text-[12.5px] text-slate-500">
                      Trouble signing in? Contact your hospital's IT or administrator.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-100 px-6 sm:px-10 py-4 flex flex-col sm:flex-row gap-2 justify-between text-[12px] text-slate-500">
        <span>© {new Date().getFullYear()} {isSaasPortal ? "Polynexus" : hospitalName}. All rights reserved.</span>
        <span className="flex gap-3">
          {!isSaasPortal && <button type="button" className="hover:text-slate-700" onClick={() => chooseTab("patient")}>Patient portal</button>}
          {branding?.helpline_phone && <><span>•</span><a className="hover:text-slate-700" href={`tel:${branding.helpline_phone.replace(/[^\d+]/g, "")}`}>Patient help desk</a></>}
        </span>
      </footer>
    </div>
  )
}
