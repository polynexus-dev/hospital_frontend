import type { Tone } from "./tone"
import { toneBg } from "./tone"

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`text-[11.5px] font-semibold px-[7px] py-[2px] rounded-tag inline-block ${toneBg[tone]}`}>
      {children}
    </span>
  )
}

export function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`text-[10.5px] font-bold tracking-[.04em] px-[6px] py-[2px] rounded-tag inline-block shrink-0 ${toneBg[tone]}`}
    >
      {children}
    </span>
  )
}

export function NeutralTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-semibold px-[6px] py-[2px] rounded-tag bg-chip-bg text-chip-text inline-block">
      {children}
    </span>
  )
}

export function SuccessTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-semibold px-[6px] py-[2px] rounded-tag bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 inline-block">
      {children}
    </span>
  )
}

