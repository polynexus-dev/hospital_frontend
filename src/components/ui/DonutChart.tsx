interface DonutSlice {
  label: string
  value: number
  color: string
}

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  size = 168,
  thickness = 22,
}: {
  data: DonutSlice[]
  centerLabel?: string
  centerValue?: string | number
  size?: number
  thickness?: number
}) {
  const radius = 50 - thickness / 2
  const circumference = 2 * Math.PI * radius
  const total = data.reduce((sum, d) => sum + d.value, 0)

  let cumulative = 0
  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const fraction = total > 0 ? d.value / total : 0
      const dash = fraction * circumference
      const offset = -cumulative * circumference
      cumulative += fraction
      return { ...d, dash, offset }
    })

  return (
    <div className="flex flex-col items-center gap-3.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-border-soft)" strokeWidth={thickness} />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        {(centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && <div className="text-[22px] font-semibold tracking-[-.02em]">{centerValue}</div>}
            {centerLabel && <div className="text-[11px] text-ink-4 font-semibold">{centerLabel}</div>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5 text-[12.5px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="font-semibold">{d.value}</span>
            <span className="text-ink-4">{d.label}</span>
          </div>
        ))}
        {data.length === 0 && <div className="text-[13px] text-ink-4">No data yet.</div>}
      </div>
    </div>
  )
}
