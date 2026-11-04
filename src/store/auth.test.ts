import { describe, expect, it, beforeEach } from "vitest"
import { useAuthStore } from "./auth"

const AUTH_STORE_KEY = "hospital_crm_auth_store"

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ accessToken: null, user: null })
  })

  it("starts with no token and no user", () => {
    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.user).toBeNull()
  })

  it("keeps the access token in memory only, never in localStorage", () => {
    useAuthStore.getState().setAccessToken("access-123")

    expect(useAuthStore.getState().accessToken).toBe("access-123")
    expect(localStorage.getItem(AUTH_STORE_KEY) ?? "").not.toContain("access-123")
  })

  it("setUser stores the user object and persists to localStorage", () => {
    const user = { id: 1, email: "doc@test-hospital.example", hospital_name: "Test Hospital" }
    // @ts-expect-error partial User for this test's purposes
    useAuthStore.getState().setUser(user)

    expect(useAuthStore.getState().user).toEqual(user)

    const saved = JSON.parse(localStorage.getItem(AUTH_STORE_KEY)!)
    expect(saved.state).toEqual({ user })
  })

  it("logout clears the token and user from both state and localStorage", () => {
    useAuthStore.getState().setAccessToken("access-1")
    // @ts-expect-error partial User for this test's purposes
    useAuthStore.getState().setUser({ id: 1, email: "x@example.com" })

    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.user).toBeNull()
    expect(JSON.parse(localStorage.getItem(AUTH_STORE_KEY)!).state.user).toBeNull()
  })

  it("drops tokens an older version left in localStorage", async () => {
    localStorage.setItem(AUTH_STORE_KEY, JSON.stringify({ state: { accessToken: "old-a", refreshToken: "old-r", user: { id: 1 } }, version: 0 }))
    await useAuthStore.persist.rehydrate()

    const saved = localStorage.getItem(AUTH_STORE_KEY) ?? ""
    expect(saved).not.toContain("old-r")
    expect(saved).not.toContain("old-a")
    expect(useAuthStore.getState().user).toBeNull()
  })
})
