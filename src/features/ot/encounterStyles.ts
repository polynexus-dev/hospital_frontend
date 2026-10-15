import type { OTEncounter } from "../../types/api"

// OT board colour coding by encounter type (MedNet "colour by OPD / IPD / emergency").

export const ENCOUNTERS: Record<OTEncounter, { label: string; card: string; pill: string; dot: string }> = {
  opd: {
    label: "OPD / day care",
    card: "border-l-accent bg-accent-tint dark:bg-teal-950/40",
    pill: "bg-accent-tint text-accent-hover dark:bg-teal-900/50 dark:text-teal-200",
    dot: "bg-accent",
  },
  ipd: {
    label: "IPD",
    card: "border-l-brand bg-brand-tint dark:bg-indigo-950/40",
    pill: "bg-brand-tint text-brand-dark dark:bg-indigo-900/50 dark:text-indigo-200",
    dot: "bg-brand",
  },
  emergency: {
    label: "Emergency",
    card: "border-l-danger bg-danger-bg dark:bg-red-950/40",
    pill: "bg-danger-bg text-danger-text dark:bg-red-900/50 dark:text-red-200",
    dot: "bg-danger",
  },
}
