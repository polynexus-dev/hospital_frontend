// Page controls for a DRF paginated list: "26–50 of 765" with prev/next.
export const PAGE_SIZE = 25

export function Pager({ page, count, onPage, pageSize = PAGE_SIZE }: { page: number; count: number; onPage: (p: number) => void; pageSize?: number }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (count <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, count)
  const btn = "px-3 py-1 rounded-control bg-chip-bg dark:bg-slate-700 text-ink-2 dark:text-slate-200 disabled:opacity-40"
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <button className={btn} disabled={page <= 1} onClick={() => onPage(1)} aria-label="First page">«</button>
      <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button>
      <span className="text-ink-4 dark:text-slate-400 tabular-nums">
        {from}–{to} of {count} · page {page} / {pages}
      </span>
      <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">›</button>
      <button className={btn} disabled={page >= pages} onClick={() => onPage(pages)} aria-label="Last page">»</button>
    </div>
  )
}
