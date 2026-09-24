import { describe, expect, it, beforeEach } from "vitest"
import { useAuthStore } from "./auth"

const AUTH_STORE_KEY = "hospital_crm_auth_store"

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
  })

  it("starts with no tokens and no user", () => {
    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.user).toBeNull()
  })

  it("setTokens stores both tokens in state and persists to localStorage", () => {
    useAuthStore.getState().setTokens("access-123", "refresh-456")

    const state = useAuthStore.getState()
    expect(state.accessToken).toBe("access-123")
    expect(state.refreshToken).toBe("refresh-456")

    const savedRaw = localStorage.getItem(AUTH_STORE_KEY)
    expect(savedRaw).not.toBeNull()
    const saved = JSON.parse(savedRaw!)
    expect(saved.state.accessToken).toBe("access-123")
    expect(saved.state.refreshToken).toBe("refresh-456")
  })

  it("setAccessToken updates only the access token and persists to localStorage", () => {
    useAuthStore.getState().setTokens("access-1", "refresh-1")
    useAuthStore.getState().setAccessToken("access-2")

    const state = useAuthStore.getState()
    expect(state.accessToken).toBe("access-2")
    expect(state.refreshToken).toBe("refresh-1") // unchanged

    const savedRaw = localStorage.getItem(AUTH_STORE_KEY)
    const saved = JSON.parse(savedRaw!)
    expect(saved.state.accessToken).toBe("access-2")
  })

  it("setUser stores the user object and persists to localStorage", () => {
    const user = { id: 1, email: "doc@test-hospital.example", hospital_name: "Test Hospital" }
    // @ts-expect-error partial User for this test's purposes
    useAuthStore.getState().setUser(user)

    expect(useAuthStore.getState().user).toEqual(user)

    const savedRaw = localStorage.getItem(AUTH_STORE_KEY)
    const saved = JSON.parse(savedRaw!)
    expect(saved.state.user).toEqual(user)
  })

  it("logout clears tokens and user from both state and localStorage", () => {
    useAuthStore.getState().setTokens("access-1", "refresh-1")
    // @ts-expect-error partial User for this test's purposes
    useAuthStore.getState().setUser({ id: 1, email: "x@example.com" })

    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.user).toBeNull()

    const savedRaw = localStorage.getItem(AUTH_STORE_KEY)
    if (savedRaw) {
      const saved = JSON.parse(savedRaw)
      expect(saved.state.accessToken).toBeNull()
      expect(saved.state.refreshToken).toBeNull()
      expect(saved.state.user).toBeNull()
    }
  })
})

