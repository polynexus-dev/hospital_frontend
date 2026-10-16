import { useEffect } from "react"
import { useAuthStore } from "../store/auth"

// When a SaaS admin switches on "Block inspect" for a hospital (SaaS console →
// hospital row), its staff can't open the context menu, browser devtools
// shortcuts or view-source. A deterrent only: a determined user can still open
// devtools from the browser menu, which is why API traffic is encrypted
// (PayloadEncryptionMiddleware) rather than relying on this. Never applies to
// SaaS staff, who need devtools to support hospitals.

function isInspectShortcut(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase()
  if (key === "f12") return true
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.shiftKey && ["i", "j", "c", "k"].includes(key)) return true // devtools panels (Ctrl+Shift / Cmd+Opt)
  if (e.metaKey && e.altKey && ["i", "j", "c", "u"].includes(key)) return true // macOS
  if (mod && (key === "u" || key === "s")) return true // view source, save page
  return false
}

export function DevtoolsGuard() {
  const user = useAuthStore((s) => s.user)
  const active = Boolean(user?.hospital_block_devtools) && !user?.is_saas_admin

  useEffect(() => {
    if (!active) return
    const blockMenu = (e: MouseEvent) => e.preventDefault()
    const blockKeys = (e: KeyboardEvent) => {
      if (isInspectShortcut(e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener("contextmenu", blockMenu, true)
    window.addEventListener("keydown", blockKeys, true)
    return () => {
      window.removeEventListener("contextmenu", blockMenu, true)
      window.removeEventListener("keydown", blockKeys, true)
    }
  }, [active])

  return null
}
