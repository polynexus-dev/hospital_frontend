import { useAuthStore } from "../store/auth"
import { decryptPayload, encryptPayload, ensureSession, getSessionId, isSessionReady, resetSession } from "./payloadCrypto"

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

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAccessToken, logout } = useAuthStore.getState()
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = (async () => {
      await ensureSession()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const sessionId = getSessionId()
      if (sessionId) headers["X-Session-Id"] = sessionId
      const body = isSessionReady() ? JSON.stringify(await encryptPayload({ refresh: refreshToken })) : JSON.stringify({ refresh: refreshToken })
      return fetch(`${API_BASE_URL}/auth/refresh/`, { method: "POST", headers, body })
    })()
      .then(async (res) => {
        if (!res.ok) {
          logout()
          return null
        }
        const data = (await readJson(res)) as { access: string }
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
  isFormData?: boolean
  skipAuth?: boolean
}

/** Parses a JSON body, decrypting it when it is a Layer-2 {"enc": "gcm2$…"} payload. */
async function readJson(res: Response): Promise<unknown> {
  const json = await res.json()
  if (json && typeof json === "object" && "enc" in json && isSessionReady()) return decryptPayload(json.enc as string)
  return json
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  // never send a request in plain text while the encryption handshake is still running
  await ensureSession()
  const { accessToken } = useAuthStore.getState()
  const { body, isFormData, skipAuth, headers, ...rest } = options

  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) }
  if (!isFormData) finalHeaders["Content-Type"] = "application/json"
  if (accessToken && !skipAuth) finalHeaders["Authorization"] = `Bearer ${accessToken}`

  // Attach session ID so the backend PayloadEncryptionMiddleware can look up
  // the shared AES key. No-op when session is not initialised (dev / Postman).
  const sessionId = getSessionId()
  if (sessionId) finalHeaders["X-Session-Id"] = sessionId

  // Encrypt the request body when the session is active.
  let serialisedBody: string | FormData | undefined
  if (isFormData) {
    serialisedBody = body as FormData
  } else if (body !== undefined) {
    if (isSessionReady()) {
      // Encrypt: send {"enc":"gcm2$..."} instead of plain JSON.
      const encrypted = await encryptPayload(body)
      serialisedBody = JSON.stringify(encrypted)
    } else {
      serialisedBody = JSON.stringify(body)
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: serialisedBody,
  })

  if (res.status === 401 && !isRetry) {
    // the server lost our encryption session (restart / TTL): re-key, not log out
    const detail = String(((await res.clone().json().catch(() => null)) as { detail?: string } | null)?.detail ?? "")
    if (detail.includes("Encryption session")) {
      await resetSession()
      return request<T>(path, options, true)
    }
    if (!skipAuth) {
      const newToken = await refreshAccessToken()
      if (newToken) return request<T>(path, options, true)
    }
  }

  if (!res.ok) {
    let parsedBody: unknown = null
    try {
      parsedBody = await readJson(res)
    } catch {
      // no JSON body
    }
    logApiFailure(String(rest.method ?? "GET"), path, res.status, body, parsedBody)
    throw new ApiError(res.status, parsedBody, `Request to ${path} failed with ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return undefined as T

  return (await readJson(res)) as T
}

async function requestBlob(path: string, isRetry = false): Promise<Blob> {
  const { accessToken } = useAuthStore.getState()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })

  if (res.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken()
    if (newToken) return requestBlob(path, true)
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
  getBlob: (path: string) => requestBlob(path),
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
