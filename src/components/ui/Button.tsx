import type { ButtonHTMLAttributes } from "react"

// primary: the product's colour (navy in HMS and admin, teal in CRM) — Save/Apply.
// action: coral, for patient-facing CRM actions only (Book, Call back, Send);
//   never on admin screens, so "Save" never competes with "Book".
// danger: real destructive actions, always behind a confirmation step.
type Variant = "primary" | "action" | "secondary" | "danger" | "ghost"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: "sm" | "md"
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand text-white border border-brand hover:bg-brand-hover",
  secondary: "bg-surface text-ink-3 border border-border-strong hover:bg-page",
  action: "bg-action text-white border border-action hover:bg-action-hover",
  danger: "bg-danger text-white border border-danger hover:bg-[#931c13]",
  ghost: "bg-transparent text-brand border border-border-strong hover:bg-brand-tint hover:border-brand",
}

const sizeClasses = {
  sm: "h-[27px] px-[10px] text-[12px]",
  md: "h-[32px] px-[13px] text-[12.5px]",
}

export function Button({ variant = "secondary", size = "md", className = "", ...rest }: ButtonProps) {
  return (
    <button
      className={`rounded-control font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    />
  )
}
