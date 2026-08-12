import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { login, fetchMe } from "../../api/auth"
import { useAuthStore } from "../../store/auth"
import { ApiError } from "../../api/client"
import { Button } from "../../components/ui/Button"

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)
  const setUser = useAuthStore((s) => s.setUser)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const tokens = await login(email, password)
      setTokens(tokens.access, tokens.refresh)
      const me = await fetchMe()
      setUser(me)
      navigate("/dashboard")
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="w-[360px] bg-surface border border-border rounded-card p-7">
        <div className="w-8 h-8 rounded-[6px] bg-brand text-white flex items-center justify-center font-bold text-sm mb-4">
          H
        </div>
        <div className="text-[19px] font-semibold mb-1">{t("login.title")}</div>
        <div className="text-[13px] text-ink-4 mb-6">{t("login.subtitle")}</div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] font-semibold text-ink-3 block mb-1.5">{t("login.email")}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-ink-3 block mb-1.5">{t("login.password")}</label>
            <input
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
      </div>
    </div>
  )
}
