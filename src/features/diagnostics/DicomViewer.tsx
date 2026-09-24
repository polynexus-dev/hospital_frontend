import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { api, extractApiError } from "../../api/client"

// Built-in study viewer (NABH IMS.1.g). The server decodes DICOM and renders
// each frame to PNG with the requested window/level, so this stays a thin
// client: stack scrolling, window/level drag, zoom/pan, invert, distance
// measurement in millimetres, and CT presets. Codecs the server can't decode
// fall back to the external PACS viewer link.

interface ViewerImage {
  id: number
  is_dicom: boolean
  url: string
  rows?: number
  columns?: number
  frames?: number
  window_center?: number | null
  window_width?: number | null
  pixel_spacing_mm?: [number, number] | null
  instance_number?: number
  supported?: boolean
  unsupported_reason?: string
  modality?: string
}
interface Series { series_instance_uid: string; description: string; number: number; modality: string; images: ViewerImage[] }
interface Study { viewer_url: string; study_instance_uid: string; series: Series[] }

type Tool = "window" | "pan" | "measure"

const CT_PRESETS: [string, number, number][] = [
  ["Brain", 40, 80], ["Subdural", 75, 215], ["Stroke", 40, 40], ["Lung", -600, 1500], ["Mediastinum", 50, 350],
  ["Abdomen", 40, 400], ["Liver", 60, 160], ["Bone", 400, 1800],
]
const CACHE_LIMIT = 150

export function DicomViewer() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [study, setStudy] = useState<Study | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seriesIdx, setSeriesIdx] = useState(0)
  const [imageIdx, setImageIdx] = useState(0)
  const [frame, setFrame] = useState(0)
  const [win, setWin] = useState<{ c: number; w: number } | null>(null)
  const [invert, setInvert] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [tool, setTool] = useState<Tool>("window")
  const [points, setPoints] = useState<{ x: number; y: number }[]>([])
  const [src, setSrc] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const cache = useRef(new Map<string, string>())
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number; c: number; w: number; px: number; py: number } | null>(null)

  useEffect(() => {
    api.get<Study>(`/radiology/orders/${orderId}/viewer/`).then(setStudy).catch((e) => setError(extractApiError(e)))
  }, [orderId])

  const series = study?.series[seriesIdx]
  const image = series?.images[imageIdx]
  const frames = image?.frames ?? 1
  const isCT = (image?.modality || series?.modality || "").toUpperCase() === "CT"

  // New series/image → reset window to the image's own values.
  useEffect(() => {
    if (!image) return
    setFrame(0)
    setPoints([])
    if (image.window_center != null && image.window_width) setWin((w) => w ?? { c: image.window_center!, w: image.window_width! })
  }, [image])

  const renderUrl = useCallback(
    (img: ViewerImage, f: number) => {
      const q = new URLSearchParams({ frame: String(f), invert: invert ? "1" : "0" })
      if (win) {
        q.set("wc", String(Math.round(win.c)))
        q.set("ww", String(Math.max(1, Math.round(win.w))))
      }
      return `/radiology/orders/${orderId}/images/${img.id}/render/?${q}`
    },
    [orderId, win, invert],
  )

  const fetchPng = useCallback(async (url: string) => {
    const hit = cache.current.get(url)
    if (hit) return hit
    const objectUrl = URL.createObjectURL(await api.getBlob(url))
    cache.current.set(url, objectUrl)
    if (cache.current.size > CACHE_LIMIT) {
      const [oldest, old] = cache.current.entries().next().value as [string, string]
      URL.revokeObjectURL(old)
      cache.current.delete(oldest)
    }
    return objectUrl
  }, [])

  // Render the current frame (debounced while dragging the window), prefetch neighbours.
  useEffect(() => {
    if (!image) return
    if (!image.is_dicom) {
      setSrc(image.url)
      return
    }
    if (image.supported === false) {
      setSrc(null)
      setRenderError(image.unsupported_reason || "This image can't be shown in the built-in viewer.")
      return
    }
    let cancelled = false
    const t = window.setTimeout(async () => {
      try {
        const url = await fetchPng(renderUrl(image, frame))
        if (!cancelled) {
          setSrc(url)
          setRenderError(null)
        }
        const next = series?.images[imageIdx + 1]
        if (next?.is_dicom && next.supported !== false) fetchPng(renderUrl(next, 0)).catch(() => undefined)
      } catch (e) {
        if (!cancelled) setRenderError(extractApiError(e))
      }
    }, drag.current ? 120 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [image, frame, renderUrl, fetchPng, series, imageIdx])

  useEffect(() => () => cache.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const step = useCallback(
    (d: number) => {
      if (!series) return
      if (frames > 1) setFrame((f) => Math.min(frames - 1, Math.max(0, f + d)))
      else setImageIdx((i) => Math.min(series.images.length - 1, Math.max(0, i + d)))
    },
    [series, frames],
  )

  const reset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setInvert(false)
    setPoints([])
    setWin(image?.window_center != null && image?.window_width ? { c: image.window_center, w: image.window_width } : null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return
      if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1)
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1)
      else if (e.key === "i") setInvert((v) => !v)
      else if (e.key === "r") reset()
      else if (e.key === "Escape") setPoints([])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // Image-pixel coordinates of a mouse event.
  const toImage = (e: React.MouseEvent) => {
    const el = imgRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * el.naturalWidth, y: ((e.clientY - r.top) / r.height) * el.naturalHeight }
  }

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    if (tool === "measure") {
      const p = toImage(e)
      if (p) setPoints((pts) => (pts.length >= 2 ? [p] : [...pts, p]))
      return
    }
    drag.current = { x: e.clientX, y: e.clientY, c: win?.c ?? image?.window_center ?? 40, w: win?.w ?? image?.window_width ?? 400, px: pan.x, py: pan.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (tool === "pan") setPan({ x: d.px + dx, y: d.py + dy })
    else setWin({ c: d.c + dy * (d.w / 256), w: Math.max(1, d.w + dx * (d.w / 256)) })
  }
  const onMouseUp = () => {
    drag.current = null
  }
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) setZoom((z) => Math.min(8, Math.max(0.25, z * (e.deltaY < 0 ? 1.1 : 0.9))))
    else step(e.deltaY > 0 ? 1 : -1)
  }

  const measurement = useMemo(() => {
    if (points.length !== 2) return null
    const [a, b] = points
    const sp = image?.pixel_spacing_mm
    const dxmm = (b.x - a.x) * (sp ? sp[1] : 1)
    const dymm = (b.y - a.y) * (sp ? sp[0] : 1)
    return { text: sp ? `${Math.hypot(dxmm, dymm).toFixed(1)} mm` : `${Math.hypot(b.x - a.x, b.y - a.y).toFixed(0)} px`, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }, [points, image])

  if (error) return <div className="p-6 text-rose-700">{error}</div>
  if (!study) return <div className="p-6 text-slate-500">Loading study…</div>
  if (!study.series.length) return <div className="p-6 text-slate-500">No images have been uploaded for this study yet.</div>

  const btn = (active: boolean) => `px-2.5 py-1 rounded text-xs font-semibold ${active ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"}`
  const natural = imgRef.current ? { w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight } : null

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-slate-950 text-slate-200 select-none">
      <aside className="w-44 shrink-0 overflow-y-auto border-r border-slate-800 p-2 space-y-2">
        <button onClick={() => navigate(-1)} className="text-xs text-emerald-400">← Back</button>
        {study.series.map((s, i) => (
          <button key={s.series_instance_uid} onClick={() => { setSeriesIdx(i); setImageIdx(0); setWin(null) }}
            className={`w-full text-left rounded p-2 text-xs ${i === seriesIdx ? "bg-slate-800 ring-1 ring-emerald-500" : "bg-slate-900 hover:bg-slate-800"}`}>
            <div className="font-semibold">{s.modality || "—"} {s.number ? `#${s.number}` : ""}</div>
            <div className="text-slate-400 truncate">{s.description || "Series"}</div>
            <div className="text-slate-500">{s.images.length} image{s.images.length === 1 ? "" : "s"}</div>
          </button>
        ))}
        {study.viewer_url && <a href={study.viewer_url} target="_blank" rel="noopener" className="block text-xs text-sky-400 pt-2">Open in PACS viewer ↗</a>}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 p-2 border-b border-slate-800">
          <button className={btn(tool === "window")} onClick={() => setTool("window")} title="Drag: left/right = width, up/down = level">Window</button>
          <button className={btn(tool === "pan")} onClick={() => setTool("pan")}>Pan</button>
          <button className={btn(tool === "measure")} onClick={() => { setTool("measure"); setPoints([]) }}>Measure</button>
          <button className={btn(invert)} onClick={() => setInvert((v) => !v)}>Invert</button>
          <button className={btn(false)} onClick={() => setZoom((z) => Math.min(8, z * 1.25))}>＋</button>
          <button className={btn(false)} onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}>－</button>
          <button className={btn(false)} onClick={reset}>Reset</button>
          {isCT && (
            <select className="bg-slate-800 text-xs rounded px-2 py-1" value="" onChange={(e) => {
              const p = CT_PRESETS.find(([n]) => n === e.target.value)
              if (p) setWin({ c: p[1], w: p[2] })
            }}>
              <option value="">CT preset…</option>
              {CT_PRESETS.map(([n, c, w]) => <option key={n} value={n}>{n} ({c}/{w})</option>)}
            </select>
          )}
          <span className="ml-auto text-[11px] text-slate-500">Wheel: next image · Ctrl+wheel: zoom · ↑↓ · I invert · R reset</span>
        </div>
        <div className="relative flex-1 overflow-hidden" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
          style={{ cursor: tool === "pan" ? "grab" : tool === "measure" ? "crosshair" : "ns-resize" }}>
          {renderError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-400 p-6 text-center">
              <div>{renderError}</div>
              {study.viewer_url && <a href={study.viewer_url} target="_blank" rel="noopener" className="text-sky-400">Open in PACS viewer ↗</a>}
            </div>
          ) : src ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
                <img ref={imgRef} src={src} alt="" draggable={false} className="max-h-[calc(100vh-9rem)] max-w-full object-contain" style={{ imageRendering: zoom > 2 ? "pixelated" : "auto" }} />
                {natural && points.length > 0 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${natural.w} ${natural.h}`} preserveAspectRatio="none">
                    {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={Math.max(1.5, natural.w / 200)} fill="#facc15" />)}
                    {points.length === 2 && <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#facc15" strokeWidth={Math.max(1, natural.w / 400)} />}
                    {measurement && <text x={measurement.mid.x} y={measurement.mid.y - natural.h / 60} fill="#facc15" fontSize={Math.max(8, natural.w / 30)} textAnchor="middle">{measurement.text}</text>}
                  </svg>
                )}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">Rendering…</div>
          )}
          <div className="absolute left-3 top-3 text-[11px] leading-5 text-slate-300 pointer-events-none">
            <div>{series?.modality} {series?.description}</div>
            <div>Image {imageIdx + 1} / {series?.images.length}{frames > 1 ? ` · frame ${frame + 1} / ${frames}` : ""}</div>
            {image?.rows && <div>{image.columns} × {image.rows}{image.pixel_spacing_mm ? ` · ${image.pixel_spacing_mm[0]} mm/px` : ""}</div>}
          </div>
          <div className="absolute right-3 top-3 text-[11px] leading-5 text-slate-300 text-right pointer-events-none">
            {win && <div>W {Math.round(win.w)} · L {Math.round(win.c)}</div>}
            <div>Zoom {Math.round(zoom * 100)}%</div>
            {measurement && <div className="text-yellow-300">{measurement.text}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
