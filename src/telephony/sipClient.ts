import JsSIP from "jssip"

export type SIPStatus = "offline" | "registering" | "online" | "busy"

export interface SIPConfig {
  wsUrl: string
  sipDomain: string
  extNumber: string
  authNumber: string
  password: string
  displayName: string
}

export const CONFIG: SIPConfig = {
  wsUrl:       (import.meta as any).env?.VITE_SIP_SERVER       || "wss://ecallpbx.konnectcom.in:7443",
  sipDomain:   (import.meta as any).env?.VITE_SIP_DOMAIN       || "ecallpbx.konnectcom.in",
  extNumber:   (import.meta as any).env?.VITE_SIP_USER         || "1048101",
  authNumber:  (import.meta as any).env?.VITE_SIP_AUTH_USER    || "1048101",
  password:    (import.meta as any).env?.VITE_SIP_PASSWORD     || "Hospital@123",
  displayName: (import.meta as any).env?.VITE_SIP_DISPLAY_NAME || "Reception",
}

export interface ActiveCallInfo {
  callerNumber: string
  callerDisplayName: string
  direction: "inbound" | "outbound"
  state: "ringing" | "connected" | "ended"
  startedAt?: Date
}

let ua: JsSIP.UA | null = null
let currentSession: any = null
let currentStatus: SIPStatus = "offline"
let currentCallInfo: ActiveCallInfo | null = null
let autoAnswerEnabled = false
let recentOutboundCall: { number: string; initiatedAt: number } | null = null

export function registerOutboundCall(toNumber: string) {
  recentOutboundCall = {
    number: toNumber,
    initiatedAt: Date.now(),
  }
}

const listeners = new Set<(status: SIPStatus) => void>()
const callListeners = new Set<(call: ActiveCallInfo | null) => void>()
let bridgedCallback: (() => void) | null = null

function updateStatus(status: SIPStatus) {
  currentStatus = status
  listeners.forEach((listener) => {
    try {
      listener(status)
    } catch (e) {
      console.error("[SIP] Error in status listener:", e)
    }
  })
}

function updateCallInfo(info: ActiveCallInfo | null) {
  currentCallInfo = info
  callListeners.forEach((listener) => {
    try {
      listener(info)
    } catch (e) {
      console.error("[SIP] Error in call info listener:", e)
    }
  })
}

export function subscribeToCallInfo(cb: (call: ActiveCallInfo | null) => void): () => void {
  callListeners.add(cb)
  cb(currentCallInfo)
  return () => {
    callListeners.delete(cb)
  }
}

export function setAutoAnswer(enabled: boolean) {
  autoAnswerEnabled = enabled
  try {
    localStorage.setItem("sip_auto_answer", String(enabled))
  } catch {}
}

export function getAutoAnswer(): boolean {
  try {
    const val = localStorage.getItem("sip_auto_answer")
    if (val !== null) return val === "true"
  } catch {}
  return autoAnswerEnabled
}

export function isUserOnCall(): boolean {
  return currentStatus === "busy" || (currentSession !== null && currentCallInfo !== null)
}

/**
 * Pre-acquire microphone access so incoming calls can be answered immediately
 */
export async function ensureMicrophoneAccess(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      console.log("[SIP] 🎤 Microphone access granted ✓")
      return true
    }
  } catch (err: any) {
    console.warn("[SIP] ⚠️ Microphone notice:", err?.name, err?.message)
  }
  return false
}

function attachRemoteAudio(session: any) {
  try {
    session.on("peerconnection", ({ peerconnection }: any) => {
      peerconnection.addEventListener("track", (event: any) => {
        let audioElement = document.getElementById("webrtc-sip-audio") as HTMLAudioElement
        if (!audioElement) {
          audioElement = document.createElement("audio")
          audioElement.id = "webrtc-sip-audio"
          audioElement.autoplay = true
          audioElement.style.display = "none"
          document.body.appendChild(audioElement)
        }
        if (event.streams && event.streams[0]) {
          audioElement.srcObject = event.streams[0]
          audioElement.play().catch((err) => {
            console.warn("[SIP] Remote audio autoplay notice:", err?.message)
          })
        }
      })
    })
  } catch (err) {
    console.error("[SIP] Error attaching remote audio listener:", err)
  }
}

export interface InitSIPOptions {
  onStatusChange?: (status: SIPStatus) => void
  onCallBridged?: () => void
  force?: boolean
  customConfig?: Partial<SIPConfig>
}

/**
 * Initializes the SIP client in RECEIVE-ONLY mode.
 * Listens for incoming calls from HoduPBX (step 1 of click-to-call or inbound patient calls).
 */
export function initSIPClient({ onStatusChange, onCallBridged, force, customConfig }: InitSIPOptions = {}): void {
  if (onStatusChange) {
    listeners.add(onStatusChange)
    onStatusChange(currentStatus)
  }
  if (onCallBridged) {
    bridgedCallback = onCallBridged
  }

  if (force) {
    destroySIPClient()
  } else if (ua && (currentStatus === "online" || currentStatus === "busy" || currentStatus === "registering")) {
    return
  }

  const activeConfig: SIPConfig = {
    ...CONFIG,
    ...customConfig,
  }

  // Pre-acquire microphone access
  ensureMicrophoneAccess().catch(() => {})

  updateStatus("registering")
  console.log(`[SIP] Receiver connecting: sip:${activeConfig.extNumber}@${activeConfig.sipDomain} -> ${activeConfig.wsUrl}`)

  try {
    const socket = new JsSIP.WebSocketInterface(activeConfig.wsUrl)
    ua = new JsSIP.UA({
      sockets: [socket],
      uri: `sip:${activeConfig.extNumber}@${activeConfig.sipDomain}`,
      authorization_user: activeConfig.authNumber,
      password: activeConfig.password,
      display_name: activeConfig.displayName,
      user_agent: "HoduPhone",
      register: true,
      session_timers: false,
      register_expires: 300,
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
    })

    ua.on("connected", () => {
      console.log("[SIP] WebSocket connected ✓")
    })

    ua.on("disconnected", () => {
      console.warn("[SIP] WebSocket disconnected")
      updateStatus("offline")
    })

    ua.on("registered", () => {
      console.log(`[SIP] ✅ Incoming Call Receiver Registered! User=${activeConfig.extNumber} Domain=${activeConfig.sipDomain}`)
      updateStatus("online")
    })

    ua.on("unregistered", () => {
      console.warn("[SIP] Receiver Unregistered")
      updateStatus("offline")
    })

    ua.on("registrationFailed", (e: any) => {
      let detail = e?.cause || "Rejected"
      if (e?.response) {
        detail = `${e.response.status_code} ${e.response.reason_phrase || ""}`
        const wwwAuth = e.response.getHeader ? e.response.getHeader("www-authenticate") : null
        if (wwwAuth) {
          console.warn("[SIP] ↳ Challenge:", wwwAuth)
          const m = wwwAuth.match(/realm="([^"]+)"/)
          if (m) console.log(`[SIP] ↳ PBX expects realm: "${m[1]}"`)
        }
      }
      console.error(`[SIP] ❌ Receiver Registration failed: ${detail}`)
      updateStatus("offline")
    })

    // EXCLUSIVELY RECEIVE INCOMING CALLS
    ua.on("newRTCSession", ({ originator, session: s }: any) => {
      if (originator !== "remote") {
        console.log("[SIP] Ignored non-remote session (client is RECEIVE-ONLY)")
        return
      }

      // If user is already on a call, reject subsequent incoming calls immediately
      if (currentSession && (currentCallInfo?.state === "connected" || currentCallInfo?.state === "ringing")) {
        const busyCaller = s.remote_identity?.uri?.user || s.remote_identity?.uri?.toString() || "Unknown"
        console.warn(`[SIP] 🚫 Busy: User is already on an active call. Rejecting second call from ${busyCaller} with 486 Busy Here.`)
        try {
          s.terminate({ status_code: 486, reason_phrase: "Busy Here" })
        } catch (err) {
          console.error("[SIP] Error terminating second incoming call:", err)
        }
        return
      }

      currentSession = s
      const callerNumber = s.remote_identity?.uri?.user || s.remote_identity?.uri?.toString() || "Unknown Caller"
      const callerDisplayName = s.remote_identity?.display_name || callerNumber

      // Determine if this session is an outbound call (user clicked "Call" / click-to-call)
      // vs an inbound call from an external caller/patient.
      const isRecentOutbound = !!(recentOutboundCall && Date.now() - recentOutboundCall.initiatedAt < 45000)
      const isClick2CallName =
        callerDisplayName.toLowerCase().includes("click2call") ||
        callerDisplayName.toLowerCase().includes("click-to-call") ||
        callerDisplayName.toLowerCase().includes("c2c") ||
        callerDisplayName.toLowerCase().includes("outbound")
      const isOutbound = isRecentOutbound || isClick2CallName
      const direction: "inbound" | "outbound" = isOutbound ? "outbound" : "inbound"

      console.log(`[SIP] ${isOutbound ? "📤 OUTBOUND CALL" : "📥 INCOMING CALL"}: ${callerDisplayName} (${callerNumber})`)
      updateStatus("busy")

      const callInfo: ActiveCallInfo = {
        callerNumber,
        callerDisplayName,
        direction,
        state: "ringing",
      }
      updateCallInfo(callInfo)

      attachRemoteAudio(s)

      s.on("confirmed", () => {
        console.log(`[SIP] 📞 ${isOutbound ? "Outbound" : "Incoming"} call connected`)
        updateStatus("busy")
        updateCallInfo({
          ...callInfo,
          state: "connected",
          startedAt: new Date(),
        })
        bridgedCallback?.()
      })

      s.on("ended", () => {
        console.log("[SIP] 📴 Call ended")
        recentOutboundCall = null
        currentSession = null
        updateCallInfo(null)
        updateStatus(ua?.isRegistered() ? "online" : "offline")
      })

      s.on("failed", (e: any) => {
        console.warn("[SIP] ⚠️ Call failed:", e?.cause)
        recentOutboundCall = null
        currentSession = null
        updateCallInfo(null)
        updateStatus(ua?.isRegistered() ? "online" : "offline")
      })

      // For outbound calls (user initiated call to other), automatically answer the WebRTC leg immediately.
      // The user initiated the call, so they should NOT see the incoming call popup modal.
      if (isOutbound) {
        console.log("[SIP] ⚡ User-initiated outbound call: automatically answering WebRTC leg...")
        setTimeout(() => {
          if (currentSession === s) {
            answerIncomingCall()
          }
        }, 150)
      } else if (getAutoAnswer()) {
        console.log("[SIP] ⚡ Auto-answering incoming call (explicitly configured)...")
        setTimeout(() => {
          if (currentSession === s) {
            answerIncomingCall()
          }
        }, 400)
      } else {
        console.log("[SIP] 🔔 Ringing: Waiting for user to accept or decline incoming call in UI...")
      }
    })

    ua.start()
  } catch (err) {
    console.error("[SIP] Error starting JsSIP receiver:", err)
    updateStatus("offline")
  }
}

export function answerIncomingCall(): void {
  if (currentSession) {
    try {
      currentSession.answer({
        mediaConstraints: { audio: true, video: false },
        pcConfig: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      })
      console.log("[SIP] Answered incoming call")
    } catch (err) {
      console.error("[SIP] Error answering call:", err)
    }
  }
}

export function hangupCurrentCall(): void {
  recentOutboundCall = null
  if (currentSession) {
    try {
      currentSession.terminate()
      console.log("[SIP] Hung up / rejected call")
    } catch (e) {
      console.warn("[SIP] Hangup error:", e)
    }
    currentSession = null
  }
  updateCallInfo(null)
  const audioElement = document.getElementById("webrtc-sip-audio") as HTMLAudioElement
  if (audioElement) {
    audioElement.srcObject = null
  }
  updateStatus(ua?.isRegistered() ? "online" : "offline")
}

export function rejectIncomingCall(): void {
  hangupCurrentCall()
}

export function destroySIPClient(): void {
  try {
    if (currentSession) {
      try {
        currentSession.terminate()
      } catch {}
      currentSession = null
    }
    updateCallInfo(null)
    if (ua) {
      try {
        ua.unregister()
        ua.stop()
      } catch {}
      ua = null
    }
    const audioElement = document.getElementById("webrtc-sip-audio") as HTMLAudioElement
    if (audioElement) {
      audioElement.srcObject = null
    }
  } catch (e) {
    console.error("[SIP] Error destroying client:", e)
  }
  updateStatus("offline")
}

export function getSIPStatus(): SIPStatus {
  return currentStatus
}

export function reconnectSIPClient(): void {
  console.log("[SIP] Manual reconnect requested")
  destroySIPClient()
  setTimeout(() => {
    initSIPClient({ force: true })
  }, 100)
}

/**
 * Auto-tries all permutations of domain, ext, auth user, and password
 */
export async function autoTryPermutations(onProgress?: (msg: string) => void): Promise<boolean> {
  const passPlain = CONFIG.password || "Hospital@123"
  const passMd5   = "2ab76c1c2cb433a09dfe4a2a36e26905"

  const combos = [
    { domain: "ecallpbx.konnectcom.in", ext: "1048101", auth: "1048101", pwd: passPlain },
    { domain: "1048",                  ext: "101",     auth: "101",     pwd: passPlain },
    { domain: "1048",                  ext: "1048101", auth: "1048101", pwd: passPlain },
    { domain: "ecallpbx.konnectcom.in", ext: "101",     auth: "101",     pwd: passPlain },
    { domain: "ecallpbx.konnectcom.in", ext: "101",     auth: "1048101", pwd: passPlain },
    { domain: "74.225.89.85",          ext: "1048101", auth: "1048101", pwd: passPlain },
    { domain: "74.225.89.85",          ext: "101",     auth: "101",     pwd: passPlain },
    { domain: "1048.ecallpbx.konnectcom.in", ext: "101", auth: "101",   pwd: passPlain },
    { domain: "ecallpbx.konnectcom.in", ext: "1048101", auth: "1048101", pwd: passMd5 },
    { domain: "1048",                  ext: "101",     auth: "101",     pwd: passMd5 },
  ]

  for (const c of combos) {
    if (ua && ua.isRegistered()) return true

    onProgress?.(`Testing sip:${c.ext}@${c.domain} (auth: ${c.auth})...`)
    destroySIPClient()
    await new Promise((r) => setTimeout(r, 400))

    initSIPClient({
      force: true,
      customConfig: {
        sipDomain: c.domain,
        extNumber: c.ext,
        authNumber: c.auth,
        password: c.pwd,
      },
    })

    const registered = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 4000)
      const interval = setInterval(() => {
        if (ua && ua.isRegistered()) {
          clearInterval(interval)
          clearTimeout(timeout)
          resolve(true)
        }
      }, 150)
    })

    if (registered) {
      onProgress?.(`🎉 Connected! sip:${c.ext}@${c.domain}`)
      return true
    }
  }

  onProgress?.("All permutations tested.")
  return false
}
