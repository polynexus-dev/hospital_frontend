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


