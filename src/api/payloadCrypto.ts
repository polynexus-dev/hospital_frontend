/**
 * Application-layer payload encryption (Layer 2).
 *
 * Uses the browser Web Crypto API (built-in, zero dependencies) to perform:
 *   1. ECDH-P256 key exchange with the server on session init.
 *   2. AES-256-GCM encrypt/decrypt of every API request body and response body.
 *
 * The shared AES key is derived independently by both sides via ECDH math --
 * it is never transmitted over the wire. It lives in module-level memory for
 * the duration of the browser session (lost on page refresh / tab close).
 *
 * Call `initSession()` once at app boot (main.tsx).
 * All subsequent encryption/decryption is handled transparently by client.ts.
 */

import { getApiBaseUrl } from "./client"

// ── Module-level session state ─────────────────────────────────────────────
let _sessionId: string | null = null
let _aesKey: CryptoKey | null = null

/** Returns the current session ID, or null if not yet initialised. */
export function getSessionId(): string | null {
  return _sessionId
}

/** True if the ECDH handshake has been completed and payloads can be encrypted. */
export function isSessionReady(): boolean {
  return _sessionId !== null && _aesKey !== null
}

// ── Helper: base64url encode/decode raw bytes ──────────────────────────────

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ""
  bytes.forEach((b) => (str += String.fromCharCode(b)))
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function base64UrlToBuffer(b64: string): ArrayBuffer {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf.buffer
}

// ── ECDH key exchange ──────────────────────────────────────────────────────

/**
 * Perform ECDH key exchange with the server.
 *
 * 1. Generate ephemeral P-256 key pair in the browser.
 * 2. POST client public key to /api/v1/session-key/.
 * 3. Receive server public key + session_id.
 * 4. Derive shared AES-256-GCM key via ECDH (key never transmitted).
 * 5. Store session_id and AES key in module memory.
 *
 * Safe to call multiple times -- subsequent calls re-key the session.
 */
export async function initSession(): Promise<void> {
  const baseUrl = getApiBaseUrl()

  // 1. Generate ephemeral ECDH P-256 key pair.
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false, // private key is non-extractable
    ["deriveKey"],
  )

  // 2. Export client public key as uncompressed X9.62 point (65 bytes).
  const clientPubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey)
  const clientPubB64 = bufferToBase64Url(clientPubRaw)

  // 3. POST to server.
  const res = await fetch(`${baseUrl}/session-key/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_public_key: clientPubB64 }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Session key exchange failed (${res.status}): ${text}`)
  }

  const { session_id, server_public_key } = (await res.json()) as {
    session_id: string
    server_public_key: string
  }

  // 4. Import server public key and derive shared AES-256-GCM key via ECDH.
  const serverPubRaw = base64UrlToBuffer(server_public_key)
  const serverPubKey = await crypto.subtle.importKey(
    "raw",
    serverPubRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  )

  // ECDH derive bits, then import as AES-256-GCM key.
  // Note: Web Crypto ECDH produces 32 bytes for P-256 which is exactly
  // AES-256. We apply the same HKDF-like info string on the server side
  // via the Python cryptography HKDF; the browser derives a matching key
  // because both sides use the same ECDH shared secret as input.
  //
  // To match server-side HKDF we run HKDF in the browser too.
  const ecdhBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: serverPubKey },
    keyPair.privateKey,
    256,
  )

  // HKDF-SHA-256: expand ecdhBits with the same info string as the server.
  const hkdfKey = await crypto.subtle.importKey("raw", ecdhBits, "HKDF", false, ["deriveKey"])
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0), // matches server salt=None -> zero bytes
      info: new TextEncoder().encode("hospital-crm-payload-v1"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )

  // 5. Store in module memory.
  _sessionId = session_id
  _aesKey = aesKey
}

// ── AES-256-GCM encrypt / decrypt ─────────────────────────────────────────

const PAYLOAD_PREFIX = "gcm2$"
const NONCE_LEN = 12 // bytes

/**
 * Encrypt any serialisable value.
 * Returns { enc: "gcm2$<base64url(nonce+ciphertext)>" }
 */
export async function encryptPayload(data: unknown): Promise<{ enc: string }> {
  if (!_aesKey) throw new Error("Payload encryption session not initialised. Call initSession() first.")

  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN))

  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, _aesKey, plaintext)

  // Concatenate nonce || ciphertext into one buffer.
  const combined = new Uint8Array(NONCE_LEN + ciphertext.byteLength)
  combined.set(nonce, 0)
  combined.set(new Uint8Array(ciphertext), NONCE_LEN)

  return { enc: PAYLOAD_PREFIX + bufferToBase64Url(combined.buffer) }
}

/**
 * Decrypt a "gcm2$..." token.
 * Returns the original parsed value.
 */
export async function decryptPayload(token: string): Promise<unknown> {
  if (!_aesKey) throw new Error("Payload encryption session not initialised. Call initSession() first.")
  if (!token.startsWith(PAYLOAD_PREFIX)) throw new Error("Not a gcm2$ token.")

  const combined = new Uint8Array(base64UrlToBuffer(token.slice(PAYLOAD_PREFIX.length)))
  const nonce = combined.slice(0, NONCE_LEN)
  const ciphertext = combined.slice(NONCE_LEN)

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, _aesKey, ciphertext)
  return JSON.parse(new TextDecoder().decode(plaintext))
}
