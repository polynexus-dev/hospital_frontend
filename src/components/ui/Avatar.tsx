function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-full bg-brand-tint text-brand font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(name)}
    </div>
  )
}

export function AvatarSquare({ name, size = 46 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-[6px] bg-brand-tint text-brand font-bold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.33 }}
    >
      {initials(name)}
    </div>
  )
}
