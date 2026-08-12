import { Card } from "./Card"

interface StatTileProps {
  label: string
  value: string | number
  sub?: string
  valueClassName?: string
}

export function StatTile({ label, value, sub, valueClassName = "" }: StatTileProps) {
  return (
    <Card padded>
      <div className="text-[11.5px] text-ink-4 font-semibold">{label}</div>
      <div className={`text-[27px] font-semibold tracking-[-.02em] mt-1 ${valueClassName}`}>{value}</div>
      {sub && <div className="text-[11.5px] text-ink-4">{sub}</div>}
    </Card>
  )
}
