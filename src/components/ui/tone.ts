export type Tone = "ok" | "warn" | "bad" | "info" | "neutral"

export const toneBg: Record<Tone, string> = {
  ok: "bg-success-bg text-success-text",
  warn: "bg-warning-bg text-warning-text",
  bad: "bg-danger-bg text-danger-text",
  info: "bg-brand-tint text-brand",
  neutral: "bg-chip-bg text-chip-text",
}

export const toneDot: Record<Tone, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-danger",
  info: "bg-brand",
  neutral: "bg-border-strong",
}
