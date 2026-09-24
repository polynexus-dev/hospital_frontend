import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { api } from "../../api/client"

interface Board {
  service_point: string
  counter: string
  now_serving: { label: string; counter: string } | null
  waiting: string[]
  waiting_count: number
  estimated_minutes: number
}

/** Public TV / kiosk screen (AAC.2.h/i). Token numbers only — no patient names. Polls every 5 s and chimes on a new call. */
export function QueueDisplayBoard() {
  const { key } = useParams()
  const [data, setData] = useState<{ display: string; hospital: string; announcement: string; boards: Board[] } | null>(null)
  const [error, setError] = useState(false)
  const lastCalls = useRef<string>("")

  useEffect(() => {
    let alive = true
    const load = () =>
      api
        .get<any>(`/queue/public/board/${key}/`, { skipAuth: true })
        .then((d) => {
          if (!alive) return
          const calls = d.boards.map((b: Board) => b.now_serving?.label ?? "").join("|")
          if (lastCalls.current && calls !== lastCalls.current) {
            try {
              const ctx = new AudioContext()
              const o = ctx.createOscillator()
              o.frequency.value = 880
              o.connect(ctx.destination)
              o.start()
              o.stop(ctx.currentTime + 0.35)
            } catch {
              // audio may be blocked until first interaction
            }
          }
          lastCalls.current = calls
          setData(d)
          setError(false)
        })
        .catch(() => alive && setError(true))
    load()
    const t = window.setInterval(load, 5000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [key])

  if (error && !data) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-2xl">Display not found</div>
  if (!data) return <div className="min-h-screen bg-slate-900" />
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col">
      <div className="flex justify-between items-baseline mb-6">
        <h1 className="text-4xl font-bold">{data.hospital}</h1>
        <div className="text-2xl text-slate-300">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div className="grid gap-6 flex-1" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(data.boards.length, 1), 3)}, minmax(0, 1fr))` }}>
        {data.boards.map((b) => (
          <div key={b.service_point} className="bg-slate-800 rounded-3xl p-6 flex flex-col">
            <div className="text-2xl font-semibold text-slate-300">{b.service_point}</div>
            <div className="text-sm text-slate-400 mb-4">{b.counter}</div>
            <div className="text-sm uppercase tracking-widest text-emerald-400">Now serving</div>
            <div className="text-8xl font-black text-emerald-300 my-2">{b.now_serving?.label ?? "—"}</div>
            <div className="text-sm uppercase tracking-widest text-slate-400 mt-4">Next</div>
            <div className="flex flex-wrap gap-3 mt-2 text-3xl font-bold">
              {b.waiting.length ? b.waiting.map((w) => <span key={w} className="bg-slate-700 rounded-xl px-3 py-1">{w}</span>) : <span className="text-slate-500 text-xl">No one waiting</span>}
            </div>
            <div className="mt-auto pt-6 text-xl text-amber-300">≈ {b.estimated_minutes} min wait · {b.waiting_count} in queue</div>
          </div>
        ))}
      </div>
      {data.announcement && <div className="mt-6 text-2xl bg-amber-400 text-slate-900 rounded-xl px-6 py-3 font-semibold overflow-hidden whitespace-nowrap">{data.announcement}</div>}
    </div>
  )
}
