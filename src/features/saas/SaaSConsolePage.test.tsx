import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SaaSConsolePage } from "./SaaSConsolePage"

import type { Paginated, SaaSSupportTicket, TenantInvoice, TenantSubscription } from "../../types/api"

vi.mock("../../api/saas", () => ({
  platformAnalytics: vi.fn(),
  listSubscriptions: vi.fn(),
  updateSubscription: vi.fn(),
  listInvoices: vi.fn(),
  markInvoicePaid: vi.fn(),
  downloadInvoicePdf: vi.fn(),
  listUsageSnapshots: vi.fn(),
  listSaaSTickets: vi.fn(),
  resolveTicket: vi.fn(),
  listHospitals: vi.fn().mockResolvedValue({ count: 0, next: null, previous: null, results: [] }),
  onboardHospital: vi.fn(),
  updateHospitalModules: vi.fn(),
  toggleHospitalStatus: vi.fn(),
  getPublicTenantBranding: vi.fn(),
}))


function page<T>(results: T[]): Paginated<T> {
  return { count: results.length, next: null, previous: null, results }
}

const subscription: TenantSubscription = {
  id: 1,
  hospital: "h1",
  hospital_name: "Apollo Nagpur",
  tier: "pro",
  billing_cycle: "monthly",
  base_price: "12000.00",
  max_staff_users: 50,
  status: "active",
  started_at: "2026-01-01",
  next_billing_date: "2026-10-01",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

const invoice: TenantInvoice = {
  id: 7,
  hospital: "h1",
  hospital_name: "Apollo Nagpur",
  subscription: 1,
  invoice_number: "INV-2026-27-00004",
  billing_period_start: "2026-08-01",
  billing_period_end: "2026-08-31",
  amount: "12000.00",
  status: "unpaid",
  due_date: "2026-09-15",
  paid_at: null,
  payment_receipt: null,
  notes: "",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
}

const ticket: SaaSSupportTicket = {
  id: 3,
  hospital: "h1",
  hospital_name: "Apollo Nagpur",
  raised_by: 5,
  raised_by_email: "frontdesk@apollo.example",
  subject: "Cannot print OPD receipt",
  description: "Printer dialog never opens",
  category: "bug",
  priority: "high",
  status: "open",
  assigned_to: null,
  assigned_to_email: null,
  resolution_notes: "",
  resolved_at: null,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
}

function renderConsole() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <SaaSConsolePage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}


describe("SaaSConsolePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows platform-wide KPIs and module adoption on the overview tab", async () => {
    const { platformAnalytics } = await import("../../api/saas")
    vi.mocked(platformAnalytics).mockResolvedValue({
      total_hospitals: 12,
      active_hospitals: 9,
      total_revenue: 4500000,
      total_patients: 83210,
      module_adoption_percent: { ipd: 77.8, pharmacy: 55.5 },
    })

    renderConsole()

    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument())
    expect(screen.getByText("9")).toBeInTheDocument()
    expect(screen.getByText("83,210")).toBeInTheDocument()
    expect(screen.getByText("77.8%")).toBeInTheDocument()
  })

  it("lists tenant subscriptions and can suspend an active one", async () => {
    const { platformAnalytics, listSubscriptions, updateSubscription } = await import("../../api/saas")
    vi.mocked(platformAnalytics).mockResolvedValue({
      total_hospitals: 1, active_hospitals: 1, total_revenue: 0, total_patients: 0, module_adoption_percent: {},
    })
    vi.mocked(listSubscriptions).mockResolvedValue(page([subscription]))
    vi.mocked(updateSubscription).mockResolvedValue({ ...subscription, status: "suspended" })

    const user = userEvent.setup()
    renderConsole()
    await user.click(screen.getByRole("button", { name: /tenants & subscriptions/i }))

    await waitFor(() => expect(screen.getAllByText("Apollo Nagpur")[0]).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: /suspend/i }))

    expect(updateSubscription).toHaveBeenCalledWith(1, { status: "suspended" })

  })

  it("marks an unpaid invoice as paid", async () => {
    const { platformAnalytics, listInvoices, markInvoicePaid } = await import("../../api/saas")
    vi.mocked(platformAnalytics).mockResolvedValue({
      total_hospitals: 1, active_hospitals: 1, total_revenue: 0, total_patients: 0, module_adoption_percent: {},
    })
    vi.mocked(listInvoices).mockResolvedValue(page([invoice]))
    vi.mocked(markInvoicePaid).mockResolvedValue({ ...invoice, status: "paid" })

    const user = userEvent.setup()
    renderConsole()
    await user.click(screen.getByRole("button", { name: /^invoices$/i }))

    await waitFor(() => expect(screen.getByText("INV-2026-27-00004")).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: /mark paid/i }))

    expect(markInvoicePaid).toHaveBeenCalledWith(7)
  })

  it("resolves a support ticket with notes", async () => {
    const { platformAnalytics, listSaaSTickets, resolveTicket } = await import("../../api/saas")
    vi.mocked(platformAnalytics).mockResolvedValue({
      total_hospitals: 1, active_hospitals: 1, total_revenue: 0, total_patients: 0, module_adoption_percent: {},
    })
    vi.mocked(listSaaSTickets).mockResolvedValue(page([ticket]))
    vi.mocked(resolveTicket).mockResolvedValue({ ...ticket, status: "resolved" })

    const user = userEvent.setup()
    renderConsole()
    await user.click(screen.getByRole("button", { name: /support tickets/i }))

    await waitFor(() => expect(screen.getByText("Cannot print OPD receipt")).toBeInTheDocument())
    await user.type(screen.getByLabelText(/resolution notes for ticket 3/i), "Driver reinstalled")
    await user.click(screen.getByRole("button", { name: /^resolve$/i }))

    expect(resolveTicket).toHaveBeenCalledWith(3, "Driver reinstalled")
  })

  it("defaults the ticket list to open tickets only", async () => {
    const { platformAnalytics, listSaaSTickets } = await import("../../api/saas")
    vi.mocked(platformAnalytics).mockResolvedValue({
      total_hospitals: 1, active_hospitals: 1, total_revenue: 0, total_patients: 0, module_adoption_percent: {},
    })
    vi.mocked(listSaaSTickets).mockResolvedValue(page([]))

    const user = userEvent.setup()
    renderConsole()
    await user.click(screen.getByRole("button", { name: /support tickets/i }))

    await waitFor(() => expect(listSaaSTickets).toHaveBeenCalledWith({ status: "open" }))

    await user.click(screen.getByRole("button", { name: /^all$/i }))
    await waitFor(() => expect(listSaaSTickets).toHaveBeenCalledWith({}))
  })

  it("opens tenant onboarding wizard modal on clicking '+ Onboard Hospital'", async () => {
    const { platformAnalytics } = await import("../../api/saas")
    vi.mocked(platformAnalytics).mockResolvedValue({
      total_hospitals: 1, active_hospitals: 1, total_revenue: 0, total_patients: 0, module_adoption_percent: {},
    })

    const user = userEvent.setup()
    renderConsole()

    const onboardBtn = screen.getAllByRole("button", { name: /\+ onboard hospital/i })[0]
    await user.click(onboardBtn)

    await waitFor(() => expect(screen.getByText(/onboard new hospital tenant/i)).toBeInTheDocument())
    expect(screen.getByText(/1\. hospital profile/i)).toBeInTheDocument()
  })
})

