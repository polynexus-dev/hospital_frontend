import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { login, verifyMfa, fetchMe, isMfaChallenge } from "../../api/auth"
import { useAuthStore } from "../../store/auth"
import { ApiError, getSubdomain } from "../../api/client"
import { Button } from "../../components/ui/Button"

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)

  const subdomain = getSubdomain()
  const isSaasPortal = subdomain === "app"
  const tenantTitle = isSaasPortal
    ? "SaaS Admin Console"
    : subdomain
    ? `${subdomain.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`
    : t("login.title")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const completeLogin = async () => {
    const me = await fetchMe()
    setUser(me)
    if ((me.is_saas_admin || me.is_superuser) && !me.hospital) {
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
      if (isMfaChallenge(result)) {
        setMfaToken(result.mfa_token)
      } else {
        setTokens(result.access, result.refresh)
        await completeLogin()
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="w-[360px] bg-surface border border-border rounded-card p-7">
        <div className="w-8 h-8 rounded-[6px] bg-brand text-white flex items-center justify-center font-bold text-sm mb-4">
          {isSaasPortal ? "⚡" : "🏥"}
        </div>

        {mfaToken === null ? (
          <>
            <div className="text-[19px] font-semibold mb-1">{tenantTitle}</div>
            <div className="text-[13px] text-ink-4 mb-6">
              {isSaasPortal
                ? "Platform operator & tenant management access"
                : subdomain
                ? "Hospital staff & provider portal"
                : t("login.subtitle")}
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
              {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
              <Button type="submit" variant="primary" disabled={loading} className="mt-2 w-full">
                {loading ? t("common.loading") : t("login.submit")}
              </Button>
            </form>
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
    </div>
  )
}
