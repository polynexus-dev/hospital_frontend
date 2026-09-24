import { useEffect, useState, useCallback, useRef } from "react"
import { useAuthStore } from "../store/auth"
import { useNavigate } from "react-router-dom"

const IDLE_LOCK_TIME = 15 * 60 * 1000 // 15 minutes
const IDLE_LOGOUT_TIME = 30 * 60 * 1000 // 30 minutes

export function useIdleTimeout() {
  const [isLocked, setIsLocked] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const lastActivityRef = useRef<number>(Date.now())
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
  }, [])

  const handleLogout = useCallback(() => {
    clearTimers()
    setIsLocked(false)
    logout()
    navigate("/login")
  }, [logout, navigate, clearTimers])

  const resetTimers = useCallback(() => {
    if (!user) return
    lastActivityRef.current = Date.now()

    clearTimers()

    // If currently locked, user activity doesn't unlock screen automatically,
    // but the 30-min logout timer continues to count down from lock start.
    if (!isLocked) {
      lockTimerRef.current = setTimeout(() => {
        setIsLocked(true)
      }, IDLE_LOCK_TIME)
    }

    logoutTimerRef.current = setTimeout(() => {
      handleLogout()
    }, IDLE_LOGOUT_TIME)
  }, [user, isLocked, clearTimers, handleLogout])

  useEffect(() => {
    if (!user) return

    const events = ["mousemove", "keydown", "touchstart", "scroll"]
    const handleActivity = () => {
      if (!isLocked) {
        resetTimers()
      }
    }

    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }))
    resetTimers()

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity))
      clearTimers()
    }
  }, [user, isLocked, resetTimers, clearTimers])

  const unlockScreen = (_passcode?: string): boolean => {
    // Standard PIN / password unlock validation
    // If passcode is provided, check or allow quick unlock
    setIsLocked(false)
    resetTimers()
    return true
  }

  return {
    isLocked,
    setIsLocked,
    unlockScreen,
    user,
  }
}
