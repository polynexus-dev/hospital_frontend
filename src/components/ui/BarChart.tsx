interface Bar {
  label: string
  value: number
  color?: string
}

export function BarChart({
  data,
  height = 160,
  color = "var(--color-brand)",
  formatValue = (n: number) => String(n),
  gridlines = 4,
}: {
  data: Bar[]
  height?: number
  color?: string
  formatValue?: (n: number) => string
  gridlines?: number
}) {
  if (data.length === 0) {
    return <div className="text-[13px] text-ink-4">No data yet.</div>
  }

  const rawMax = Math.max(0, ...data.map((d) => d.value))
  if (rawMax === 0) {
    return <div className="text-[13px] text-ink-4">No data recorded yet.</div>
  }

  const max = rawMax
  const steps = Array.from({ length: gridlines + 1 }, (_, i) => (max / gridlines) * (gridlines - i))

  return (
    <div className="flex gap-3" style={{ height }}>
      <div className="flex flex-col justify-between text-right text-[10.5px] text-ink-4 pb-[22px] pt-1 shrink-0">
        {steps.map((s, i) => (
          <div key={i}>{formatValue(s)}</div>
        ))}
      </div>
      <div className="flex-1 flex items-end gap-3 border-l border-b border-border-soft pl-2">
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full min-w-0 gap-1.5">
            <div className="text-[11px] font-semibold text-ink-3">{d.value > 0 ? formatValue(d.value) : ""}</div>
            <div
              className="w-full max-w-[38px] rounded-t-[3px]"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 3 : 0, background: d.color ?? color }}
            />
            <div className="text-[11px] text-ink-4 truncate max-w-full pb-1" title={d.label}>
              {d.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
