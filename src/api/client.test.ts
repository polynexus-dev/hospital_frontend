import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "../store/auth"

// Payload encryption is off for these tests (as when the server has
// PAYLOAD_ENCRYPTION_ENABLED=False); `crypto` below switches it on per test.
const crypto = vi.hoisted(() => ({ ready: false, resets: 0 }))
vi.mock("./payloadCrypto", () => ({
  ensureSession: async () => {},
  resetSession: async () => {
    crypto.resets++
  },
  getSessionId: () => (crypto.ready ? "sess-1" : null),
  isSessionReady: () => crypto.ready,
  encryptPayload: async (data: unknown) => ({ enc: `gcm2$${btoa(JSON.stringify(data))}` }),
  decryptPayload: async (token: string) => JSON.parse(atob(token.slice(5))),
}))

// api/client.ts reads API_BASE_URL from import.meta.env at module-eval
// time, and useAuthStore.getState() fresh per call — no network involved,
// every test below drives it through a mocked global fetch.

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
    vi.restoreAllMocks()
    crypto.ready = false
    crypto.resets = 0
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("attaches the Authorization header when an access token is present", async () => {
    useAuthStore.setState({ accessToken: "tok-abc" })
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("./client")
    await api.get("/patients/")

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers["Authorization"]).toBe("Bearer tok-abc")
  })

  it("does not attach an Authorization header when there is no access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("./client")
    await api.get("/public-endpoint/")

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers["Authorization"]).toBeUndefined()
  })

  it("on a 401, refreshes the access token and retries the original request once", async () => {
    useAuthStore.setState({ accessToken: "expired-tok", refreshToken: "refresh-tok" })

    const fetchMock = vi.fn()
      // 1. original request -> 401
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      // 2. refresh call -> new access token
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: "new-tok" }), { status: 200, headers: { "content-type": "application/json" } }))
      // 3. retried original request -> success
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200, headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("./client")
    const result = await api.get<{ id: number }>("/patients/1/")

    expect(result).toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/refresh/")
    // The retried call carries the *new* token, not the expired one.
    expect(fetchMock.mock.calls[2][1].headers["Authorization"]).toBe("Bearer new-tok")
    expect(useAuthStore.getState().accessToken).toBe("new-tok")
  })

  it("logs out and gives up (does not retry forever) when the refresh call itself fails", async () => {
    useAuthStore.setState({ accessToken: "expired-tok", refreshToken: "refresh-tok" })

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // original
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // refresh also fails
    vi.stubGlobal("fetch", fetchMock)

    const { api, ApiError } = await import("./client")
    await expect(api.get("/patients/1/")).rejects.toBeInstanceOf(ApiError)

    expect(fetchMock).toHaveBeenCalledTimes(2) // no third (retried) call
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().refreshToken).toBeNull()
  })

  it("does not attempt a refresh loop on a second consecutive 401 (isRetry guard)", async () => {
    useAuthStore.setState({ accessToken: "expired-tok", refreshToken: "refresh-tok" })

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // original
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: "new-tok" }), { status: 200, headers: { "content-type": "application/json" } })) // refresh succeeds
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // retried request 401s AGAIN (e.g. permission issue, not an expired token)
    vi.stubGlobal("fetch", fetchMock)

    const { api, ApiError } = await import("./client")
    await expect(api.get("/patients/1/")).rejects.toBeInstanceOf(ApiError)

    expect(fetchMock).toHaveBeenCalledTimes(3) // not a fourth call — doesn't refresh-and-retry indefinitely
  })

  it("throws ApiError with the parsed error body on a non-401 failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Not found." }), { status: 404, headers: { "content-type": "application/json" } })
    )
    vi.stubGlobal("fetch", fetchMock)

    const { api, ApiError } = await import("./client")
    try {
      await api.get("/patients/999/")
      expect.unreachable("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as InstanceType<typeof ApiError>).status).toBe(404)
      expect((err as InstanceType<typeof ApiError>).body).toEqual({ detail: "Not found." })
    }
  })

  it("returns undefined for a 204 No Content response instead of trying to parse a body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("./client")
    const result = await api.delete("/patients/1/")

    expect(result).toBeUndefined()
  })

  it("sends JSON.stringify'd bodies with a Content-Type of application/json by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 201, headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("./client")
    await api.post("/patients/", { first_name: "Asha", mobile: "9800000000" })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers["Content-Type"]).toBe("application/json")
    expect(options.body).toBe(JSON.stringify({ first_name: "Asha", mobile: "9800000000" }))
  })

  it("with an encryption session, sends and reads only encrypted bodies — errors included", async () => {
    crypto.ready = true
    const enc = (o: unknown) => JSON.stringify({ enc: `gcm2$${btoa(JSON.stringify(o))}` })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(enc({ id: 7 }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(enc({ mobile: ["Invalid"] }), { status: 400, headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const { api, ApiError } = await import("./client")
    expect(await api.post("/patients/", { first_name: "Asha" })).toEqual({ id: 7 })
    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers["X-Session-Id"]).toBe("sess-1")
    expect(options.body).not.toContain("Asha") // nothing readable on the wire

    const err = (await api.post("/patients/", {}).catch((e: unknown) => e)) as InstanceType<typeof ApiError>
    expect(err).toBeInstanceOf(ApiError)
    expect(err.body).toEqual({ mobile: ["Invalid"] }) // decrypted, so the form can show it
  })

  it("re-keys (does not log out) when the server has lost the encryption session", async () => {
    crypto.ready = true
    useAuthStore.setState({ accessToken: "tok", refreshToken: "refresh-tok" })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Encryption session not found or expired." }), { status: 401, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const { api } = await import("./client")
    expect(await api.get("/patients/")).toEqual({ ok: 1 })
    expect(crypto.resets).toBe(1)
    expect(fetchMock.mock.calls.map((c) => String(c[0])).some((u) => u.includes("/auth/refresh/"))).toBe(false)
    expect(useAuthStore.getState().accessToken).toBe("tok")
  })
})

describe("getApiBaseUrl", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("uses a full URL as given (development)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://192.168.1.10:8000/api/v1")
    const { getApiBaseUrl } = await import("./client")
    expect(getApiBaseUrl()).toBe("http://192.168.1.10:8000/api/v1")
  })

  it("resolves a path against the page's own origin, even on localhost (on-premise behind nginx)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1")
    const { getApiBaseUrl } = await import("./client")
    expect(getApiBaseUrl()).toBe(`${window.location.origin}/api/v1`)
  })
})

describe("ApiError message (shown on screen — encryption hides the Network tab)", () => {
  it("lists every field error with readable field names", async () => {
    const { ApiError } = await import("./client")
    const err = new ApiError(400, { pan: ["PAN looks like ABCDE1234F."], email: ["Enter a valid email address."] }, "Request to /doctors/ failed with 400")
    expect(err.message).toBe("Pan: PAN looks like ABCDE1234F.; Email: Enter a valid email address.")
  })

  it("uses detail when present, and the generic text for HTML error pages", async () => {
    const { ApiError } = await import("./client")
    expect(new ApiError(403, { detail: "You do not have permission." }, "x").message).toBe("You do not have permission.")
    expect(new ApiError(500, "<!DOCTYPE html><html>…", "Request to /x/ failed with 500").message).toBe("Request to /x/ failed with 500")
  })
})
