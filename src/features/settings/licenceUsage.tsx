import type { Tone } from "../../components/ui/tone"
import type { LicenseStatus } from "../../types/api"

/** Days-left wording and colour: amber from 60 days, red from 30. */
export function daysLeftInfo(data: LicenseStatus): { text: string; tone: Tone } | null {
  if (data.days_left === null || data.days_left === undefined) return null
  const d = data.days_left
  if (d < 0) return { text: `Expired ${-d} day${d === -1 ? "" : "s"} ago`, tone: "bad" }
  return { text: `${d} day${d === 1 ? "" : "s"} left`, tone: d <= 30 ? "bad" : d <= 60 ? "warn" : "ok" }
}

/** "34 of 50" with a bar; amber at 80 %, red at 95 % or over. */
export function UsageMeter({ label, used, limit }: { label: string; used?: number; limit?: number | null }) {
  if (used === undefined) return null
  const pct = limit ? Math.min(100, (used * 100) / limit) : 0
  const tone = !limit ? "bg-accent" : pct >= 95 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-success"
  return (
    <div className="py-2 border-b border-border-faint text-[13px]">
      <div className="flex justify-between">
        <span className="text-ink-4">{label}</span>
        <span className="font-semibold">{used}{limit ? ` of ${limit}` : " (no limit)"}</span>
      </div>
      {!!limit && (
        <div className="mt-1 h-1.5 rounded-tag bg-page overflow-hidden" role="meter" aria-label={label} aria-valuenow={used} aria-valuemax={limit}>
          <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {!!limit && pct >= 95 && <div className="text-[11.5px] text-danger-text mt-0.5">⚠ At the licence limit: contact Polynexus for a larger licence.</div>}
      {!!limit && pct >= 80 && pct < 95 && <div className="text-[11.5px] text-warning-text mt-0.5">⚠ Nearly at the licence limit.</div>}
    </div>
  )
}
