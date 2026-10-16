import { useEffect, useId, useRef, useState } from "react"

export interface SearchOption {
  value: number
  label: string
  hint?: string
}

/**
 * Type-to-search picker for long lists (patients, doctors) instead of a plain
 * <select>. Give `options` to filter locally, or `search` to ask the server
 * (debounced). ↑/↓ move, Enter picks, Esc closes.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  search,
  selectedLabel,
  placeholder = "Type to search…",
  emptyText = "No matches",
  ariaLabel,
}: {
  value: number
  onChange: (value: number, option: SearchOption | null) => void
  options?: SearchOption[]
  search?: (query: string) => Promise<SearchOption[]>
  /** label of the current value when it isn't in `options` (e.g. a patient picked earlier) */
  selectedLabel?: string
  placeholder?: string
  emptyText?: string
  ariaLabel?: string
}) {
  const listId = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [remote, setRemote] = useState<SearchOption[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<SearchOption | null>(null)

  // server search, debounced
  useEffect(() => {
    if (!search || !open) return
    let live = true
    setLoading(true)
    const t = window.setTimeout(() => {
      search(query.trim())
        .then((rows) => live && setRemote(rows))
        .catch(() => live && setRemote([]))
        .finally(() => live && setLoading(false))
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [query, open, search])

  // close on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const q = query.trim().toLowerCase()
  const shown = search
    ? remote
    : (options ?? []).filter((o) => !q || o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q)).slice(0, 50)

  const current = value ? options?.find((o) => o.value === value) ?? (picked?.value === value ? picked : null) : null
  const currentLabel = current?.label ?? (value ? selectedLabel : "")

  const choose = (o: SearchOption | null) => {
    setPicked(o)
    onChange(o?.value ?? 0, o)
    setQuery("")
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-1 w-full h-9 px-3 border border-border-strong rounded-control bg-surface focus-within:border-brand">
        <span className="text-ink-5 text-[12px]" aria-hidden="true">🔍</span>
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none"
          placeholder={currentLabel || placeholder}
          value={open ? query : currentLabel || ""}
          onFocus={() => {
            setOpen(true)
            setActive(0)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setOpen(true)
              setActive((a) => Math.min(a + 1, shown.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === "Enter" && open && shown[active]) {
              e.preventDefault()
              choose(shown[active])
            } else if (e.key === "Escape") {
              setOpen(false)
            }
          }}
        />
        {value > 0 && (
          <button type="button" aria-label="Clear" className="text-ink-4 hover:text-ink text-base leading-none px-1" onClick={() => choose(null)}>
            ×
          </button>
        )}
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-control border border-border bg-surface shadow-lg">
          {loading && <li className="px-3 py-2 text-[12px] text-ink-4">Searching…</li>}
          {!loading && shown.length === 0 && <li className="px-3 py-2 text-[12px] text-ink-4">{emptyText}</li>}
          {!loading &&
            shown.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(o)
                }}
                onMouseEnter={() => setActive(i)}
                className={`px-3 py-2 cursor-pointer text-[13px] ${i === active ? "bg-brand-tint" : ""} ${o.value === value ? "font-semibold" : ""}`}
              >
                <div className="text-ink">{o.label}</div>
                {o.hint && <div className="text-[11px] text-ink-4">{o.hint}</div>}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
