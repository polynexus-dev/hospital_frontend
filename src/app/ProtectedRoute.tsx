import { useEffect, useState } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "../store/auth"
import { fetchMe } from "../api/auth"

export function ProtectedRoute() {
  const { refreshToken, user, setUser, logout } = useAuthStore()
  const [checked, setChecked] = useState(!!user)

  useEffect(() => {
    if (user || !refreshToken) {
      setChecked(true)
      return
    }
    fetchMe()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setChecked(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!refreshToken) return <Navigate to="/login" replace />
  if (!checked) return null
  if (!useAuthStore.getState().user) return <Navigate to="/login" replace />

  return <Outlet />
}
