import { useAuthStore } from "../store/auth"
import { decryptPayload, encryptPayload, getSessionId, isSessionReady } from "./payloadCrypto"

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl && envUrl.startsWith("http")) return envUrl
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.host}/api/v1`
  }
  return "http://localhost:8000/api/v1"
}

export const API_BASE_URL = getApiBaseUrl()

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAccessToken, logout } = useAuthStore.getState()
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          logout()
          return null
        }
        const data = await res.json()
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

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
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

  if (res.status === 401 && !skipAuth && !isRetry) {
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
    throw new ApiError(res.status, parsedBody, `Request to ${path} failed with ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return undefined as T

  const json = await res.json()

  // Decrypt the response if it is a Layer-2 encrypted payload.
  if (json && typeof json === "object" && "enc" in json && isSessionReady()) {
    return decryptPayload(json.enc as string) as Promise<T>
  }

  return json as T
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
