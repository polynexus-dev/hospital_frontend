import { useState, useMemo, useEffect } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Inbox as InboxIcon,
  Phone,
  PhoneCall,
  MessageSquareText,
  Stethoscope,
  FlaskConical,
  Pill,
  Siren,
  Scissors,
  HeartPulse,
  Droplet,
  Share2,
  Gift,
  ShieldCheck,
  Star,
  Workflow,
  Landmark,
  Receipt,
  IdCard,
  Boxes,
  ShieldQuestion,
  Settings as SettingsIcon,
  UserPlus,
  Search,
  Bell,
  History,
  LogOut,
  HelpCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { saasNav, administrationNav, businessNav, careNav, dailyWorkNav, type NavItem, hasNavAccess } from "./navConfig"
import { useAuthStore } from "../store/auth"
import { Avatar } from "../components/ui/Avatar"
import { Button } from "../components/ui/Button"
import { listCallbackTasks } from "../api/telephony"
import { logoutRequest, switchHospital } from "../api/auth"
import { AIChatbotWidget } from "../components/ui/AIChatbotWidget"

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  patients: Users,
  appointments: CalendarDays,
  inbox: InboxIcon,
  "call-console": Phone,
  callbacks: PhoneCall,
  enquiries: MessageSquareText,
  ipd: Stethoscope,
  diagnostics: FlaskConical,
  pharmacy: Pill,
  emergency: Siren,
  ot: Scissors,
  icu: HeartPulse,
  bloodbank: Droplet,
  referrals: Share2,
  packages: Gift,
  tpa: ShieldCheck,
  feedback: Star,
  workflows: Workflow,
  finance: Landmark,
  billing: Receipt,
  hr: IdCard,
  inventory: Boxes,
  admin: ShieldQuestion,
  settings: SettingsIcon,
}

function NavRow({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  const Icon = NAV_ICONS[item.key]
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-[9px] px-[9px] py-[8px] rounded-control text-[13px] mb-[1px] ${
          isActive ? "font-semibold text-brand bg-brand-tint-strong" : "font-normal text-ink-2 hover:bg-page"
        }`
      }
    >
      {Icon && <Icon size={15} className="shrink-0 opacity-80" />}
      <span className="truncate">{t(item.labelKey)}</span>
    </NavLink>
  )
}

function NavGroup({ label, items, permissions, enabledModules }: {
  label: string
  items: NavItem[]
  permissions: string[] | undefined
  enabledModules: string[] | undefined
}) {
  const visible = items.filter((item) => hasNavAccess(item, permissions, enabledModules))
  if (visible.length === 0) return null
  return (
    <>
      <div className="text-[10px] tracking-[.1em] uppercase text-ink-5 font-semibold px-2 pt-[18px] pb-2">{label}</div>
      {visible.map((item) => (
        <NavRow key={item.key} item={item} />
      ))}
    </>
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
  const [searchValue, setSearchValue] = useState("")

  const isSaasOwner = user?.email === "saas_owner@hospital-crm.com"

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

  const runGlobalSearch = () => {
    if (!searchValue.trim()) return
    navigate("/patients", { state: { search: searchValue.trim() } })
  }

  // /admin (and other paths) can appear in both saasNav and the hospital
  // nav groups with different labels — search only the list that matches
  // who's actually signed in, so the SaaS owner's breadcrumb never leaks
  // into a hospital admin's screen (or vice versa).
  const active = useMemo(() => {
    const candidates: NavItem[] = isSaasOwner
      ? saasNav
      : [...dailyWorkNav, ...careNav, ...businessNav, ...administrationNav]
    return candidates.find((n) => location.pathname === n.path || location.pathname.startsWith(n.path + "/"))
  }, [location.pathname, isSaasOwner])

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
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            {isSaasOwner ? "⚡" : "🏥"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-ink truncate">
              {isSaasOwner ? "SaaS Vendor Platform" : user?.hospital_name || "Polynexus Hospital"}
            </div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
              {isSaasOwner ? "Global Superadmin" : user?.role_name ?? "Hospital Admin"}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-[10px] pt-3 pb-5">
          {isSaasOwner ? (
            <>
              <div className="text-[10px] tracking-[.1em] uppercase text-indigo-600 dark:text-indigo-400 font-bold px-2 pt-1.5 pb-2">
                ⚡ SaaS Vendor Control Center
              </div>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 px-[9px] py-[8px] rounded-control text-[13px] mb-[1px] ${
                    isActive ? "font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" : "font-normal text-ink-2 hover:bg-page"
                  }`
                }
              >
                <span className="flex items-center gap-[9px] min-w-0 font-medium">
                  <span>🏢</span>
                  <span className="truncate">Tenants & Subscriptions</span>
                </span>
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 px-[9px] py-[8px] rounded-control text-[13px] mb-[1px] ${
                    isActive ? "font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" : "font-normal text-ink-2 hover:bg-page"
                  }`
                }
              >
                <span className="flex items-center gap-[9px] min-w-0 font-medium">
                  <span>📊</span>
                  <span className="truncate">Global Platform Metrics</span>
                </span>
              </NavLink>

              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] text-emerald-800 dark:text-emerald-300">
                <div className="font-bold flex items-center gap-1 mb-1">
                  <span>🔒</span> DPDP Act Compliant
                </div>
                <div>Zero PHI exposure mode for SaaS Platform Owner. Patient medical records are strictly isolated per hospital tenant.</div>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                className="w-full mb-1"
                onClick={() => navigate("/patients", { state: { openNewPatient: true } })}
              >
                <UserPlus size={15} />
                {t("nav.newPatient")}
              </Button>

              {dailyWorkNav.filter((item) => hasNavAccess(item, user?.permissions, user?.hospital_enabled_modules)).map((item) => (
                <NavRow key={item.key} item={item} />
              ))}

              <NavGroup label={t("nav.care")} items={careNav} permissions={user?.permissions} enabledModules={user?.hospital_enabled_modules} />
              <NavGroup label={t("nav.business")} items={businessNav} permissions={user?.permissions} enabledModules={user?.hospital_enabled_modules} />
              <NavGroup label={t("nav.administration")} items={administrationNav} permissions={user?.permissions} enabledModules={user?.hospital_enabled_modules} />
            </>
          )}
        </div>

        {!isSaasOwner && (
          <div className="px-[10px] pt-2 pb-1 border-t border-border-soft">
            <button
              onClick={() => setIsShortcutsOpen(true)}
              className="w-full flex items-center gap-[9px] px-[9px] py-[8px] rounded-control text-[13px] text-ink-2 hover:bg-page"
            >
              <HelpCircle size={15} className="shrink-0 opacity-80" />
              <span>{t("nav.helpCenter")}</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-[9px] px-[9px] py-[8px] rounded-control text-[13px] text-ink-2 hover:bg-danger-bg hover:text-danger-text"
            >
              <LogOut size={15} className="shrink-0 opacity-80" />
              <span>{t("common.logout")}</span>
            </button>
          </div>
        )}

        <div className="px-3.5 py-3 border-t border-border-soft flex items-center gap-[9px]">
          <Avatar name={user?.email ?? "?"} size={26} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold truncate">{user?.first_name || user?.email}</div>
            <div className="text-[10.5px] text-ink-6 truncate">{user?.role_name ?? ""}</div>
          </div>
          {isSaasOwner && (
            <button onClick={handleLogout} title={t("common.logout")} className="text-ink-5 hover:text-danger-text text-[11px]">
              ⏻
            </button>
          )}
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

          <div className="flex items-center gap-[7px] h-8 px-2.5 border border-border rounded-control flex-none w-[240px] min-w-0 text-ink-5 text-[13px] focus-within:border-brand focus-within:text-ink">
            <Search size={13} className="shrink-0" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runGlobalSearch()}
              placeholder={t("common.search")}
              className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-ink-5 text-ink"
            />
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
            className={`h-8 w-8 flex items-center justify-center border rounded-control text-xs font-semibold transition-colors ${
              isCompactMode
                ? "bg-brand text-white border-brand shadow-xs"
                : "border-border text-ink-3 hover:bg-page"
            }`}
          >
            📐
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

          <button
            onClick={() => navigate("/callbacks")}
            title={pendingCallbacks?.count ? `${pendingCallbacks.count} calls waiting` : "No pending callbacks"}
            className="relative h-8 w-8 flex items-center justify-center border border-border rounded-control text-ink-3 hover:bg-page"
          >
            <Bell size={15} />
            {!!pendingCallbacks?.count && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingCallbacks.count}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate("/console")}
            title="Call history"
            className="h-8 w-8 flex items-center justify-center border border-border rounded-control text-ink-3 hover:bg-page"
          >
            <History size={15} />
          </button>

          <button
            onClick={() => navigate("/settings")}
            title={user?.first_name || user?.email || "Account"}
            className="shrink-0"
          >
            <Avatar name={user?.email ?? "?"} size={30} />
          </button>
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
