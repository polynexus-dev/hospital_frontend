import { useEffect, type RefObject } from "react"

/** A page with a bottom action bar (Save / Register...) registers it here.
 *  Its height goes into the --action-bar-h CSS variable, and every floating
 *  element (Quick Actions, assistant, call pop-up, toasts, chat alerts) sits
 *  that much higher, so nothing covers the page's buttons. */
export function useBottomActionBar(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const update = () => root.style.setProperty("--action-bar-h", `${Math.ceil(el.getBoundingClientRect().height)}px`)
    update()
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.setProperty("--action-bar-h", "0px")
    }
  }, [ref])
}
