import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { api, extractApiError } from "../api/client"
import { useAuthStore } from "../store/auth"

const LOCK_KEY = "hms_screen_locked"
const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const

/**
 * NABH DOM.4.b auto screen lock. Idle time and on/off come from the
 * hospital's security policy; the lock survives a page reload (session
 * storage) and only lifts after the user re-enters their password —
 * moving the mouse or pressing keys does not unlock it.
 */
export function IdleLock() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [policy, setPolicy] = useState<{ idle_lock_enabled: boolean; idle_lock_minutes: number } | null>(null)
  const [locked, setLocked] = useState(() => {
    try {
      return sessionStorage.getItem(LOCK_KEY) === "1"
    } catch {
      return false
    }
  })
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const last = useRef(Date.now())

  useEffect(() => {
    if (!user) return
    api.get<{ idle_lock_enabled: boolean; idle_lock_minutes: number }>("/governance/security-policy/").then(setPolicy).catch(() => setPolicy(null))
  }, [user])

  useEffect(() => {
    if (!policy?.idle_lock_enabled || locked) return
    const bump = () => {
      last.current = Date.now()
    }
    EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const timer = window.setInterval(() => {
      if (Date.now() - last.current > policy.idle_lock_minutes * 60_000) {
        setLocked(true)
        try {
          sessionStorage.setItem(LOCK_KEY, "1")
        } catch {
          // best effort
        }
      }
    }, 5_000)
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, bump))
      window.clearInterval(timer)
    }
  }, [policy, locked])

  if (!locked || !user) return null

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await api.post("/users/verify-password/", { password })
      setLocked(false)
      setPassword("")
      last.current = Date.now()
      try {
        sessionStorage.removeItem(LOCK_KEY)
      } catch {
        // best effort
      }
    } catch (err) {
      setError(extractApiError(err, "Incorrect password."))
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur flex items-center justify-center p-4">
      <form onSubmit={unlock} className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-7 space-y-4 shadow-2xl">
        <div className="text-3xl">🔒</div>
        <div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Screen locked</div>
          <div className="text-sm text-slate-500">Locked after {policy?.idle_lock_minutes ?? "—"} minutes of inactivity. Enter your password to continue as {user.email}.</div>
        </div>
        <input type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Password" />
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="flex gap-2">
          <button className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold">Unlock</button>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(LOCK_KEY)
              } catch {
                // best effort
              }
              logout()
            }}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </form>
    </div>
  )
}

/** Open clinical alerts for me / my departments — critical count pulses. */
export function AlertBell() {
  const user = useAuthStore((s) => s.user)
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!user?.permissions?.includes("patients.access_clinical_detail")) return
    const load = () => api.get<Record<string, number>>("/clinical/alerts/counts/").then(setCounts).catch(() => setCounts({}))
    load()
    const t = window.setInterval(load, 60_000)
    return () => window.clearInterval(t)
  }, [user])
  const critical = counts.critical ?? 0
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (!total) return null
  return (
    <Link
      to="/clinical-safety?tab=alerts"
      title="Clinical alerts"
      className={`fixed top-3 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${critical ? "bg-rose-600 text-white animate-pulse" : "bg-amber-400 text-slate-900"}`}
    >
      🔔 {critical ? `${critical} critical` : `${total} alerts`}
    </Link>
  )
}
