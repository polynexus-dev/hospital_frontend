import type { ReactNode } from "react"

interface CardProps {
  children: ReactNode
  className?: string
  padded?: boolean
}

export function Card({ children, className = "", padded = false }: CardProps) {
  return (
    <div className={`bg-surface border border-border rounded-card ${padded ? "p-[13px]" : ""} ${className}`}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={`px-3.5 py-3 border-b border-border flex items-center gap-2 ${className}`}>
      {children}
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] tracking-[.08em] uppercase text-ink-4 font-semibold mb-2.5">{children}</div>
  )
}
