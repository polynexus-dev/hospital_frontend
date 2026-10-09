import { useState, useEffect } from "react"
import {
  subscribeToCallInfo,
  answerIncomingCall,
  hangupCurrentCall,
  getAutoAnswer,
  setAutoAnswer,
  ensureMicrophoneAccess,
  type ActiveCallInfo,
} from "./sipClient"

export function IncomingCallReceiver() {
  const [callInfo, setCallInfo] = useState<ActiveCallInfo | null>(null)
  const [autoAnswer, setAutoAnswerState] = useState<boolean>(() => getAutoAnswer())
  const [callDuration, setCallDuration] = useState<number>(0)

  useEffect(() => {
    const unsub = subscribeToCallInfo((info) => {
      setCallInfo(info)
      if (info?.state === "connected") {
        setCallDuration(0)
      }
    })
    return unsub
  }, [])

  // Call duration counter
  useEffect(() => {
    if (callInfo?.state !== "connected") {
      setCallDuration(0)
      return
    }

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [callInfo?.state])

  const toggleAutoAnswer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked
    setAutoAnswerState(val)
    setAutoAnswer(val)
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  // Only display the incoming call UI modal for genuine incoming calls (direction === "inbound").
  // Do NOT display for calls to other (outbound / Click2Call), as the user initiated the call.
  if (!callInfo || callInfo.direction !== "inbound") {
    return null
  }

  const isRinging = callInfo.state === "ringing"
  const isConnected = callInfo.state === "connected"

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div
        className={`w-88 rounded-2xl shadow-2xl border p-5 backdrop-blur-md transition-all ${
          isRinging
            ? "bg-slate-900/95 border-amber-500/40 text-white ring-4 ring-amber-500/20"
            : "bg-slate-900/95 border-emerald-500/40 text-white ring-4 ring-emerald-500/20"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isRinging
                  ? "bg-amber-400 animate-ping"
                  : "bg-emerald-400 animate-pulse"
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {isRinging ? "Incoming Call…" : "Call in Progress"}
            </span>
          </div>

          {isConnected && (
            <span className="font-mono text-sm font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
              ⏱ {formatTimer(callDuration)}
            </span>
          )}
        </div>

        {/* Caller Info */}
        <div className="my-4 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-2xl mb-2 shadow-inner">
            {isRinging ? "📲" : "📞"}
          </div>
          <div className="text-lg font-bold font-mono tracking-tight text-white truncate px-2">
            {callInfo.callerDisplayName || callInfo.callerNumber}
          </div>
          {callInfo.callerDisplayName !== callInfo.callerNumber && (
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              {callInfo.callerNumber}
            </div>
          )}
          <div className="text-xs text-slate-300 font-medium mt-1">
            {isRinging
              ? "Do you want to receive this call?"
              : "Connected via WebRTC Bridge"}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 mt-4">
          {isRinging ? (
            <>
              <button
                type="button"
                onClick={() => {
                  ensureMicrophoneAccess()
                  answerIncomingCall()
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📞</span>
                <span>Receive Call</span>
              </button>

              <button
                type="button"
                onClick={() => hangupCurrentCall()}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>✕</span>
                <span>Decline Call</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => hangupCurrentCall()}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🔴</span>
              <span>End Call</span>
            </button>
          )}
        </div>

        {/* Options footer */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
            <input
              type="checkbox"
              checked={autoAnswer}
              onChange={toggleAutoAnswer}
              className="rounded accent-emerald-500 cursor-pointer"
            />
            <span>Auto-answer next time</span>
          </label>

          <span className="text-[10px] opacity-75">Ext 101</span>
        </div>
      </div>
    </div>
  )
}
