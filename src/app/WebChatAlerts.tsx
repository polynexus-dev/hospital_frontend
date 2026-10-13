import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation, useNavigate } from "react-router-dom"
import { api } from "../api/client"
import { useAuthStore } from "../store/auth"

interface ChatAlert {
  thread: number
  name: string
  unread: number
  last_message_id: number
  preview: string
  at: string
}

const SOUND_KEY = "pnx_chat_sound"
const POLL_MS = 10_000
const CARD_MS = 20_000

function soundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off"
  } catch {
    return true
  }
}

/** Two short tones, made with Web Audio (no sound file to ship). Browsers
 *  only allow it after the user has clicked somewhere on the page. */
function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[[880, 0], [1175, 0.16]].forEach(([freq, start]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + 0.32)
    })
    setTimeout(() => void ctx.close(), 800)
  } catch {
    /* audio blocked or unavailable */
  }
}

/** App-wide alert for new website chats: chime, pop-up card with Open, a
 *  desktop notification when the tab is in the background, and the unread
 *  count in the tab title. For staff with Inbox access. */
export function WebChatAlerts() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const modules = user?.hospital_enabled_modules ?? []
  const allowed = !!user?.hospital && (modules.length === 0 || modules.includes("inbox")) && (user.permissions ?? []).includes("communications.view_thread")

  const alerts = useQuery({
    queryKey: ["web-chat-alerts"],
    queryFn: () => api.get<{ unread_chats: number; chats: ChatAlert[] }>("/threads/web-chat-alerts/"),
    enabled: allowed,
    retry: false,
    refetchInterval: (q) => (q.state.status === "error" ? false : POLL_MS),
    refetchIntervalInBackground: true,
  })

  const seen = useRef<Map<number, number> | null>(null)
  const [cards, setCards] = useState<ChatAlert[]>([])
  const [sound, setSound] = useState(soundOn)
  const [notifyPermission, setNotifyPermission] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission)

  const viewingChats = location.pathname.startsWith("/inbox") && new URLSearchParams(location.search).get("tab") === "webchat"

  useEffect(() => {
    const data = alerts.data
    if (!data) return
    if (seen.current === null) {
      // First load after sign-in: remember what's already waiting, don't ring for it.
      seen.current = new Map(data.chats.map((c) => [c.thread, c.last_message_id]))
      return
    }
    const fresh = data.chats.filter((c) => c.last_message_id > (seen.current!.get(c.thread) ?? 0))
    data.chats.forEach((c) => seen.current!.set(c.thread, c.last_message_id))
    if (fresh.length === 0) return
    if (sound) playChime()
    if (!viewingChats) setCards((prev) => [...fresh, ...prev.filter((p) => !fresh.some((f) => f.thread === p.thread))].slice(0, 3))
    if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
      fresh.forEach((c) => {
        const n = new Notification(`New website chat: ${c.name}`, { body: c.preview, tag: `webchat-${c.thread}` })
        n.onclick = () => {
          window.focus()
          navigate(`/inbox?tab=webchat&thread=${c.thread}`)
          n.close()
        }
      })
    }
  }, [alerts.data, sound, viewingChats, navigate])

  // Unread website chats in the tab title, e.g. "(2) Hospital CRM".
  const unread = alerts.data?.unread_chats ?? 0
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s/, "")
    document.title = unread > 0 ? `(${unread}) ${base}` : base
  }, [unread, location.pathname])

  useEffect(() => {
    if (cards.length === 0) return
    const t = setTimeout(() => setCards((c) => c.slice(0, -1)), CARD_MS)
    return () => clearTimeout(t)
  }, [cards])

  if (!allowed || cards.length === 0) return null

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off")
    } catch {
      /* storage blocked */
    }
  }

  return (
    <div className="fixed left-4 bottom-4 z-[60] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-32px)]" role="region" aria-label="New website chats">
      {cards.map((c) => (
        <div key={c.thread} role="alert" className="bg-surface border border-border-strong rounded-xl shadow-xl p-3 text-[13px]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold">🌐 New website chat: {c.name}</div>
              <div className="text-ink-3 truncate">{c.preview}</div>
            </div>
            <button type="button" aria-label="Dismiss" className="text-ink-4" onClick={() => setCards((all) => all.filter((x) => x.thread !== c.thread))}>✕</button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              className="px-3 py-1 rounded-md bg-brand text-white text-[12.5px] font-semibold"
              onClick={() => {
                setCards((all) => all.filter((x) => x.thread !== c.thread))
                navigate(`/inbox?tab=webchat&thread=${c.thread}`)
              }}
            >
              Open
            </button>
            <button type="button" className="text-[12px] text-ink-4 underline" onClick={toggleSound}>{sound ? "Mute sound" : "Turn sound on"}</button>
            {notifyPermission === "default" && (
              <button type="button" className="text-[12px] text-ink-4 underline" onClick={() => void Notification.requestPermission().then(setNotifyPermission)}>
                Desktop alerts
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
