import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { User } from "../types/api"

// Tokens are never written to browser storage (OWASP A07 / WASA): the
// refresh token is an httpOnly cookie the backend sets and reads itself
// (apps.accounts.refresh_cookie), and the short-lived access token lives in
// memory only — after a reload the API client gets a fresh one from the
// cookie. Only the signed-in user's profile is persisted, for a fast first paint.
interface AuthState {
  accessToken: string | null
  user: User | null
  setAccessToken: (access: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAccessToken: (access) => set({ accessToken: access }),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ accessToken: null, user: null })
      },
    }),
    {
      name: "hospital_crm_auth_store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      // v0 kept both tokens in localStorage: drop them (and the session
      // they belonged to — the new sign-in sets the cookie).
      version: 1,
      migrate: () => ({ user: null }),
    },
  ),
)

// "Keep me signed in" (login page). Unchecked, the refresh cookie is a
// browser-session cookie; the cached profile is dropped the same way when a
// browser session no longer carries the sessionStorage marker (it was closed).
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

/** The last "Keep me signed in" choice — the SSO return trip reads it, since the box was ticked before leaving for the identity provider. */
export function keptSessionChoice(): boolean {
  try {
    return localStorage.getItem(KEEP_KEY) !== "0"
  } catch {
    return true
  }
}
