import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { StatTile } from "../../components/ui/StatTile"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill } from "../../components/ui/Pill"
import { ErrorState, EmptyState, LoadingState } from "../../components/ui/QueryStates"
import { triggerBlobDownload } from "../../api/client"
import { switchHospital } from "../../api/auth"
import { useAuthStore } from "../../store/auth"
import {
  downloadInvoicePdf,
  listHospitals,
  listInvoices,
  listSaaSTickets,
  listSubscriptions,
  listUsageSnapshots,
  markInvoicePaid,
  onboardHospital,
  platformAnalytics,
  resolveTicket,
  updateHospitalModules,
  updateSubscription,
} from "../../api/saas"
import type { OnboardTenantPayload, SaaSHospital, SaaSSupportTicket, TenantInvoice, TenantSubscription } from "../../types/api"
import type { Tone } from "../../components/ui/tone"
import { TenantModulesModal } from "./TenantModulesModal"
import { TenantOnboardModal } from "./TenantOnboardModal"


type TabKey = "overview" | "subscriptions" | "invoices" | "usage" | "tickets"

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Platform Overview" },
  { key: "subscriptions", label: "Tenants & Subscriptions" },
  { key: "invoices", label: "Invoices" },
  { key: "usage", label: "Usage" },
  { key: "tickets", label: "Support Tickets" },
]

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

const SUBSCRIPTION_TONE: Record<TenantSubscription["status"], Tone> = {
  active: "ok",
  suspended: "warn",
  cancelled: "bad",
}

const INVOICE_TONE: Record<TenantInvoice["status"], Tone> = {
  paid: "ok",
  unpaid: "warn",
  overdue: "bad",
}

const TICKET_TONE: Record<SaaSSupportTicket["status"], Tone> = {
  open: "warn",
  in_progress: "info",
  resolved: "ok",
  closed: "neutral",
}

const PRIORITY_TONE: Record<SaaSSupportTicket["priority"], Tone> = {
  urgent: "bad",
  high: "warn",
  medium: "info",
  low: "neutral",
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB"
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—"
}

function TicketRow({ ticket }: { ticket: SaaSSupportTicket }) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState("")

  const resolve = useMutation({
    mutationFn: () => resolveTicket(ticket.id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saas-tickets"] }),
  })

  const isClosed = ticket.status === "resolved" || ticket.status === "closed"

  return (
    <div className="grid grid-cols-[1.2fr_1.6fr_0.8fr_0.9fr_1.8fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[1000px]">
      <div className="text-ink-3 truncate">{ticket.hospital_name ?? ticket.hospital}</div>
      <div className="min-w-0">
        <div className="font-semibold truncate" title={ticket.subject}>{ticket.subject}</div>
        <div className="text-[11.5px] text-ink-4 truncate">{ticket.raised_by_email ?? "unknown"} · {ticket.category}</div>
      </div>
      <div><Pill tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Pill></div>
      <div><Pill tone={TICKET_TONE[ticket.status]}>{ticket.status}</Pill></div>
      <div>
        {isClosed ? (
          <div className="text-[12px] text-ink-4 truncate" title={ticket.resolution_notes}>
            {ticket.resolution_notes || "no resolution notes"}
          </div>
        ) : (
          <div className="flex gap-1.5">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Resolution notes"
              aria-label={`Resolution notes for ticket ${ticket.id}`}
              className="flex-1 min-w-0 px-2 py-1 text-[12px] border border-border-strong rounded-control bg-page"
            />
            <Button size="sm" variant="primary" disabled={resolve.isPending} onClick={() => resolve.mutate()}>
              {resolve.isPending ? "Saving…" : "Resolve"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function InvoiceRow({ invoice }: { invoice: TenantInvoice }) {
  const queryClient = useQueryClient()
  const [isDownloading, setIsDownloading] = useState(false)

  const markPaid = useMutation({
    mutationFn: () => markInvoicePaid(invoice.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saas-invoices"] }),
  })

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const blob = await downloadInvoicePdf(invoice.id)
      triggerBlobDownload(blob, `${invoice.invoice_number}.pdf`)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="grid grid-cols-[1.1fr_1.2fr_1.2fr_0.8fr_0.8fr_1.2fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[1000px]">
      <div className="font-mono text-[12px] truncate">{invoice.invoice_number}</div>
      <div className="text-ink-3 truncate">{invoice.hospital_name ?? invoice.hospital}</div>
      <div className="text-ink-4 text-[12px]">
        {formatDate(invoice.billing_period_start)} – {formatDate(invoice.billing_period_end)}
      </div>
      <div className="font-semibold">{INR.format(Number(invoice.amount))}</div>
      <div><Pill tone={INVOICE_TONE[invoice.status]}>{invoice.status}</Pill></div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="secondary" disabled={isDownloading} onClick={handleDownload}>
          {isDownloading ? "…" : "PDF"}
        </Button>
        {invoice.status !== "paid" && (
          <Button size="sm" variant="primary" disabled={markPaid.isPending} onClick={() => markPaid.mutate()}>
            {markPaid.isPending ? "Saving…" : "Mark paid"}
          </Button>
        )}
      </div>
    </div>
  )
}

function SubscriptionRow({
  subscription,
  hospital,
  onInspect,
  onConfigureModules,
}: {
  subscription: TenantSubscription
  hospital?: SaaSHospital
  onInspect?: (hospitalId: number) => void
  onConfigureModules?: (hospital: SaaSHospital) => void
}) {
  const queryClient = useQueryClient()

  const setStatus = useMutation({
    mutationFn: (status: TenantSubscription["status"]) => updateSubscription(subscription.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["saas-hospitals"] })
    },
  })

  const moduleCount = hospital?.enabled_modules?.length ?? 14

  return (
    <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.7fr_0.8fr_0.8fr_1.8fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[1150px]">
      <div className="min-w-0">
        <div className="font-semibold truncate">{subscription.hospital_name ?? hospital?.name ?? subscription.hospital}</div>
        {hospital?.slug && (
          <div className="text-[11px] font-mono text-teal-600 dark:text-teal-400 truncate">
            {hospital.slug}.hms.polynexus.in
          </div>
        )}
      </div>
      <div className="uppercase"><NeutralTag>{subscription.tier}</NeutralTag></div>
      <div className="text-ink-3 capitalize">{subscription.billing_cycle}</div>
      <div className="font-semibold">{INR.format(Number(subscription.base_price))}</div>
      <div className="text-ink-3">{subscription.max_staff_users || "∞"}</div>
      <div>
        <Pill tone="info">{moduleCount} Modules</Pill>
      </div>
      <div><Pill tone={SUBSCRIPTION_TONE[subscription.status]}>{subscription.status}</Pill></div>
      <div className="flex items-center gap-1.5">
        {hospital && onConfigureModules && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onConfigureModules(hospital)}
            title="Configure active clinical and operational modules"
          >
            ⚙️ Modules
          </Button>
        )}
        {onInspect && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onInspect(Number(subscription.hospital))}
            title="Switch context and inspect this hospital in Hospital Operations mode"
          >
            👁️ Inspect
          </Button>
        )}
        {subscription.status === "active" ? (
          <Button size="sm" variant="danger" disabled={setStatus.isPending} onClick={() => setStatus.mutate("suspended")}>
            Suspend
          </Button>
        ) : subscription.status === "suspended" ? (
          <Button size="sm" variant="primary" disabled={setStatus.isPending} onClick={() => setStatus.mutate("active")}>
            Reactivate
          </Button>
        ) : (
          <span className="text-[12px] text-ink-4">cancelled</span>
        )}
      </div>
    </div>
  )
}


export function SaaSConsolePage() {
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab") as TabKey | null
  const activeTab: TabKey = tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : "overview"
  const [unresolvedOnly, setUnresolvedOnly] = useState(true)

  const urlQuery = searchParams.get("q") || ""
  const [searchQuery, setSearchQuery] = useState(urlQuery)
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("all")

  useEffect(() => {
    if (urlQuery) {
      setSearchQuery(urlQuery)
    }
  }, [urlQuery])

  const setActiveTab = (key: TabKey) => {
    setSearchParams((prev) => {
      prev.set("tab", key)
      return prev
    })
  }

  const handleInspect = async (hospitalId: string | number) => {
    try {
      await switchHospital(String(hospitalId))
      localStorage.setItem("platform_mode", "hospital")
      window.location.href = "/dashboard"
    } catch (e) {
      console.error(e)
    }
  }

  const queryClient = useQueryClient()
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false)
  const [modulesHospital, setModulesHospital] = useState<SaaSHospital | null>(null)

  const analytics = useQuery({
    queryKey: ["saas-analytics"],
    queryFn: platformAnalytics,
    enabled: activeTab === "overview",
  })

  const subscriptions = useQuery({
    queryKey: ["saas-subscriptions"],
    queryFn: () => listSubscriptions(),
  })

  const hospitals = useQuery({
    queryKey: ["saas-hospitals"],
    queryFn: () => listHospitals(),
  })

  const hospitalsMap = useMemo(() => {
    const map = new Map<string, SaaSHospital>()
    ;(hospitals.data?.results ?? []).forEach((h) => {
      map.set(String(h.id), h)
      if (h.name) map.set(h.name, h)
      if (h.slug) map.set(h.slug, h)
    })
    return map
  }, [hospitals.data])

  const updateModulesMutation = useMutation({
    mutationFn: ({ id, modules }: { id: string; modules: string[] }) => updateHospitalModules(id, modules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-hospitals"] })
      setModulesHospital(null)
    },
  })

  const invoices = useQuery({
    queryKey: ["saas-invoices"],
    queryFn: () => listInvoices(),
    enabled: activeTab === "invoices",
  })

  const usage = useQuery({
    queryKey: ["saas-usage"],
    queryFn: () => listUsageSnapshots(),
    enabled: activeTab === "usage",
  })

  const tickets = useQuery({
    queryKey: ["saas-tickets", unresolvedOnly],
    queryFn: () => listSaaSTickets(unresolvedOnly ? { status: "open" } : {}),
    enabled: activeTab === "tickets",
  })


  const hospitalList = useMemo(() => {
    if (user?.available_hospitals && user.available_hospitals.length > 0) {
      return user.available_hospitals
    }
    const map = new Map<number | string, { id: number | string; name: string }>()
    subscriptions.data?.results.forEach((s) => {
      map.set(s.hospital, { id: s.hospital, name: s.hospital_name || `Hospital #${s.hospital}` })
    })
    return Array.from(map.values())
  }, [user, subscriptions.data])

  const filteredSubscriptions = useMemo(() => {
    const list = subscriptions.data?.results ?? []
    return list.filter((s) => {
      if (selectedHospitalId !== "all" && String(s.hospital) !== selectedHospitalId) {
        return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const name = (s.hospital_name || "").toLowerCase()
        const tier = (s.tier || "").toLowerCase()
        const id = String(s.hospital)
        return name.includes(q) || tier.includes(q) || id.includes(q)
      }
      return true
    })
  }, [subscriptions.data?.results, selectedHospitalId, searchQuery])

  const filteredInvoices = useMemo(() => {
    const list = invoices.data?.results ?? []
    return list.filter((inv) => {
      if (selectedHospitalId !== "all" && String(inv.hospital) !== selectedHospitalId) {
        return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const name = (inv.hospital_name || "").toLowerCase()
        const invNum = (inv.invoice_number || "").toLowerCase()
        const id = String(inv.hospital)
        return name.includes(q) || invNum.includes(q) || id.includes(q)
      }
      return true
    })
  }, [invoices.data?.results, selectedHospitalId, searchQuery])

  const filteredUsage = useMemo(() => {
    const list = usage.data?.results ?? []
    return list.filter((u) => {
      if (selectedHospitalId !== "all" && String(u.hospital) !== selectedHospitalId) {
        return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const name = (u.hospital_name || "").toLowerCase()
        const id = String(u.hospital)
        return name.includes(q) || id.includes(q)
      }
      return true
    })
  }, [usage.data?.results, selectedHospitalId, searchQuery])

  const filteredTickets = useMemo(() => {
    const list = tickets.data?.results ?? []
    return list.filter((t) => {
      if (selectedHospitalId !== "all" && String(t.hospital) !== selectedHospitalId) {
        return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const name = (t.hospital_name || "").toLowerCase()
        const subject = (t.subject || "").toLowerCase()
        const id = String(t.hospital)
        return name.includes(q) || subject.includes(q) || id.includes(q)
      }
      return true
    })
  }, [tickets.data?.results, selectedHospitalId, searchQuery])

  const moduleAdoption = Object.entries(analytics.data?.module_adoption_percent ?? {})
    .sort(([, a], [, b]) => b - a)

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px px-3 py-2.5 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key ? "border-brand text-brand" : "border-transparent text-ink-4 hover:text-ink-2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Universal SaaS Hospital Search & Filter Bar */}
      <div className="bg-surface border border-border rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 text-xs pointer-events-none">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hospital by name, slug, ID, or invoice..."
              className="w-full h-9 pl-8 pr-8 border border-border-strong rounded-control text-[12.5px] bg-page outline-none focus:border-brand transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink text-xs p-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedHospitalId}
            onChange={(e) => setSelectedHospitalId(e.target.value)}
            className="h-9 px-3 border border-border-strong rounded-control text-[12px] bg-page font-semibold outline-none focus:border-brand shrink-0"
          >
            <option value="all">All Hospitals ({hospitalList.length || subscriptions.data?.count || 3})</option>
            {hospitalList.map((h) => (
              <option key={h.id} value={String(h.id)}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {(searchQuery || selectedHospitalId !== "all") && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-4">
                Filter active {selectedHospitalId !== "all" ? `(${hospitalList.find((h) => String(h.id) === selectedHospitalId)?.name})` : ""}
              </span>
              <button
                onClick={() => {
                  setSearchQuery("")
                  setSelectedHospitalId("all")
                }}
                className="px-2 py-1 rounded bg-page border border-border text-brand font-semibold hover:bg-brand-tint text-xs"
              >
                Reset filter
              </button>
            </div>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsOnboardModalOpen(true)}
            className="flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <span>✨</span>
            <span>+ Onboard Hospital</span>
          </Button>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="flex flex-col gap-3.5">
          {analytics.isLoading && <LoadingState />}
          {analytics.isError && <ErrorState />}
          {analytics.data && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <StatTile label="Hospitals on platform" value={analytics.data.total_hospitals} />
                <StatTile label="Active hospitals" value={analytics.data.active_hospitals} />
                <StatTile label="Patients (all tenants)" value={analytics.data.total_patients.toLocaleString("en-IN")} />
                <StatTile label="Billed revenue (all tenants)" value={INR.format(analytics.data.total_revenue)} />
              </div>

              <Card>
                <CardHeader>
                  <div className="text-[13px] font-semibold">Module adoption</div>
                  <div className="text-[12px] text-ink-4">share of active hospitals with each module enabled</div>
                </CardHeader>
                <div className="p-3.5 flex flex-col gap-2">
                  {moduleAdoption.length === 0 && <EmptyState message="No module adoption data yet." />}
                  {moduleAdoption.map(([moduleKey, percent]) => (
                    <div key={moduleKey} className="flex items-center gap-2.5 text-[12.5px]">
                      <div className="w-[140px] shrink-0 capitalize text-ink-3 truncate">{moduleKey}</div>
                      <div className="flex-1 h-2 rounded-full bg-page overflow-hidden">
                        <div className="h-full bg-brand rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="w-[52px] shrink-0 text-right font-semibold tabular-nums">{percent}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {activeTab === "subscriptions" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <div className="text-[13px] font-semibold">Tenant Subscriptions & Hospital Modules</div>
                <div className="text-[12px] text-ink-4">
                  hospital accounts, subscription plans, module entitlements & tenant operational controls
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsOnboardModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <span>✨</span>
                <span>+ Onboard Hospital</span>
              </Button>
            </div>
          </CardHeader>
          <div className="px-3.5 overflow-x-auto">
            <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.7fr_0.8fr_0.8fr_1.8fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[1150px]">
              <div>Hospital / Subdomain</div>
              <div>Tier</div>
              <div>Cycle</div>
              <div>Base price</div>
              <div>Seats</div>
              <div>Modules</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {subscriptions.isLoading && <LoadingState />}
            {subscriptions.isError && <ErrorState />}
            {filteredSubscriptions.map((s) => {
              const matchedHosp = hospitalsMap.get(String(s.hospital)) || hospitalsMap.get(s.hospital_name || "")
              return (
                <SubscriptionRow
                  key={s.id}
                  subscription={s}
                  hospital={matchedHosp}
                  onInspect={handleInspect}
                  onConfigureModules={(h) => setModulesHospital(h)}
                />
              )
            })}
            {filteredSubscriptions.length === 0 && (
              <EmptyState message={searchQuery || selectedHospitalId !== "all" ? "No tenant subscriptions matching your search." : "No tenant subscriptions yet."} />
            )}
          </div>
        </Card>
      )}


      {activeTab === "invoices" && (
        <Card>
          <CardHeader>
            <div>
              <div className="text-[13px] font-semibold">Tenant invoices</div>
              <div className="text-[12px] text-ink-4">platform billing — invoice numbers are server-generated and gapless per financial year</div>
            </div>
          </CardHeader>
          <div className="px-3.5 overflow-x-auto">
            <div className="grid grid-cols-[1.1fr_1.2fr_1.2fr_0.8fr_0.8fr_1.2fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[1000px]">
              <div>Invoice</div>
              <div>Hospital</div>
              <div>Period</div>
              <div>Amount</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {invoices.isLoading && <LoadingState />}
            {invoices.isError && <ErrorState />}
            {filteredInvoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)}
            {filteredInvoices.length === 0 && (
              <EmptyState message={searchQuery || selectedHospitalId !== "all" ? "No tenant invoices matching your search." : "No invoices raised yet."} />
            )}
          </div>
        </Card>
      )}

      {activeTab === "usage" && (
        <Card>
          <CardHeader>
            <div>
              <div className="text-[13px] font-semibold">Tenant usage</div>
              <div className="text-[12px] text-ink-4">computed monthly by a scheduled job, not live per request</div>
            </div>
          </CardHeader>
          <div className="px-3.5 overflow-x-auto">
            <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.8fr_0.8fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[900px]">
              <div>Hospital</div>
              <div>Period</div>
              <div>Staff</div>
              <div>Patients</div>
              <div>Bills</div>
              <div>Storage</div>
            </div>
            {usage.isLoading && <LoadingState />}
            {usage.isError && <ErrorState />}
            {filteredUsage.map((u) => (
              <div key={u.id} className="grid grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.8fr_0.8fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[900px]">
                <div className="font-semibold truncate">{u.hospital_name ?? u.hospital}</div>
                <div className="text-ink-4 text-[12px]">{formatDate(u.period_start)}</div>
                <div className="tabular-nums">{u.active_staff_count}</div>
                <div className="tabular-nums">{u.patients_registered_count.toLocaleString("en-IN")}</div>
                <div className="tabular-nums">{u.bills_generated_count.toLocaleString("en-IN")}</div>
                <div className="tabular-nums">{formatBytes(u.storage_bytes_used)}</div>
              </div>
            ))}
            {filteredUsage.length === 0 && (
              <EmptyState message={searchQuery || selectedHospitalId !== "all" ? "No usage records matching your search." : "No usage snapshots computed yet."} />
            )}
          </div>
        </Card>
      )}

      {activeTab === "tickets" && (
        <Card>
          <CardHeader className="justify-between">
            <div>
              <div className="text-[13px] font-semibold">Support tickets</div>
              <div className="text-[12px] text-ink-4">raised by hospital staff across every tenant</div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={unresolvedOnly ? "primary" : "secondary"} onClick={() => setUnresolvedOnly(true)}>
                Open
              </Button>
              <Button size="sm" variant={unresolvedOnly ? "secondary" : "primary"} onClick={() => setUnresolvedOnly(false)}>
                All
              </Button>
            </div>
          </CardHeader>
          <div className="px-3.5 overflow-x-auto">
            <div className="grid grid-cols-[1.2fr_1.6fr_0.8fr_0.9fr_1.8fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[1000px]">
              <div>Hospital</div>
              <div>Ticket</div>
              <div>Priority</div>
              <div>Status</div>
              <div>Resolution</div>
            </div>
            {tickets.isLoading && <LoadingState />}
            {tickets.isError && <ErrorState />}
            {filteredTickets.map((t) => <TicketRow key={t.id} ticket={t} />)}
            {filteredTickets.length === 0 && (
              <EmptyState message={searchQuery || selectedHospitalId !== "all" ? "No support tickets matching your search." : unresolvedOnly ? "No open tickets." : "No support tickets raised yet."} />
            )}
          </div>
        </Card>
      )}

      {isOnboardModalOpen && (
        <TenantOnboardModal
          onClose={() => setIsOnboardModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["saas-subscriptions"] })
            queryClient.invalidateQueries({ queryKey: ["saas-hospitals"] })
          }}
          onSubmit={async (payload: OnboardTenantPayload) => {
            return await onboardHospital(payload)
          }}
        />
      )}

      {modulesHospital && (
        <TenantModulesModal
          hospital={modulesHospital}
          onClose={() => setModulesHospital(null)}
          onSave={async (modules: string[]) => {
            await updateModulesMutation.mutateAsync({ id: modulesHospital.id, modules })
          }}
          isSaving={updateModulesMutation.isPending}
        />
      )}
    </div>
  )
}

