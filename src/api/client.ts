import { useAuthStore } from "../store/auth"
import { decryptBytes, encryptBytes, encryptPayload, ensureSession, getSessionId, isSessionReady, resetSession } from "./payloadCrypto"

export function getSubdomain(): string | null {
  if (typeof window === "undefined") return null
  const urlParams = new URLSearchParams(window.location.search)
  const querySub = urlParams.get("subdomain") || urlParams.get("hospital")
  if (querySub) return querySub.toLowerCase()

  const host = window.location.hostname.toLowerCase()
  // an IP address (192.168.1.156, ::1) is never a hospital subdomain
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null
  const parts = host.split(".")
  const reserved = new Set(["www", "api", "hms", "crm", "admin", "app", "hospital"])

  // e.g. apollo.hms.polynexus.in -> apollo
  if (parts.length >= 3 && !reserved.has(parts[0])) {
    return parts[0]
  }
  // e.g. apollo.localhost -> apollo
  if (parts.length === 2 && parts[1] === "localhost" && !reserved.has(parts[0])) {
    return parts[0]
  }
  return null
}


export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl && envUrl.startsWith("http")) return envUrl
  // A path (production images build with "/api/v1"): the API is behind the
  // same nginx as the page, whatever host and port that is — including
  // localhost:8080 on an on-premise install.
  if (envUrl && envUrl.startsWith("/") && typeof window !== "undefined") return `${window.location.origin}${envUrl}`

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${window.location.protocol}//${window.location.host}/api/v1`
    }
  }

  return "http://localhost:8000/api/v1"
}

export const API_BASE_URL = getApiBaseUrl()

/** The readable reason in a DRF error body ("detail", or the first field error), if any. */
const fieldLabel = (key: string) => key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())

/**
 * The readable reason in a DRF error body: "detail", or every field error
 * ("Pan: PAN looks like ABCDE1234F.; Email: Enter a valid email address.").
 * Shown on screen — with payload encryption the browser's Network tab can't.
 */
function describeErrorBody(body: unknown): string | null {
  if (!body) return null
  if (typeof body === "string") return body.trim().startsWith("<") ? null : body // an HTML error page is not a message
  if (Array.isArray(body)) return body.length ? body.map(String).join("; ") : null
  if (typeof body === "object") {
    const b = body as Record<string, unknown>
    if (typeof b.detail === "string") return b.detail
    const parts: string[] = []
    for (const [key, val] of Object.entries(b)) {
      const text = Array.isArray(val) ? val.map((v) => (typeof v === "object" ? describeErrorBody(v) : String(v))).filter(Boolean).join(" ") : typeof val === "object" && val ? describeErrorBody(val) : String(val)
      if (!text) continue
      parts.push(key === "non_field_errors" || key === "errors" || key === "detail" ? text : `${fieldLabel(key)}: ${text}`)
      if (parts.length === 4) break
    }
    return parts.length ? parts.join("; ") : null
  }
  return null
}

const SECRET_KEY = /pass(word)?|otp|token|secret|pin$/i

/** Failed calls, decrypted, in the console: dev builds, or any build after localStorage.hms_debug_api = "1". */
function logApiFailure(method: string, path: string, status: number, sent: unknown, received: unknown) {
  let on = import.meta.env.DEV
  try {
    on = on || localStorage.getItem("hms_debug_api") === "1"
  } catch {
    // storage blocked
  }
  if (!on) return
  const masked = sent && typeof sent === "object" && !(sent instanceof FormData)
    ? Object.fromEntries(Object.entries(sent as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) ? "•••" : v]))
    : sent
  console.warn(`[API ${status}] ${method} ${path}`, { request: masked, response: received })
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown, message: string) {
    // screens that show err.message get the server's reason, not "Request … failed with 400"
    super(describeErrorBody(body) ?? message)
    this.status = status
    this.body = body
  }
}

export function extractApiError(err: unknown, fallback = "An unexpected error occurred."): string {
  if (err instanceof ApiError) return describeErrorBody(err.body) ?? err.message
  if (err instanceof Error) return err.message
  return fallback
}

let refreshPromise: Promise<string | null> | null = null

// Opts this browser app into the httpOnly refresh cookie (see
// apps.accounts.refresh_cookie on the backend): sign-in and refresh then
// set the cookie instead of returning the refresh token in the body. The
// cookie is scoped to /api/v1/auth/, so other calls never carry it.
const AUTH_COOKIE_HEADER = { "X-Auth-Cookie": "1" }

interface SecureInit {
  method?: string
  body?: unknown // JSON-serialisable, or FormData
  headers?: Record<string, string>
  signal?: AbortSignal | null
}

/** A FormData as the exact multipart bytes the browser would send, and their type. */
async function multipartBytes(form: FormData): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> {
  const encoded = new Response(form)
  return { bytes: new Uint8Array(await encoded.arrayBuffer()), contentType: encoded.headers.get("content-type") ?? "" }
}

/** Opens a sealed response, of any type, back into an ordinary Response. */
async function unseal(res: Response): Promise<Response> {
  if (!isSessionReady() || !(res.headers.get("content-type") ?? "").includes("application/json")) return res
  const json = (await res.clone().json().catch(() => null)) as { enc?: string; ct?: string } | null
  if (!json?.enc) return res
  return new Response(await decryptBytes(json.enc), { status: res.status, headers: { "content-type": json.ct ?? "application/json" } })
}

/**
 * The one way this app talks to the API. Body and query string go out
 * encrypted, whatever the response is comes back opened, and nothing is sent
 * at all if a secure session can't be set up. `path` is relative to the API.
 */
export async function secureFetch(path: string, init: SecureInit = {}, isRetry = false): Promise<Response> {
  await ensureSession()
  const { body, headers, ...rest } = init
  const finalHeaders: Record<string, string> = { ...AUTH_COOKIE_HEADER, ...headers }
  const isForm = body instanceof FormData
  if (!isForm) finalHeaders["Content-Type"] = "application/json"

  let url = `${API_BASE_URL}${path}`
  let sent: string | FormData | undefined
  if (isSessionReady()) {
    finalHeaders["X-Session-Id"] = getSessionId() as string
    const queryAt = path.indexOf("?")
    if (queryAt >= 0) {
      url = `${API_BASE_URL}${path.slice(0, queryAt)}`
      finalHeaders["X-Enc-Query"] = await encryptBytes(new TextEncoder().encode(path.slice(queryAt + 1)))
    }
    if (isForm) {
      const { bytes, contentType } = await multipartBytes(body)
      finalHeaders["Content-Type"] = "application/json"
      sent = JSON.stringify({ enc: await encryptBytes(bytes), ct: contentType })
    } else if (body !== undefined) {
      sent = JSON.stringify(await encryptPayload(body))
    }
  } else {
    sent = isForm ? body : body === undefined ? undefined : JSON.stringify(body)
  }

  const res = await fetch(url, { ...rest, headers: finalHeaders, body: sent, credentials: "include" })

  if (res.status === 401 && !isRetry) {
    // the server lost our encryption session (restart / TTL): re-key, not log out
    const detail = String(((await res.clone().json().catch(() => null)) as { detail?: string } | null)?.detail ?? "")
    if (detail.includes("Encryption session")) {
      await resetSession()
      return secureFetch(path, init, true)
    }
  }
  return unseal(res)
}

async function postRefresh(): Promise<Response> {
  return secureFetch("/auth/refresh/", { method: "POST", body: {} })
}

/** One refresh at a time across every open tab: refresh tokens rotate and the old one is blacklisted, so two tabs spending the same cookie at once would sign one of them out. */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined
  return locks ? locks.request("hms-token-refresh", fn) : fn()
}

async function refreshAccessToken(): Promise<string | null> {
  const { setAccessToken, logout } = useAuthStore.getState()

  if (!refreshPromise) {
    refreshPromise = withRefreshLock(postRefresh)
      .then(async (res) => {
        if (!res.ok) {
          logout()
          return null
        }
        const data = (await res.json()) as { access: string }
        setAccessToken(data.access)
        return data.access as string
      })
      .catch(() => {
        logout()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  isFormData?: boolean // not needed: a FormData body is recognised on its own
  skipAuth?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { body, skipAuth, headers, method, signal } = options
  // After a reload the access token (memory only) is gone: get one from the
  // refresh cookie up front rather than letting every first request 401.
  if (!skipAuth && !useAuthStore.getState().accessToken && useAuthStore.getState().user) await refreshAccessToken()
  const { accessToken } = useAuthStore.getState()

  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) }
  if (accessToken && !skipAuth) finalHeaders["Authorization"] = `Bearer ${accessToken}`

  const res = await secureFetch(path, { method, body, headers: finalHeaders, signal })

  if (res.status === 401 && !isRetry && !skipAuth) {
    const newToken = await refreshAccessToken()
    if (newToken) return request<T>(path, options, true)
  }

  if (!res.ok) {
    let parsedBody: unknown = null
    try {
      parsedBody = await res.json()
    } catch {
      // no JSON body
    }
    logApiFailure(String(method ?? "GET"), path, res.status, body, parsedBody)
    throw new ApiError(res.status, parsedBody, `Request to ${path} failed with ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return undefined as T

  return (await res.json()) as T
}

async function requestBlob(path: string, options: { skipAuth?: boolean } = {}, isRetry = false): Promise<Blob> {
  if (!options.skipAuth && !useAuthStore.getState().accessToken && useAuthStore.getState().user) await refreshAccessToken()
  const { accessToken } = useAuthStore.getState()
  const res = await secureFetch(path, { headers: accessToken && !options.skipAuth ? { Authorization: `Bearer ${accessToken}` } : {} })

  if (res.status === 401 && !isRetry && !options.skipAuth) {
    const newToken = await refreshAccessToken()
    if (newToken) return requestBlob(path, options, true)
  }

  if (!res.ok) {
    throw new ApiError(res.status, null, `Request to ${path} failed with ${res.status}`)
  }
  return res.blob()
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
  // For authenticated binary downloads (PDFs, etc.) — window.open()/a[href]
  // can't attach an Authorization header, so the caller fetches the blob
  // here and triggers the save itself (see triggerBlobDownload below).
  getBlob: (path: string, options?: { skipAuth?: boolean }) => requestBlob(path, options),
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
