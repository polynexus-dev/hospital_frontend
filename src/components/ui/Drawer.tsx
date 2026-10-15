import { useEffect, useRef, type ReactNode } from "react"

// Right-hand slide-over for viewing one record without leaving the list.
// z-40 so the existing z-50 modals (Pay, Add item, …) open on top of it.
export function Drawer({
  title,
  subtitle,
  badges,
  actions,
  onClose,
  children,
  wide = false,
}: {
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // leave Escape to a modal opened on top of the drawer
      if (e.key === "Escape" && !document.querySelector(".fixed.inset-0.z-50")) onClose()
    }
    document.addEventListener("keydown", onKey)
    panelRef.current?.focus()
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`relative h-full w-full ${wide ? "max-w-4xl" : "max-w-2xl"} bg-surface dark:bg-slate-900 shadow-2xl border-l border-border dark:border-slate-700 flex flex-col outline-none`}
      >
        <div className="px-5 pt-4 pb-3 border-b border-border dark:border-slate-700 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-ink dark:text-slate-100 break-words">{title}</h2>
              {subtitle && <div className="text-sm text-ink-4 dark:text-slate-400">{subtitle}</div>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 w-8 h-8 rounded-control text-ink-4 hover:bg-page dark:hover:bg-slate-800 text-xl leading-none"
            >
              ×
            </button>
          </div>
          {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
          {actions && <div className="flex flex-wrap gap-1.5 pt-1">{actions}</div>}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">{children}</div>
      </div>
    </div>
  )
}

export function DrawerSection({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-4 dark:text-slate-400">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}
