import { useState } from "react"
import { useTranslation } from "react-i18next"
import QRCode from "qrcode"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useAuthStore } from "../../store/auth"
import { ApiError } from "../../api/client"
import { disable2FA, enable2FA, fetchMe, setup2FA } from "../../api/auth"

type Mode = "idle" | "setup" | "disable"

// TOTP enrollment (apps.accounts.views.UserViewSet.setup_2fa/enable_2fa/
// disable_2fa). The QR code is rendered entirely client-side from the
// provisioning_uri the backend returns — it embeds the freshly generated
// secret, so it must never be sent to a third-party QR-rendering service.
export function TwoFactorAuthCard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [mode, setMode] = useState<Mode>("idle")
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  if (!user) return null

  const reset = () => {
    setMode("idle")
    setQrDataUrl(null)
    setSecret("")
    setOtp("")
    setPassword("")
    setError("")
  }

  const refreshUser = async () => {
    const me = await fetchMe()
    setUser(me)
  }

  const handleStartSetup = async () => {
    setError("")
    setSuccess("")
    setLoading(true)
    try {
      const { secret, provisioning_uri } = await setup2FA()
      setSecret(secret)
      setQrDataUrl(await QRCode.toDataURL(provisioning_uri))
      setMode("setup")
    } catch {
      setError(t("common.error"))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await enable2FA(otp)
      await refreshUser()
      setSuccess(t("twoFactor.enabledSuccess"))
      reset()
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t("twoFactor.invalidOtp") : t("common.error"))
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await disable2FA(password)
      await refreshUser()
      setSuccess(t("twoFactor.disabledSuccess"))
      reset()
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t("twoFactor.incorrectPassword") : t("common.error"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card padded>
      <Eyebrow>{t("twoFactor.title")}</Eyebrow>

      {mode === "idle" && (
        <div className="flex flex-col gap-3">
          {user.requires_mfa && !user.is_2fa_enabled && (
            <div className="text-[12.5px] text-danger-text bg-danger-bg border border-danger-border rounded-control px-3 py-2">
              {t("twoFactor.setupRequiredBanner")}
            </div>
          )}
          {success && <div className="text-[12.5px] text-success-text">{success}</div>}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink-4">
              {user.is_2fa_enabled ? t("twoFactor.enabledStatus") : t("twoFactor.disabledStatus")}
            </span>
            {user.is_2fa_enabled ? (
              <Button variant="danger" size="sm" onClick={() => setMode("disable")}>
                {t("twoFactor.disableButton")}
              </Button>
            ) : (
              <Button variant="primary" size="sm" disabled={loading} onClick={handleStartSetup}>
                {t("twoFactor.setUpButton")}
              </Button>
            )}
          </div>
        </div>
      )}

      {mode === "setup" && (
        <form onSubmit={handleConfirmSetup} className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-4">{t("twoFactor.setupIntro")}</p>
          {qrDataUrl && <img src={qrDataUrl} alt="TOTP QR code" width={180} height={180} className="self-center" />}
          <div className="text-[12px] text-ink-4 text-center">
            {t("twoFactor.manualEntry")} <code className="font-mono">{secret}</code>
          </div>
          <div>
            <label htmlFor="totp-setup-otp" className="text-[12px] font-semibold text-ink-3 block mb-1.5">{t("twoFactor.otpLabel")}</label>
            <input
              id="totp-setup-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] tracking-[0.3em] outline-none focus:border-brand"
            />
          </div>
          {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={loading || otp.length !== 6} className="flex-1">
              {loading ? t("common.loading") : t("twoFactor.confirmButton")}
            </Button>
            <Button type="button" variant="secondary" onClick={reset}>
              {t("twoFactor.cancelButton")}
            </Button>
          </div>
        </form>
      )}

      {mode === "disable" && (
        <form onSubmit={handleDisable} className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-4">{t("twoFactor.disableIntro")}</p>
          <div>
            <label htmlFor="totp-disable-password" className="text-[12px] font-semibold text-ink-3 block mb-1.5">{t("twoFactor.passwordLabel")}</label>
            <input
              id="totp-disable-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] outline-none focus:border-brand"
            />
          </div>
          {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={loading} className="flex-1">
              {loading ? t("common.loading") : t("twoFactor.confirmDisableButton")}
            </Button>
            <Button type="button" variant="secondary" onClick={reset}>
              {t("twoFactor.cancelButton")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
