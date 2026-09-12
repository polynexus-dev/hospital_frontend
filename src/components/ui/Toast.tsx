export function showToast(message: string, type: "success" | "error" | "info" = "info") {
  if (typeof window === "undefined") return

  // Create or reuse floating toast container
  let container = document.getElementById("hospital-toast-container")
  if (!container) {
    container = document.createElement("div")
    container.id = "hospital-toast-container"
    container.className = "fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
    document.body.appendChild(container)
  }

  const toast = document.createElement("div")
  const bgClass =
    type === "success"
      ? "bg-emerald-600 text-white shadow-emerald-600/30"
      : type === "error"
      ? "bg-rose-600 text-white shadow-rose-600/30"
      : "bg-slate-900 text-white shadow-slate-900/30 dark:bg-slate-100 dark:text-slate-900"

  toast.className = `pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold shadow-lg transition-all transform duration-300 translate-y-2 opacity-0 ${bgClass}`
  toast.innerText = message
  container.appendChild(toast)

  // Trigger animation in
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-2", "opacity-0")
  })

  // Auto-dismiss after 3s
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2")
    setTimeout(() => {
      toast.remove()
    }, 300)
  }, 3000)
}
