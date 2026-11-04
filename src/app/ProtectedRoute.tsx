import { useEffect } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "../store/auth"
import { fetchMe } from "../api/auth"

export function ProtectedRoute() {
  // Signed in = a cached profile; the session itself is the httpOnly refresh
  // cookie, which page scripts can't see. If it's gone or expired, the first
  // API call fails its refresh, logout() clears the user and this redirects.
  const { user, setUser } = useAuthStore()

  useEffect(() => {
    if (!user) return
    // Render straight away from the cached profile, but refresh it: the
    // store is persisted across sessions, and a stale copy hides menus
    // for permissions/modules granted since the last sign-in.
    Promise.resolve()
      .then(fetchMe)
      .then((me) => me && setUser(me))
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
