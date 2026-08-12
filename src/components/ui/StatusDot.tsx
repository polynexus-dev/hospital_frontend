import type { Tone } from "./tone"
import { toneDot } from "./tone"

export function StatusDot({ tone, pulse = false }: { tone: Tone; pulse?: boolean }) {
  return (
    <div
      className={`w-[7px] h-[7px] rounded-full shrink-0 ${toneDot[tone]} ${pulse ? "animate-livepulse" : ""}`}
    />
  )
}
