import { useState, useMemo, useEffect } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { IdleLock } from "./IdleLock"
import { LicenseBanner } from "./LicenseBanner"
import { WebChatAlerts } from "./WebChatAlerts"
import { useLicensedFeature } from "./useLicensedFeature"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import {
  allNav,
  dailyWorkNav,
  growthNav,
  careNav,
  erpOpsNav,
  nabhCareNav,
  nabhOpsNav,
  administrationNav,
  saasNav,
  hasNavAccess,
  erpModuleKeys,
  type NavItem,
} from "./navConfig"
import { useAuthStore } from "../store/auth"
import { Avatar } from "../components/ui/Avatar"
import { listCallbackTasks } from "../api/telephony"
import { logoutRequest, switchHospital } from "../api/auth"
import { listHospitals } from "../api/hospitals"
import { AIChatbotWidget } from "../components/ui/AIChatbotWidget"
import { useIdleTimeout } from "../hooks/useIdleTimeout"
import { useDraggable } from "../hooks/useDraggable"
import { WebRTCHeaderBadge } from "../telephony/SIPStatusDot"
import { IncomingCallReceiver } from "../telephony/IncomingCallReceiver"


type Domain = "crm" | "erp"
const ACTIVE_DOMAIN_KEY = "hms_active_domain"

interface NavSection {
  heading: string
  items: NavItem[]
}

function NavRow({ item }: { item: (typeof allNav)[number] }) {
  const { t } = useTranslation()
  const location = useLocation()

  const isSelected = useMemo(() => {
    if (item.path.includes("?")) {
      const full = location.pathname + location.search
      return full === item.path || (location.pathname === "/saas" && !location.search && item.path === "/saas?tab=overview")
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + "/")
  }, [item.path, location.pathname, location.search])

  return (
    <NavLink
      to={item.path}
      className={() =>
        `flex items-center justify-between gap-2 px-[9px] py-[8px] rounded-control text-[13px] mb-[1px] ${
          isSelected ? "font-semibold text-brand bg-brand-tint-strong" : "font-normal text-ink-2 hover:bg-page"
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
  const aiAssistLicensed = useLicensedFeature("ai_assist")
  const location = useLocation()
  const [isNavOpen, setIsNavOpen] = useState(false)
  useEffect(() => setIsNavOpen(false), [location.pathname])
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuthStore()
  const { isLocked, unlockScreen } = useIdleTimeout()
  const [unlockPasscode, setUnlockPasscode] = useState("")
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [isBranchOpen, setIsBranchOpen] = useState(false)
  const [accessHospitalId, setAccessHospitalId] = useState<string | null>(null)
  const [accessReason, setAccessReason] = useState("")
  const [accessError, setAccessError] = useState<string | null>(null)
  const [isEnteringHospital, setIsEnteringHospital] = useState(false)
  const [isCompactMode, setIsCompactMode] = useState(() => localStorage.getItem("crm_compact") === "true")
  const [isFabOpen, setIsFabOpen] = useState(false)
  const quickActionsDrag = useDraggable({ storageKey: "hms_quick_actions_fab_pos_v2" })
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)


  // Role.domain (crm/erp/both, see docs/erp/03-rbac-and-roles.md §2d) drives
  // which product(s) this user's sidebar can show; a hospital not
  // subscribed to any ERP module (Hospital.enabled_modules) never offers
  // HMS even to a domain=erp/both role. Missing role_domain (e.g. a bare
  // superuser with no Role at all) conservatively defaults to CRM-only,
  // matching this app's behavior before the switch existed.
  const roleDomain = user?.role_domain ?? "crm"
  const hasErpModules = !!user?.hospital_enabled_modules?.some((m) => erpModuleKeys.includes(m))
  const canSeeCRM = roleDomain !== "erp"
  const canSeeERP = roleDomain !== "crm" && hasErpModules
  const showDomainSwitcher = canSeeCRM && canSeeERP

  const [activeDomain, setActiveDomain] = useState<Domain>(() => {
    if (!canSeeCRM) return "erp"
    if (!canSeeERP) return "crm"
    try {
      const saved = localStorage.getItem(ACTIVE_DOMAIN_KEY)
      if (saved === "erp" || saved === "crm") return saved
    } catch {
      // localStorage unavailable (private browsing, etc.) — fall through to the default below
    }
    return "crm"
  })

  const switchDomain = (domain: Domain) => {
    setActiveDomain(domain)
    try {
      localStorage.setItem(ACTIVE_DOMAIN_KEY, domain)
    } catch {
      // best-effort persistence only
    }
  }

  const crmSections: NavSection[] = [
    { heading: t("nav.dailyWork"), items: dailyWorkNav },
    { heading: t("nav.growthRevenue"), items: growthNav },
  ]
  const erpSections: NavSection[] = [
    { heading: "Clinical care", items: careNav },
    { heading: "NABH clinical", items: nabhCareNav },
    { heading: "Finance & operations", items: erpOpsNav },
    { heading: "Quality & operations", items: nabhOpsNav },
  ]
  const visibleSections = (activeDomain === "crm" ? crmSections : erpSections)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasNavAccess(item, user?.permissions, user?.hospital_enabled_modules)),
    }))
    .filter((section) => section.items.length > 0)
  const visibleAdminItems = administrationNav.filter((item) => hasNavAccess(item, user?.permissions, user?.hospital_enabled_modules))

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


  const isSaasUser = Boolean(user?.is_saas_admin || (!user?.hospital && user?.is_superuser))

  const [platformMode, setPlatformMode] = useState<"saas" | "hospital">(() => {
    if (location.pathname.startsWith("/saas")) return "saas"
    try {
      const saved = localStorage.getItem("platform_mode")
      if (saved === "hospital" || saved === "saas") return saved
    } catch {}
    return isSaasUser ? "saas" : "hospital"
  })

  useEffect(() => {
    if (location.pathname.startsWith("/saas")) {
      setPlatformMode("saas")
      localStorage.setItem("platform_mode", "saas")
    } else if (
      location.pathname.startsWith("/dashboard") ||
      location.pathname.startsWith("/patients") ||
      location.pathname.startsWith("/appointments") ||
      location.pathname.startsWith("/console") ||
      location.pathname.startsWith("/callbacks") ||
      location.pathname.startsWith("/phone-menu") ||
      location.pathname.startsWith("/enquiries") ||
      location.pathname.startsWith("/inbox") ||
      location.pathname.startsWith("/referrals") ||
      location.pathname.startsWith("/ipd") ||
      location.pathname.startsWith("/pharmacy")
    ) {
      setPlatformMode("hospital")
      localStorage.setItem("platform_mode", "hospital")
    }
  }, [location.pathname])

  const isInSaasMode = isSaasUser && platformMode === "saas"
  // Admin screens (settings that affect everyone) look different from
  // day-to-day work: navy header with an "Admin" badge. CRM screens use
  // teal as the primary; HMS (clinical, ERP, MIS) uses navy.
  const isAdminScreen = isInSaasMode || ["/saas", "/admin", "/governance"].some((p) => location.pathname.startsWith(p))
  const product = isAdminScreen ? "admin" : activeDomain === "crm" ? "crm" : "hms"

  const active = useMemo(() => {
    if (location.pathname.startsWith("/saas")) {
      const full = location.pathname + location.search
      const match = saasNav.find((n) => n.path === full) || (location.search === "" ? saasNav[0] : undefined)
      if (match) return match
    }
    return allNav.find((n) => {
      if (n.path.includes("?")) {
        const full = location.pathname + location.search
        return full === n.path
      }
      return location.pathname === n.path || location.pathname.startsWith(n.path + "/")
    })
  }, [location.pathname, location.search])

  const { data: pendingCallbacks } = useQuery({
    queryKey: ["callback-tasks", "pending-count"],
    queryFn: () => listCallbackTasks({ status: "pending" }),
    refetchInterval: 30_000,
    enabled: !isInSaasMode,
  })

  const { data: allHospitals } = useQuery({
    queryKey: ["hospitals"],
    queryFn: listHospitals,
    enabled: !isInSaasMode || !user?.hospital,
  })

  const availableBranches = useMemo(() => {
    if (user?.available_hospitals && user.available_hospitals.length > 0) {
      return user.available_hospitals
    }
    if (allHospitals && allHospitals.length > 0) {
      return allHospitals.map((h) => ({
        id: h.id,
        name: h.name,
        slug: h.slug,
        city: h.city,
      }))
    }
    return []
  }, [user?.available_hospitals, allHospitals])

  // Only hospital staff are auto-attached. Platform users must explicitly
  // enter a tenant workspace, so patient data is never exposed by default.
  useEffect(() => {
    if (!isSaasUser && !isInSaasMode && !user?.hospital && availableBranches.length > 0) {
      const savedBranch = localStorage.getItem("last_active_hospital")
      const target = availableBranches.find((b) => b.id === savedBranch) || availableBranches[0]
      if (target) {
        switchHospital(target.id, "Hospital staff branch context")
          .then((updatedUser) => {
            if (updatedUser) {
              useAuthStore.getState().setUser(updatedUser)
              localStorage.setItem("last_active_hospital", target.id)
              showToast(`Attached to hospital branch: ${target.name}`)
            }
          })
          .catch(() => {})
      }
    }
  }, [isSaasUser, isInSaasMode, user?.hospital, availableBranches])

  const openHospitalAccess = (branchId?: string) => {
    setIsBranchOpen(false)
    setAccessHospitalId(branchId ?? availableBranches[0]?.id ?? null)
    setAccessReason("")
    setAccessError(null)
  }

  const handleSwitchBranch = async (branchId: string) => {
    if (isSaasUser) {
      openHospitalAccess(branchId)
      return
    }
    setIsBranchOpen(false)
    try {
      const updatedUser = await switchHospital(branchId, "Hospital staff branch context")
      if (updatedUser) {
        useAuthStore.getState().setUser(updatedUser)
        localStorage.setItem("last_active_hospital", branchId)
        showToast(`Switched active branch to ${updatedUser.hospital_name || "selected hospital"}`)
        window.location.reload()
      }
    } catch {
      window.location.reload()
    }
  }

  const enterHospitalWorkspace = async () => {
    if (!accessHospitalId) return
    if (accessReason.trim().length < 10) {
      setAccessError("Please provide a support-access reason (at least 10 characters).")
      return
    }
    setIsEnteringHospital(true)
    setAccessError(null)
    try {
      const updatedUser = await switchHospital(accessHospitalId, accessReason.trim())
      useAuthStore.getState().setUser(updatedUser)
      localStorage.setItem("last_active_hospital", accessHospitalId)
      localStorage.setItem("platform_mode", "hospital")
      setPlatformMode("hospital")
      setAccessHospitalId(null)
      navigate("/dashboard")
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Unable to enter this hospital workspace.")
    } finally {
      setIsEnteringHospital(false)
    }
  }

  const handleLogout = () => {
    const { refreshToken } = useAuthStore.getState()
    // Best-effort: blacklist the refresh token server-side so it can't be
    // replayed after logout. Local state is cleared and the user is
    // navigated away regardless of whether this call succeeds — a network
    // hiccup on logout must never trap the user on an authenticated page.
    if (refreshToken) {
      logoutRequest(refreshToken).catch(() => {})
    }
    logout()
    navigate("/login")
  }

  return (
    <div data-product={product} className="flex h-dvh text-ink bg-page">
      {/* Below laptop width the sidebar is a slide-out menu (☰ in the header). */}
      {isNavOpen && <div className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={() => setIsNavOpen(false)} aria-hidden="true" />}
      <div
        data-admin-header={isInSaasMode ? "" : undefined}
        className={`w-[226px] shrink-0 border-r border-border flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 ${
          isNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        } ${isInSaasMode ? "bg-admin" : "bg-sidebar"}`}
      >
        <div className="px-[18px] pt-[18px] pb-[14px] border-b border-border-soft flex items-center gap-[10px]">
          <div
            className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 ${
              isInSaasMode ? "bg-white/15" : "bg-brand"
            }`}
          >
            {isInSaasMode ? "⚡" : "🏥"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-ink truncate">
              {isInSaasMode ? "Polynexus SaaS" : user?.hospital_name || "Polynexus Hospital"}
            </div>
            <div className="text-[11px] text-ink-6 truncate">
              {isInSaasMode ? "Platform Master Admin" : user?.role_name ?? "Hospital Operations"}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-[10px] pt-3 pb-5">
          {/* Quick Mode Toggle for SaaS Super Admins */}
          {isSaasUser && (
            <div className="flex items-center gap-[3px] p-[3px] mb-3 bg-page rounded-control border border-border-soft">
              <button
                onClick={() => {
                  setPlatformMode("saas")
                  localStorage.setItem("platform_mode", "saas")
                  navigate("/saas")
                }}
                className={`flex-1 h-7 rounded-[6px] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                  isInSaasMode ? "bg-white text-admin shadow-2xs" : "text-ink-4 hover:text-ink-2"
                }`}
              >
                <span>⚡</span>
                <span>SaaS Mode</span>
              </button>
              <button
                onClick={() => {
                  openHospitalAccess(user?.hospital ?? availableBranches[0]?.id)
                }}
                className={`flex-1 h-7 rounded-[6px] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                  !isInSaasMode ? "bg-surface text-brand shadow-2xs border border-border-soft" : "text-ink-4 hover:text-ink-2"
                }`}
              >
                <span>🏥</span>
                <span>Hospital Ops</span>
              </button>
            </div>
          )}

          {isInSaasMode ? (
            <>
              <div className="text-[10px] tracking-[.1em] uppercase text-ink-5 font-semibold px-2 pt-1.5 pb-2">
                Platform Control
              </div>
              {saasNav.map((item) => (
                <NavRow key={item.key} item={item} />
              ))}

              <div className="text-[10px] tracking-[.1em] uppercase text-ink-5 font-semibold px-2 pt-[18px] pb-2">
                Administration
              </div>
              <NavRow item={{ key: "settings", path: "/settings", labelKey: "nav.settings", subKey: "screenSub.settings" }} />
            </>
          ) : (
            <>
              {/* CRM ⇄ HMS product switcher — only shown when role grants both */}
              {showDomainSwitcher && (
                <div className="flex items-center gap-[3px] p-[3px] mb-3 bg-page rounded-control border border-border-soft">
                  <button
                    onClick={() => switchDomain("crm")}
                    className={`flex-1 h-7 rounded-[6px] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      activeDomain === "crm" ? "bg-surface text-brand shadow-2xs" : "text-ink-4 hover:text-ink-2"
                    }`}
                  >
                    <span>💼</span>
                    <span>CRM</span>
                  </button>
                  <button
                    onClick={() => switchDomain("erp")}
                    className={`flex-1 h-7 rounded-[6px] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      activeDomain === "erp" ? "bg-surface text-brand shadow-2xs" : "text-ink-4 hover:text-ink-2"
                    }`}
                  >
                    <span>🏥</span>
                    <span>HMS</span>
                  </button>
                </div>
              )}

              {visibleSections.map((section) => (
                <div key={section.heading}>
                  <div className="text-[10px] tracking-[.1em] uppercase text-ink-5 font-semibold px-2 pt-1.5 pb-2">
                    {section.heading}
                  </div>
                  {section.items.map((item) => (
                    <NavRow key={item.key} item={item} />
                  ))}
                </div>
              ))}

              {visibleAdminItems.length > 0 && (
                <div>
                  <div className="text-[10px] tracking-[.1em] uppercase text-ink-5 font-semibold px-2 pt-[18px] pb-2">
                    Administration
                  </div>
                  {visibleAdminItems.map((item) => (
                    <NavRow key={item.key} item={item} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-3.5 py-3 border-t border-border-soft flex flex-col gap-2.5 bg-surface/40">
          <div className="flex items-center gap-[9px]">
            <Avatar name={user?.email ?? "?"} size={28} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold truncate text-ink">{user?.first_name || user?.email}</div>
              <div className="text-[10.5px] text-ink-6 truncate">{user?.role_name ?? "Hospital Operations"}</div>
            </div>
            <button
              type="button"
              onClick={() => i18n.changeLanguage(i18n.language === "mr" ? "en" : "mr")}
              className="md:hidden text-[11px] font-semibold px-1.5 py-0.5 border border-border rounded text-ink-3"
            >
              {i18n.language === "mr" ? "EN" : "मराठी"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title={t("common.logout")}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-control text-xs font-semibold text-danger-text hover:text-white bg-danger-tint hover:bg-danger border border-danger/25 transition-all cursor-pointer shadow-2xs"
            aria-label="Logout"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{t("common.logout") || "Log Out"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div data-admin-header={isAdminScreen ? "" : undefined} className="h-14 shrink-0 bg-surface border-b border-border flex items-center gap-2 sm:gap-4 px-3 sm:px-5 min-w-0">
          <button
            type="button"
            onClick={() => setIsNavOpen(true)}
            aria-label="Open menu"
            className="lg:hidden h-8 w-8 shrink-0 flex items-center justify-center rounded-control border border-border text-ink-3 hover:bg-page"
          >
            ☰
          </button>
          <div className="text-[15px] font-semibold shrink-0 whitespace-nowrap truncate max-w-[45vw] sm:max-w-none">
            {active ? t(active.labelKey) : ""}
          </div>
          {isAdminScreen && (
            <span
              title="Changes here affect everyone"
              className="shrink-0 rounded-chip bg-admin-tint text-admin text-[10.5px] font-bold uppercase tracking-[.08em] px-2 py-0.5"
            >
              Admin
            </span>
          )}
          <div className="hidden xl:block text-[12px] text-ink-4 border-l border-border pl-4 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis">
            {active ? t(active.subKey) : ""}
          </div>
          <div className="flex-1 min-w-2" />
          
          <div className="hidden lg:flex items-center gap-2 h-8 px-2.5 border border-border-strong rounded-control flex-none w-[160px] xl:w-[250px] min-w-0 text-ink text-[13px] bg-page focus-within:border-brand transition-colors">
            <span className="text-xs text-ink-4 shrink-0">🔍</span>
            <input
              type="text"
              placeholder={isInSaasMode ? "Search hospital by name, slug..." : t("common.search")}
              className="w-full bg-transparent border-none outline-none text-xs text-ink placeholder:text-ink-4"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val) {
                    if (isInSaasMode) {
                      navigate(`/saas?tab=subscriptions&q=${encodeURIComponent(val)}`)
                    } else {
                      navigate(`/patients?search=${encodeURIComponent(val)}`)
                    }
                  }
                }
              }}
            />
          </div>

          {/* Return to SaaS button when inspecting a hospital tenant */}
          {isSaasUser && !isInSaasMode && (
            <button
              onClick={() => {
                setPlatformMode("saas")
                localStorage.setItem("platform_mode", "saas")
                navigate("/saas")
              }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-control text-xs font-bold text-white bg-admin hover:bg-brand-dark shadow-xs transition-colors shrink-0"
              title="Return to SaaS Platform Control"
            >
              <span>⚡</span>
              <span>Back to SaaS Platform</span>
            </button>
          )}

          {/* Premium Branch Switcher in Top Header */}
          {availableBranches.length > 0 && !isInSaasMode && (
            <div className="relative">
              <button
                onClick={() => setIsBranchOpen(!isBranchOpen)}
                className={`flex items-center gap-2 h-8 px-3 border rounded-control text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                  !user?.hospital
                    ? "border-warning bg-warning-bg text-warning-text hover:bg-warning-bg font-bold animate-pulse"
                    : "border-brand-border bg-surface text-ink-2 hover:bg-page"
                }`}
              >
                {!user?.hospital ? (
                  <span>⚠️</span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                )}
                <span className="max-w-[70px] xl:max-w-[160px] truncate">
                  {!user?.hospital
                    ? "Select Hospital Branch"
                    : user.hospital_name || availableBranches.find((b) => b.id === user.hospital)?.name || "Active Branch"}
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
                    {availableBranches.map((h) => {
                      const isSelected = h.id === user?.hospital
                      return (
                        <button
                          key={h.id}
                          onClick={() => handleSwitchBranch(h.id)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-accent-tint text-accent font-bold"
                              : "text-ink hover:bg-page"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="text-sm">📍</span>
                            <span className="truncate">{h.name}</span>
                            {h.city && <span className="text-[10px] opacity-60">({h.city})</span>}
                          </div>
                          {isSelected && <span className="text-accent font-bold text-sm">✓</span>}
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
            className={`h-8 px-2.5 border rounded-control text-xs font-semibold hidden md:flex items-center gap-1.5 transition-colors ${
              isCompactMode
                ? "bg-brand-tint text-brand border-brand shadow-xs"
                : "border-border text-ink-3 hover:bg-page"
            }`}
          >
            <span>📐</span>
            <span className="hidden 2xl:inline">{isCompactMode ? "Compact" : "Standard"}</span>
          </button>

          {/* Keyboard Shortcuts Helper Button */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            title="View Keyboard Shortcuts (Alt+H or ?)"
            className="h-8 px-2.5 border border-border text-ink-3 hover:bg-page hover:text-ink rounded-control text-xs font-semibold hidden md:flex items-center gap-1.5 transition-colors"
          >
            <span>⌨️</span>
            <span className="hidden 2xl:inline">Shortcuts</span>
          </button>

          {/* WebRTC SIP Phone Browser Status */}
          <div className="hidden lg:block">
            <WebRTCHeaderBadge />
          </div>

          <div className="hidden md:flex flex-none min-w-[86px] border border-border rounded-control overflow-hidden">
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
              className="flex items-center gap-2 h-8 px-3 rounded-control text-xs font-bold text-warning-text bg-warning-bg dark:bg-amber-950/40 border border-warning/30 dark:border-amber-800 animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-warning" />
              <span className="hidden xl:inline">• {pendingCallbacks.count} calls waiting</span>
              <span className="xl:hidden">{pendingCallbacks.count}</span>
            </button>
          )}

          {/* Quick Header Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            title={t("common.logout") || "Log Out"}
            className="h-8 px-2.5 border border-border text-ink-3 hover:text-danger-text hover:bg-danger-tint/30 hover:border-danger/30 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            aria-label="Log Out"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden xl:inline">{t("common.logout") || "Log Out"}</span>
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

        {/* Warning banner when in Hospital Ops mode but no hospital branch is attached */}
        {!isInSaasMode && !user?.hospital && !isSaasUser && (
          <div className="bg-warning-bg border-b border-warning/30 text-warning-text px-5 py-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-base">⚠️</span>
              <div>
                <strong className="font-bold">No Hospital Branch Attached:</strong> You are currently not attached to an active hospital branch. Clinical actions (registering patients, booking OPD/IPD) require a branch context.
              </div>
            </div>
            {availableBranches.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-warning-text">Select Branch:</span>
                <select
                  className="bg-white border border-warning text-ink font-bold px-2.5 py-1 rounded text-xs focus:ring-2 focus:ring-warning shadow-2xs"
                  onChange={(e) => handleSwitchBranch(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>Choose a branch...</option>
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.city || "Main"})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <IdleLock />
        <LicenseBanner />
        <WebChatAlerts />
        {/* Dynamic Outlet with Compact Mode Class */}
        <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-5 ${isCompactMode ? "text-[12px] p-3 gap-2" : ""}`}>
          <Outlet />
        </div>
      </div>

      {/* Global Quick Action Speed-Dial — Stacked in bottom-right corner or dragged position */}
      {!isInSaasMode && (
        <>
          {isFabOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
              onClick={() => setIsFabOpen(false)}
              aria-hidden="true"
            />
          )}
          <div
            style={
              quickActionsDrag.position
                ? {
                    left: `${quickActionsDrag.position.x}px`,
                    top: `${quickActionsDrag.position.y}px`,
                    right: "auto",
                    bottom: "auto",
                  }
                : undefined
            }
            className={
              quickActionsDrag.position
                ? "fixed z-40 flex flex-col items-end touch-none select-none"
                : "fixed fab-stack right-6 z-40 flex flex-col items-end touch-none select-none"
            }
          >
            {/* Quick Actions Flyout Menu — Expands upwards smoothly (or downwards if near top) */}
            {isFabOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Quick Actions"
                className={`absolute ${
                  quickActionsDrag.position && quickActionsDrag.position.y < 260
                    ? "top-full mt-2"
                    : "bottom-full mb-2"
                } ${
                  quickActionsDrag.position && quickActionsDrag.position.x < 260
                    ? "left-0"
                    : "right-0"
                } bg-surface/98 backdrop-blur-md border border-border-strong rounded-2xl shadow-2xl p-3.5 w-64 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 z-50`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
                    <span className="text-amber-500 text-sm">⚡</span>
                    <span>Quick Actions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {quickActionsDrag.position && (
                      <button
                        onClick={quickActionsDrag.resetPosition}
                        title="Reset to default corner position"
                        className="text-ink-4 hover:text-ink text-xs px-1.5 py-0.5 rounded hover:bg-page transition-colors cursor-pointer"
                        aria-label="Reset position"
                      >
                        ↺ Reset
                      </button>
                    )}
                    <button
                      onClick={() => setIsFabOpen(false)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-ink-4 hover:text-ink hover:bg-page transition-colors text-xs cursor-pointer"
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setIsFabOpen(false)
                      navigate("/patients")
                      showToast("Opening Patient Directory...")
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-ink hover:bg-brand-tint hover:text-brand border border-transparent hover:border-brand/20 transition-all text-left cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">👤</span>
                      <span>New Patient</span>
                    </span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-page border border-border text-ink-4 group-hover:border-brand/30 group-hover:text-brand font-bold">Alt+N</kbd>
                  </button>

                  <button
                    onClick={() => {
                      setIsFabOpen(false)
                      navigate("/appointments")
                      showToast("Opening OPD Appointments...")
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-ink hover:bg-brand-tint hover:text-brand border border-transparent hover:border-brand/20 transition-all text-left cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">📅</span>
                      <span>Book Appointment</span>
                    </span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-page border border-border text-ink-4 group-hover:border-brand/30 group-hover:text-brand font-bold">Alt+A</kbd>
                  </button>

                  <button
                    onClick={() => {
                      setIsFabOpen(false)
                      navigate("/patients/1")
                      showToast("Opening OPD e-Prescription (e-Rx)...")
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-ink hover:bg-brand-tint hover:text-brand border border-transparent hover:border-brand/20 transition-all text-left cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">💊</span>
                      <span>Issue e-Prescription</span>
                    </span>
                    <span className="text-[10px] text-ink-4 font-mono font-medium">e-Rx</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsFabOpen(false)
                      setIsShortcutsOpen(true)
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-ink hover:bg-page border border-transparent hover:border-border transition-all text-left cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">⌨️</span>
                      <span>Shortcuts Guide</span>
                    </span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-page border border-border text-ink-4 font-bold">Alt+H</kbd>
                  </button>
                </div>
              </div>
            )}

            <button
              onPointerDown={quickActionsDrag.onPointerDown}
              onClick={(e) => {
                if (quickActionsDrag.hasMovedRef.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  return
                }
                setIsFabOpen(!isFabOpen)
              }}
              aria-expanded={isFabOpen}
              aria-label="Quick Actions"
              title="Quick Actions & Hotkeys (Alt+N, Alt+A, Alt+H) • Drag to move anywhere"
              className={`relative group w-12 h-12 rounded-full bg-slate-900/95 hover:bg-slate-900 text-white shadow-xl hover:shadow-2xl flex items-center justify-center transition-transform duration-150 active:scale-95 border border-slate-700/80 ${
                quickActionsDrag.isDragging ? "cursor-grabbing scale-110 shadow-2xl ring-2 ring-amber-400" : "cursor-grab hover:scale-110"
              }`}
            >
              <span className="text-amber-400 text-base font-bold group-hover:scale-110 transition-transform pointer-events-none">
                {isFabOpen ? "✕" : "⚡"}
              </span>
              <span className="sr-only">Quick Actions</span>

              {/* Hover Tooltip */}
              <span className="absolute right-full mr-3 px-2.5 py-1 bg-slate-900/95 text-white text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700/80 flex items-center gap-1.5">
                <span>Quick Actions</span>
                <span className="text-[10px] text-slate-400 font-normal">• Drag to move</span>
              </span>
            </button>
          </div>
        </>
      )}

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

      {aiAssistLicensed && <AIChatbotWidget />}

      {/* ISO 27001 Workstation Lock Screen Backdrop Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-[100] backdrop-blur-md bg-slate-950/85 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-success/20 border-2 border-success flex items-center justify-center text-2xl shadow-inner">
              🔒
            </div>

            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800">
                ISO 27001 Workstation Security
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white mt-3">Workstation Locked</h2>
              <p className="text-xs text-slate-400 mt-1">
                Inactive for 15 minutes. Patient clinical PHI data hidden. Enter passcode or PIN to unlock.
              </p>
            </div>

            <div className="w-full bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 flex items-center gap-3">
              <Avatar name={user?.first_name || user?.email || "User"} size={40} />
              <div className="text-left min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate">{user?.first_name ? `${user.first_name} ${user.last_name || ""}` : user?.email}</div>
                <div className="text-xs text-slate-400 truncate">{user?.role_name || "Hospital Staff"}</div>
              </div>
            </div>

            {unlockError && (
              <div className="text-xs text-rose-400 font-semibold bg-rose-950/50 border border-rose-800 px-3 py-1.5 rounded-lg w-full">
                {unlockError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setUnlockError(null)
                if (!unlockPasscode) {
                  setUnlockError("Please enter your PIN or password.")
                  return
                }
                unlockScreen(unlockPasscode)
                setUnlockPasscode("")
              }}
              className="w-full space-y-3"
            >
              <input
                autoFocus
                type="password"
                placeholder="Enter password or unlock PIN"
                value={unlockPasscode}
                onChange={(e) => setUnlockPasscode(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-success"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Log Out
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-success hover:bg-success text-white text-xs font-bold shadow-lg transition-colors"
                >
                  Unlock Terminal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accessHospitalId && (
        <div className="fixed inset-0 z-[70] bg-slate-950/45 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="hospital-access-title" className="w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-border p-6">
            <div className="flex items-start gap-3">
              <span className="text-xl">🔒</span>
              <div>
                <h2 id="hospital-access-title" className="text-base font-bold text-ink">Enter hospital workspace</h2>
                <p className="mt-1 text-xs leading-5 text-ink-4">You are about to access operational and patient information for <strong className="text-ink">{availableBranches.find((h) => h.id === accessHospitalId)?.name ?? "this hospital"}</strong>. This access will be recorded in the security audit log.</p>
              </div>
            </div>
            <label className="block mt-5 text-xs font-semibold text-ink-2">Support-access reason</label>
            <textarea value={accessReason} onChange={(e) => setAccessReason(e.target.value)} autoFocus rows={3} placeholder="Example: Investigating ticket #1234 reported by hospital administrator" className="mt-1.5 w-full rounded-control border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
            {accessError && <p className="mt-2 text-xs text-danger-text">{accessError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAccessHospitalId(null)} disabled={isEnteringHospital} className="h-9 px-3 rounded-control border border-border text-xs font-semibold text-ink-3">Cancel</button>
              <button onClick={enterHospitalWorkspace} disabled={isEnteringHospital} className="h-9 px-3 rounded-control bg-admin text-white text-xs font-bold disabled:opacity-60">{isEnteringHospital ? "Entering…" : "Record & enter hospital"}</button>
            </div>
          </div>
        </div>
      )}

      {/* WebRTC Telephony: Background Incoming Call Receiver & Floating Overlay */}
      <IncomingCallReceiver />
    </div>
  )
}


