import { create } from "zustand"
import type { User } from "../types/api"

const REFRESH_TOKEN_KEY = "hospital_crm_refresh_token"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setTokens: (access: string, refresh: string) => void
  setAccessToken: (access: string) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  user: null,
  setTokens: (access, refresh) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
    set({ accessToken: access, refreshToken: refresh })
  },
  setAccessToken: (access) => set({ accessToken: access }),
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    set({ accessToken: null, refreshToken: null, user: null })
  },
}))
