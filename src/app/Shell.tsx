import { useState, useMemo, useEffect } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { allNav, dailyWorkNav, growthNav } from "./navConfig"
import { useAuthStore } from "../store/auth"
import { Avatar } from "../components/ui/Avatar"
import { listCallbackTasks } from "../api/telephony"
import { logoutRequest, switchHospital } from "../api/auth"
import { AIChatbotWidget } from "../components/ui/AIChatbotWidget"

function NavRow({ item }: { item: (typeof allNav)[number] }) {
  const { t } = useTranslation()
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center justify-between gap-2 px-[9px] py-[8px] rounded-control text-[13px] mb-[1px] ${
          isActive ? "font-semibold text-brand bg-brand-tint-strong" : "font-normal text-ink-2 hover:bg-page"
        }`
      }
    >
      <span className="flex items-center gap-[9px] min-w-0">
        <span className="w-[5px] h-[5px] rounded-full bg-current opacity-55 shrink-0" />
        <span className="truncate">{t(item.labelKey)}</span>
      </span>
    </NavLink>
  )
}

export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user, refreshToken, logout } = useAuthStore()
  const [isBranchOpen, setIsBranchOpen] = useState(false)
  const [isCompactMode, setIsCompactMode] = useState(() => localStorage.getItem("crm_compact") === "true")
  const [isFabOpen, setIsFabOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Listen for Global Hotkeys (Alt+N, Alt+A, Alt+C, Alt+H, ?, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in input or textarea
      const target = e.target as HTMLElement
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable

      if (e.key === "?" && !isInput) {
        e.preventDefault()
        setIsShortcutsOpen((prev) => !prev)
      } else if (e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault()
        setIsShortcutsOpen((prev) => !prev)
      } else if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault()
        navigate("/patients")
        showToast("⌨️ Keyboard Shortcut: Opening Patients Directory (Alt+N)")
      } else if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault()
        navigate("/appointments")
        showToast("⌨️ Keyboard Shortcut: Opening OPD Appointments (Alt+A)")
      } else if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault()
        toggleCompactMode()
      } else if (e.key === "Escape") {
        setIsShortcutsOpen(false)
        setIsFabOpen(false)
        setIsBranchOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [navigate, isCompactMode])


  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const toggleCompactMode = () => {
    const next = !isCompactMode
    setIsCompactMode(next)
    localStorage.setItem("crm_compact", String(next))
    showToast(next ? "📐 Compact View Enabled for 13-inch OPD Screens" : "📐 Standard View Enabled")
  }


  const active = useMemo(
    () => allNav.find((n) => location.pathname === n.path || location.pathname.startsWith(n.path + "/")),
    [location.pathname],
  )

  const { data: pendingCallbacks } = useQuery({
    queryKey: ["callback-tasks", "pending-count"],
    queryFn: () => listCallbackTasks({ status: "pending" }),
    refetchInterval: 30_000,
  })

  const handleLogout = () => {
    if (refreshToken) void logoutRequest(refreshToken).catch(() => {})
    logout()
    navigate("/login")
  }

  return (
    <div className="flex h-screen min-h-[760px] text-ink bg-page">
      <div className="w-[226px] shrink-0 bg-sidebar border-r border-border flex flex-col">
        <div className="px-[18px] pt-[18px] pb-[14px] border-b border-border-soft flex items-center gap-[10px]">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            🏥
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-ink truncate">{user?.hospital_name || "Polynexus Hospital"}</div>
            <div className="text-[11px] text-ink-6 truncate">{user?.role_name ?? "Hospital Admin"}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-[10px] pt-3 pb-5">
          <div className="text-[10px] tracking-[.1em] uppercase text-ink-5 font-semibold px-2 pt-1.5 pb-2">
            {t("nav.dailyWork")}
          </div>
          {dailyWorkNav.map((item) => (
            <NavRow key={item.key} item={item} />
          ))}

          <div className="text-[10px] tracking-[.1em] uppercase text-ink-5 font-semibold px-2 pt-[18px] pb-2">
            {t("nav.growthRevenue")}
          </div>
          {growthNav.map((item) => (
            <NavRow key={item.key} item={item} />
          ))}
        </div>

        <div className="px-3.5 py-3 border-t border-border-soft flex items-center gap-[9px]">
          <Avatar name={user?.email ?? "?"} size={26} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold truncate">{user?.first_name || user?.email}</div>
            <div className="text-[10.5px] text-ink-6 truncate">{user?.role_name ?? ""}</div>
          </div>
          <button onClick={handleLogout} title={t("common.logout")} className="text-ink-5 hover:text-danger-text text-[11px]">
            ⏻
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-14 shrink-0 bg-surface border-b border-border flex items-center gap-4 px-5">
          <div className="text-[15px] font-semibold shrink-0 whitespace-nowrap">
            {active ? t(active.labelKey) : ""}
          </div>
          <div className="text-[12px] text-ink-4 border-l border-border pl-4 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis">
            {active ? t(active.subKey) : ""}
          </div>
          <div className="flex-1 min-w-2" />
          
          <div className="flex items-center gap-[7px] h-8 px-2.5 border border-border rounded-control flex-none w-[220px] min-w-0 overflow-hidden text-ink-5 text-[13px]">
            <div className="w-[11px] h-[11px] border-[1.5px] border-ink-5 rounded-full shrink-0" />
            <span className="truncate">{t("common.search")}</span>
          </div>

          {/* Premium Branch Switcher in Top Header */}
          {user?.available_hospitals && user.available_hospitals.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setIsBranchOpen(!isBranchOpen)}
                className="flex items-center gap-2 h-8 px-3 border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-control text-xs font-semibold transition-all shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="max-w-[160px] truncate">
                  {user.hospital_name || "Select Branch"}
                </span>
                <span className="text-[10px] opacity-70">▾</span>
              </button>

              {/* Floating Dropdown Popover */}
              {isBranchOpen && (
                <div className="absolute right-0 top-10 w-72 bg-surface border border-border rounded-lg shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-1.5 border-b border-border text-[10px] uppercase font-bold tracking-wider text-ink-5">
                    Hospital Branch Context
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {user.available_hospitals.map((h) => {
                      const isSelected = h.id === user.hospital
                      return (
                        <button
                          key={h.id}
                          onClick={async () => {
                            setIsBranchOpen(false)
                            if (!isSelected) {
                              await switchHospital(h.id)
                              window.location.reload()
                            }
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                            isSelected
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold"
                              : "text-ink hover:bg-page"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="text-sm">📍</span>
                            <span className="truncate">{h.name}</span>
                          </div>
                          {isSelected && <span className="text-emerald-600 font-bold text-sm">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compact View Mode Toggle Button */}
          <button
            onClick={toggleCompactMode}
            title="Toggle Compact View Density (Alt+C)"
            className={`h-8 px-2.5 border rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              isCompactMode
                ? "bg-brand text-white border-brand shadow-xs"
                : "border-border text-ink-3 hover:bg-page"
            }`}
          >
            <span>📐</span>
            <span>{isCompactMode ? "Compact" : "Standard"}</span>
          </button>

          {/* Keyboard Shortcuts Helper Button */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            title="View Keyboard Shortcuts (Alt+H or ?)"
            className="h-8 px-2.5 border border-border text-ink-3 hover:bg-page hover:text-ink rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>⌨️</span>
            <span>Shortcuts</span>
          </button>

          <div className="flex flex-none min-w-[86px] border border-border rounded-control overflow-hidden">
            <button
              onClick={() => i18n.changeLanguage("en")}
              className={`flex-none whitespace-nowrap px-2.5 h-8 flex items-center text-[12px] font-semibold ${
                i18n.language === "en" ? "bg-brand-tint text-brand" : "bg-transparent text-ink-4"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => i18n.changeLanguage("mr")}
              className={`flex-none whitespace-nowrap px-2.5 h-8 flex items-center text-[12px] font-semibold border-l border-border ${
                i18n.language === "mr" ? "bg-brand-tint text-brand" : "bg-transparent text-ink-4"
              }`}
            >
              मराठी
            </button>
          </div>

          {!!pendingCallbacks?.count && (
            <button
              onClick={() => navigate("/callbacks")}

              className="flex items-center gap-2 h-8 px-3 rounded-control text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>• {pendingCallbacks.count} calls waiting</span>
            </button>
          )}

        </div>

        {/* Global Toast Notification */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-4 right-1/3 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-3"
          >
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Dynamic Outlet with Compact Mode Class */}
        <div className={`flex-1 overflow-y-auto p-5 ${isCompactMode ? "text-[12px] p-3 gap-2" : ""}`}>
          <Outlet />
        </div>
      </div>

      {/* Global Quick Action Speed-Dial FAB Button */}
      <div className="fixed bottom-6 right-64 z-40 flex flex-col items-end gap-2">
        {isFabOpen && (
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-2 flex flex-col gap-1.5 min-w-[200px] animate-in fade-in slide-in-from-bottom-2">
            <div className="px-2 py-1 text-[10px] uppercase font-bold text-ink-5 border-b border-border">
              Quick Actions (Hotkeys)
            </div>
            <button
              onClick={() => {
                setIsFabOpen(false)
                navigate("/patients")
                showToast("Opening Patient Directory...")
              }}
              className="flex items-center gap-2.5 text-xs font-semibold text-ink hover:bg-brand-tint hover:text-brand px-2.5 py-1.5 rounded-lg text-left transition-colors"
            >
              <span>👤</span>
              <span>New Patient (Alt+N)</span>
            </button>
            <button
              onClick={() => {
                setIsFabOpen(false)
                navigate("/appointments")
                showToast("Opening OPD Appointments...")
              }}
              className="flex items-center gap-2.5 text-xs font-semibold text-ink hover:bg-brand-tint hover:text-brand px-2.5 py-1.5 rounded-lg text-left transition-colors"
            >
              <span>📅</span>
              <span>Book Appointment (Alt+A)</span>
            </button>
            <button
              onClick={() => {
                setIsFabOpen(false)
                navigate("/patients/1")
                showToast("Opening OPD e-Prescription (e-Rx)...")
              }}
              className="flex items-center gap-2.5 text-xs font-semibold text-ink hover:bg-brand-tint hover:text-brand px-2.5 py-1.5 rounded-lg text-left transition-colors"
            >
              <span>💊</span>
              <span>Issue e-Prescription (e-Rx)</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          aria-expanded={isFabOpen}
          aria-label="Quick Actions"
          className="h-11 px-4 bg-brand hover:bg-brand-strong text-white rounded-full font-bold text-xs shadow-xl flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
        >
          <span className="text-base">{isFabOpen ? "✕" : "⚡"}</span>
          <span>Quick Actions</span>
        </button>
      </div>

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      {isShortcutsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setIsShortcutsOpen(false)}
        >
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div id="shortcuts-title" className="text-[16px] font-bold text-ink flex items-center gap-2">
                <span className="text-brand text-lg">⌨️</span> Keyboard Shortcuts & Hotkeys Guide
              </div>
              <button onClick={() => setIsShortcutsOpen(false)} className="text-ink-5 hover:text-ink text-sm">✕</button>
            </div>


            <div className="flex flex-col gap-2.5 text-xs text-ink">
              <div className="flex items-center justify-between py-1.5 border-b border-border-faint">
                <span className="font-semibold text-ink-2">Open Patient Directory</span>
                <kbd className="px-2 py-1 bg-page border border-border rounded font-mono font-bold text-brand shadow-2xs">Alt + N</kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border-faint">
                <span className="font-semibold text-ink-2">Open OPD Appointments Calendar</span>
                <kbd className="px-2 py-1 bg-page border border-border rounded font-mono font-bold text-brand shadow-2xs">Alt + A</kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border-faint">
                <span className="font-semibold text-ink-2">Toggle Compact View Density (13" OPD Laptops)</span>
                <kbd className="px-2 py-1 bg-page border border-border rounded font-mono font-bold text-brand shadow-2xs">Alt + C</kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border-faint">
                <span className="font-semibold text-ink-2">Toggle Keyboard Shortcuts Guide</span>
                <kbd className="px-2 py-1 bg-page border border-border rounded font-mono font-bold text-brand shadow-2xs">Alt + H  /  ?</kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border-faint">
                <span className="font-semibold text-ink-2">Close Modal / Dismiss Quick Actions</span>
                <kbd className="px-2 py-1 bg-page border border-border rounded font-mono font-bold text-ink-4 shadow-2xs">Esc</kbd>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-[11px] text-ink-5">
              <span>Tip: Hotkeys work from any page in the CRM.</span>
              <button onClick={() => setIsShortcutsOpen(false)} className="px-3 py-1.5 bg-brand text-white rounded font-bold text-xs">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <AIChatbotWidget />
    </div>
  )
}

