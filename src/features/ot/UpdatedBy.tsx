/** "Updated by … on …" footer for OT records (MedNet M2.22: updated-by on every OT screen). */
export function UpdatedBy({ name, at, className = "" }: { name?: string | null; at?: string | null; className?: string }) {
  if (!name && !at) return null
  return (
    <div className={`text-[11px] text-ink-5 ${className}`}>
      Updated by {name || "—"}{at ? ` · ${new Date(at).toLocaleString()}` : ""}
    </div>
  )
}
