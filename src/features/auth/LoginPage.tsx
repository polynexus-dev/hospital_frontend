import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { login, verifyMfa, fetchMe, isMfaChallenge } from "../../api/auth"
import { useAuthStore } from "../../store/auth"
import { api, ApiError, extractApiError, getSubdomain } from "../../api/client"
import { getPublicTenantBranding } from "../../api/saas"
import type { PublicTenantBranding } from "../../types/api"
import { Button } from "../../components/ui/Button"

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)

  const subdomain = getSubdomain()
  const isSaasPortal = subdomain === "app" || subdomain === "admin"
  const [tenantBranding, setTenantBranding] = useState<PublicTenantBranding | null>(null)

  useEffect(() => {
    if (subdomain && !isSaasPortal) {
      getPublicTenantBranding(subdomain)
        .then((res) => setTenantBranding(res))
        .catch(() => setTenantBranding(null))
    }
  }, [subdomain, isSaasPortal])

  const tenantTitle = isSaasPortal
    ? "SaaS Admin Console"
    : tenantBranding?.name
    ? tenantBranding.name
    : subdomain
    ? `${subdomain.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`
    : t("login.title")


  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  // NABH DOM.4.a — an expired password must be changed before signing in.
  const [expired, setExpired] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [notice, setNotice] = useState("")
  // NABH AAC.7.b — accreditations shown on the login page.
  const [accreditations, setAccreditations] = useState<{ id: number; name: string; issuing_body: string; certificate_number: string; valid_until: string | null; logo: string | null }[]>([])

  useEffect(() => {
    if (!subdomain || isSaasPortal) return
    api
      .get<any>(`/governance/public/accreditations/?subdomain=${encodeURIComponent(subdomain)}`, { skipAuth: true })
      .then((rows) => setAccreditations(Array.isArray(rows) ? rows : []))
      .catch(() => setAccreditations([]))
  }, [subdomain, isSaasPortal])

  const completeLogin = async () => {
    const me = await fetchMe()
    setUser(me)
    if (me.is_saas_admin || (!me.hospital && me.is_superuser)) {
      navigate("/saas")
    } else {
      navigate("/dashboard")
    }
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
      if (isMfaChallenge(result)) {
        setMfaToken(result.mfa_token)
      } else {
        setTokens(result.access, result.refresh)
        await completeLogin()
      }
    } catch (err) {
      const code = err instanceof ApiError ? (err.body as { code?: string } | null)?.code : undefined
      if (code === "account_locked" || code === "account_blocked") {
        setError(extractApiError(err))
      } else if (err instanceof ApiError && err.status === 401) {
        setError(t("login.invalid"))
      } else {
        setError(t("common.error"))
      }
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
      if (err instanceof ApiError && (err.status === 400 || err.status === 401)) {
        setError(t("login.otpInvalid"))
      } else {
        setError(t("common.error"))
      }
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-page gap-5 p-4">
      <div className="w-[360px] max-w-full bg-surface border border-border rounded-card p-7">
        <div className="w-8 h-8 rounded-[6px] bg-brand text-white flex items-center justify-center font-bold text-sm mb-4">
          {isSaasPortal ? "⚡" : "🏥"}
        </div>

        {expired ? (
          <>
            <div className="text-[19px] font-semibold mb-1">Change your password</div>
            <div className="text-[13px] text-ink-4 mb-6">{notice}</div>
            <form onSubmit={handleExpiredChange} className="flex flex-col gap-3">
              <label className="text-[12px] font-semibold text-ink-3">
                New password
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5 w-full h-9 px-3 border border-border-strong rounded-control text-[13px] outline-none focus:border-brand" />
              </label>
              <div className="text-[11.5px] text-ink-4">Must meet your hospital's password policy and differ from recent passwords.</div>
              {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
              <Button type="submit" variant="primary" disabled={loading} className="mt-2 w-full">{loading ? t("common.loading") : "Change password"}</Button>
            </form>
          </>
        ) : mfaToken === null ? (
          <>
            <div className="text-[19px] font-semibold mb-1">{tenantTitle}</div>
            <div className="text-[13px] text-ink-4 mb-6">
              {isSaasPortal ? (
                "Platform operator & tenant management access"
              ) : tenantBranding?.is_tenant ? (
                <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-medium">
                  <span>📍</span>
                  <span>{[tenantBranding.city, tenantBranding.state].filter(Boolean).join(", ") || "Hospital Staff Portal"}</span>
                </span>
              ) : subdomain ? (
                "Hospital staff & provider portal"
              ) : (
                t("login.subtitle")
              )}
            </div>


            <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="login-email" className="text-[12px] font-semibold text-ink-3 block mb-1.5">{t("login.email")}</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] outline-none focus:border-brand"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="text-[12px] font-semibold text-ink-3 block mb-1.5">{t("login.password")}</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] outline-none focus:border-brand"
                />
              </div>
              {notice && !error && <div className="text-[12.5px] text-teal-700">{notice}</div>}
              {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
              <Button type="submit" variant="primary" disabled={loading} className="mt-2 w-full">
                {loading ? t("common.loading") : t("login.submit")}
              </Button>
            </form>
            {!isSaasPortal && (
              <a href="/portal" className="block text-center text-[12.5px] text-ink-4 hover:text-brand mt-4">Patient? Sign in to the patient portal →</a>
            )}
          </>
        ) : (
          <>
            <div className="text-[19px] font-semibold mb-1">{t("login.otpTitle")}</div>
            <div className="text-[13px] text-ink-4 mb-6">{t("login.otpSubtitle")}</div>

            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="login-otp" className="text-[12px] font-semibold text-ink-3 block mb-1.5">{t("login.otpLabel")}</label>
                <input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] tracking-[0.3em] outline-none focus:border-brand"
                />
              </div>
              {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
              <Button type="submit" variant="primary" disabled={loading || otp.length !== 6} className="mt-2 w-full">
                {loading ? t("common.loading") : t("login.otpSubmit")}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMfaToken(null)
                  setOtp("")
                  setError("")
                }}
                className="text-[12.5px] text-ink-4 hover:text-ink-3 text-center"
              >
                {t("login.back")}
              </button>
            </form>
          </>
        )}
      </div>
      {accreditations.length > 0 && (
        <div className="w-[360px] max-w-full">
          <div className="text-[11px] uppercase tracking-wide text-ink-4 font-semibold mb-2 text-center">Accreditations</div>
          <div className="flex flex-col gap-2">
            {accreditations.map((a) => (
              <div key={a.id} className="flex items-center gap-3 bg-surface border border-border rounded-card px-3 py-2">
                {a.logo ? <img src={a.logo} alt={a.issuing_body} className="w-9 h-9 object-contain" /> : <div className="w-9 h-9 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">{a.issuing_body.slice(0, 4)}</div>}
                <div className="text-[12px]">
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-ink-4">{a.issuing_body}{a.certificate_number ? ` · ${a.certificate_number}` : ""}{a.valid_until ? ` · valid till ${a.valid_until}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
