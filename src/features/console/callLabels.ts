export const LEAD_CLASS: Record<string, { label: string; cls: string }> = {
  hot: { label: "Hot lead", cls: "bg-danger-bg text-danger-text" },
  warm: { label: "Warm lead", cls: "bg-warning-bg text-warning-text" },
  cold: { label: "Cold", cls: "bg-chip-bg text-chip-text" },
  not_a_lead: { label: "Not a lead", cls: "bg-chip-bg text-ink-4" },
}

export const MISSED_OPPORTUNITY: Record<string, string> = {
  unreturned: "Never called back",
  not_booked: "Wanted to book, didn't",
}
