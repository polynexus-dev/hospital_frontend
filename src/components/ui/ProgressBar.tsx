export function ProgressBar({ pct, color = "var(--color-brand)", height = 6 }: { pct: number; color?: string; height?: number }) {
  return (
    <div className="bg-page rounded-tag overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-tag"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  )
}
