import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import QRCode from "qrcode"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { useAuthStore } from "../../store/auth"
import { ApiError } from "../../api/client"
import { disable2FA, enable2FA, fetchMe, list2FADevices, remove2FADevice, setup2FA } from "../../api/auth"
import type { AuthenticatorDevice } from "../../api/auth"

type Mode = "idle" | "name" | "setup" | "disable" | "remove"

const inputClass = "w-full h-9 px-3 border border-border-strong rounded-control text-[13px] outline-none focus:border-brand"
const codeClass = `${inputClass} tracking-[0.3em]`
const labelClass = "text-[12px] font-semibold text-ink-3 block mb-1.5"

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

// TOTP enrollment (apps.accounts.views.UserViewSet 2fa/*). An account can
// have several authenticator apps (phone, backup phone, tablet); a code from
// any of them works. Adding another needs a code from one already
// registered. The QR code is rendered entirely client-side from the
// provisioning_uri the backend returns — it embeds the freshly generated
// secret, so it must never be sent to a third-party QR-rendering service.
export function TwoFactorAuthCard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [mode, setMode] = useState<Mode>("idle")
  const [devices, setDevices] = useState<AuthenticatorDevice[]>([])
  const [target, setTarget] = useState<AuthenticatorDevice | null>(null)
  const [deviceName, setDeviceName] = useState("")
  const [existingCode, setExistingCode] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [secret, setSecret] = useState("")
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const enabled = !!user?.is_2fa_enabled

  const loadDevices = useCallback(async () => {
    try {
      setDevices(await list2FADevices())
    } catch {
      setDevices([])
    }
  }, [])

  useEffect(() => {
    if (enabled) void loadDevices()
    else setDevices([])
  }, [enabled, loadDevices])

  if (!user) return null

  const reset = () => {
    setMode("idle")
    setTarget(null)
    setDeviceName("")
    setExistingCode("")
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

  const startAdding = () => {
    setError("")
    setSuccess("")
    setDeviceName(enabled ? "" : t("twoFactor.defaultDeviceName"))
    setMode("name")
  }

  const handleStartSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { secret, provisioning_uri } = await setup2FA(deviceName.trim(), enabled ? existingCode : "")
      setSecret(secret)
      setQrDataUrl(await QRCode.toDataURL(provisioning_uri))
      setMode("setup")
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t("twoFactor.invalidOtp") : t("common.error"))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const wasEnabled = enabled
      await enable2FA(otp)
      await refreshUser()
      await loadDevices()
      setSuccess(wasEnabled ? t("twoFactor.deviceAdded") : t("twoFactor.enabledSuccess"))
      reset()
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t("twoFactor.invalidOtp") : t("common.error"))
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target) return
    setError("")
    setLoading(true)
    try {
      const { is_2fa_enabled } = await remove2FADevice(target.id, password)
      await refreshUser()
      await loadDevices()
      setSuccess(is_2fa_enabled ? t("twoFactor.deviceRemoved") : t("twoFactor.disabledSuccess"))
      reset()
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t("twoFactor.incorrectPassword") : t("common.error"))
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

  const cancelButton = (
    <Button type="button" variant="secondary" onClick={reset}>
      {t("twoFactor.cancelButton")}
    </Button>
  )

  return (
    <Card padded>
      <Eyebrow>{t("twoFactor.title")}</Eyebrow>

      {mode === "idle" && (
        <div className="flex flex-col gap-3">
          {user.requires_mfa && !enabled && (
            <div className="text-[12.5px] text-danger-text bg-danger-bg border border-danger-border rounded-control px-3 py-2">
              {t("twoFactor.setupRequiredBanner")}
            </div>
          )}
          {success && <div className="text-[12.5px] text-success-text">{success}</div>}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-ink-4">
              {enabled ? t("twoFactor.enabledStatus") : t("twoFactor.disabledStatus")}
            </span>
            {enabled ? (
              <Button variant="danger" size="sm" onClick={() => setMode("disable")}>
                {t("twoFactor.disableButton")}
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={startAdding}>
                {t("twoFactor.setUpButton")}
              </Button>
            )}
          </div>

          {enabled && (
            <div>
              <div className="text-[12px] font-semibold text-ink-3 mb-1.5">{t("twoFactor.devicesHeading")}</div>
              <ul className="divide-y divide-border-faint border border-border-faint rounded-control">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{d.name}</div>
                      <div className="text-[11.5px] text-ink-4">
                        {t("twoFactor.added", { date: shortDate(d.created_at) })}
                        {d.last_used_at && ` · ${t("twoFactor.lastUsed", { date: shortDate(d.last_used_at) })}`}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => { setSuccess(""); setTarget(d); setMode("remove") }}>
                      {t("twoFactor.removeButton")}
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 mt-2.5">
                <span className="text-[12px] text-ink-4">{t("twoFactor.addDeviceIntro")}</span>
                <Button size="sm" variant="primary" onClick={startAdding}>
                  {t("twoFactor.addDeviceButton")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "name" && (
        <form onSubmit={handleStartSetup} className="flex flex-col gap-3">
          {enabled && <p className="text-[12.5px] text-ink-4">{t("twoFactor.addDeviceIntro")}</p>}
          <div>
            <label htmlFor="totp-device-name" className={labelClass}>{t("twoFactor.deviceNameLabel")}</label>
            <input id="totp-device-name" required maxLength={60} value={deviceName} onChange={(e) => setDeviceName(e.target.value)} className={inputClass} />
          </div>
          {enabled && (
            <div>
              <label htmlFor="totp-existing-otp" className={labelClass}>{t("twoFactor.existingCodeLabel")}</label>
              <input
                id="totp-existing-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={existingCode}
                onChange={(e) => setExistingCode(e.target.value.replace(/\D/g, ""))}
                className={codeClass}
              />
            </div>
          )}
          {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={loading || !deviceName.trim() || (enabled && existingCode.length !== 6)} className="flex-1">
              {loading ? t("common.loading") : t("twoFactor.continueButton")}
            </Button>
            {cancelButton}
          </div>
        </form>
      )}

      {mode === "setup" && (
        <form onSubmit={handleConfirmSetup} className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-4">{t("twoFactor.setupIntro")}</p>
          {qrDataUrl && <img src={qrDataUrl} alt="TOTP QR code" width={180} height={180} className="self-center" />}
          <div className="text-[12px] text-ink-4 text-center">
            {t("twoFactor.manualEntry")} <code className="font-mono">{secret}</code>
          </div>
          <div>
            <label htmlFor="totp-setup-otp" className={labelClass}>{t("twoFactor.otpLabel")}</label>
            <input
              id="totp-setup-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className={codeClass}
            />
          </div>
          {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={loading || otp.length !== 6} className="flex-1">
              {loading ? t("common.loading") : t("twoFactor.confirmButton")}
            </Button>
            {cancelButton}
          </div>
        </form>
      )}

      {mode === "remove" && target && (
        <form onSubmit={handleRemove} className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-4">{t("twoFactor.removeIntro", { name: target.name })}</p>
          {devices.length === 1 && <p className="text-[12.5px] text-danger-text">{t("twoFactor.lastDeviceWarning")}</p>}
          <div>
            <label htmlFor="totp-remove-password" className={labelClass}>{t("twoFactor.passwordLabel")}</label>
            <input id="totp-remove-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={loading} className="flex-1">
              {loading ? t("common.loading") : t("twoFactor.confirmRemoveButton")}
            </Button>
            {cancelButton}
          </div>
        </form>
      )}

      {mode === "disable" && (
        <form onSubmit={handleDisable} className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-4">{t("twoFactor.disableIntro")}</p>
          <div>
            <label htmlFor="totp-disable-password" className={labelClass}>{t("twoFactor.passwordLabel")}</label>
            <input id="totp-disable-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={loading} className="flex-1">
              {loading ? t("common.loading") : t("twoFactor.confirmDisableButton")}
            </Button>
            {cancelButton}
          </div>
        </form>
      )}
    </Card>
  )
}
