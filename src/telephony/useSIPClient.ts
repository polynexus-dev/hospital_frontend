import { useEffect, useState } from "react"
import {
  initSIPClient,
  reconnectSIPClient,
  hangupCurrentCall,
  getSIPStatus,
  autoTryPermutations,
  ensureMicrophoneAccess,
  type SIPStatus,
} from "./sipClient"

/**
 * useSIPClient — React hook that connects to the WebRTC SIP client,
 * keeps current registration status in sync, and provides call control actions.
 */
export function useSIPClient() {
  const [sipStatus, setSipStatus] = useState<SIPStatus>(() => getSIPStatus())
  const [autoTryStatus, setAutoTryStatus] = useState<string | null>(null)

  useEffect(() => {
    initSIPClient({
      onStatusChange: setSipStatus,
      onCallBridged: () => {
        console.log("[SIP] Bridge connected — patient is ringing")
      },
    })

    return () => {
      // Don't fully destroy UA on every route change, only if entire app unmounts
    }
  }, [])

  const runAutoDetect = async () => {
    setAutoTryStatus("Detecting…")
    const ok = await autoTryPermutations((msg) => setAutoTryStatus(msg))
    if (!ok) {
      setTimeout(() => setAutoTryStatus(null), 5000)
    }
    return ok
  }

  return {
    sipStatus,
    isOnCall: sipStatus === "busy",
    hangup: hangupCurrentCall,
    reconnect: reconnectSIPClient,
    autoDetect: runAutoDetect,
    autoTryStatus,
    testMic: ensureMicrophoneAccess,
  }
}
