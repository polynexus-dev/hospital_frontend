import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { User } from "../types/api"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setTokens: (access: string, refresh: string) => void
  setAccessToken: (access: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (access, refresh) => {
        set({ accessToken: access, refreshToken: refresh })
      },
      setAccessToken: (access) => set({ accessToken: access }),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null })
      },
    }),
    {
      name: "hospital_crm_auth_store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

// "Keep me signed in" (login page). Tokens always live in localStorage; when
// the box was left unchecked, a browser session that no longer carries the
// sessionStorage marker (the browser was closed) starts signed out.
const KEEP_KEY = "hms_keep_signed_in"
const ALIVE_KEY = "hms_session_alive"

export function rememberSessionChoice(keep: boolean) {
  try {
    localStorage.setItem(KEEP_KEY, keep ? "1" : "0")
    sessionStorage.setItem(ALIVE_KEY, "1")
  } catch {
    // storage unavailable — default behaviour (stay signed in) applies
  }
}

export function endSessionIfNotKept() {
  try {
    if (localStorage.getItem(KEEP_KEY) === "0" && !sessionStorage.getItem(ALIVE_KEY)) {
      useAuthStore.getState().logout()
    }
    sessionStorage.setItem(ALIVE_KEY, "1")
  } catch {
    // storage unavailable
  }
}
