import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "../store/auth"

// api/client.ts reads API_BASE_URL from import.meta.env at module-eval
// time, and useAuthStore.getState() fresh per call — no network involved,
// every test below drives it through a mocked global fetch.

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
    vi.restoreAllMocks()
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
})
