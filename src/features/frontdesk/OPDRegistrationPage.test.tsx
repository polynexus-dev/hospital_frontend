import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OPDRegistrationPage } from "./OPDRegistrationPage"

vi.mock("../../api/frontdesk", () => ({
  listOptions: vi.fn(async (path: string) => {
    if (path.startsWith("/doctors/")) return [{ id: 7, name: "Mehta", department: 1, speciality: "Medicine" }]
    if (path.startsWith("/departments/")) return [{ id: 1, name: "General Medicine" }]
    return []
  }),
  listStates: vi.fn(async () => [{ name: "Maharashtra", is_union_territory: false }]),
  listDistricts: vi.fn(async () => []),
  listApprovers: vi.fn(async () => []),
  lookupPincode: vi.fn(async () => ({ pincode: "411038", found: true, state: "Maharashtra", district: "Pune", sub_districts: ["Haveli"], areas: ["Kothrud"] })),
  checkDuplicates: vi.fn(async () => []),
  advanceBalance: vi.fn(async () => ({ balance: "0" })),
  printDocument: vi.fn(),
  previewVisit: vi.fn(async () => ({
    visit_type: "new", visit_type_label: "New visit", reason: "New patient", last_paid_visit: null,
    charges: [{ description: "Registration fee", amount: "100.00", source: "registration" }, { description: "Consultation - Dr. Mehta", amount: "500.00", source: "consultation" }],
    total: "600.00", warnings: [], advance_balance: "0",
    policy: { discount_limit_percent: "10", credit_payer_types: ["corporate"], round_down_to_rupee: true, default_rate_category: "general" },
  })),
  registerVisit: vi.fn(async () => ({
    patient: { id: 1, uhid: "TEST-000001", full_name: "Sunita Patil" },
    visit: { id: 5, visit_number: "OP261012-0001", token: 3, visit_type_label: "New visit", doctor_name: "Mehta", department_name: "General Medicine" },
    bill: { id: 9, bill_number: "INV26000001", status: "paid", total: "600.00", discount: "0", round_off: "0", net: "600.00" },
    assessment: "New patient", warnings: [], awaiting_discount_approval: null,
    links: { receipt: "/api/v1/frontdesk/visits/5/receipt/", card: "/api/v1/frontdesk/patients/1/card/", sticker: "/api/v1/frontdesk/patients/1/sticker/" },
  })),
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><OPDRegistrationPage /></QueryClientProvider>)
}

describe("OPDRegistrationPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("registers a new patient, bills and collects in one save", async () => {
    const { registerVisit } = await import("../../api/frontdesk")
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/^first name/i), "Sunita")
    await user.type(screen.getByLabelText(/^last name/i), "Patil")
    await user.selectOptions(screen.getByLabelText(/^gender/i), "female")
    await user.type(screen.getByLabelText("Mobile number"), "9876501234")
    await user.type(screen.getByLabelText("PIN code"), "411038")
    await waitFor(() => expect(screen.getByLabelText(/^state$/i)).toHaveValue("Maharashtra"))

    await waitFor(() => expect(screen.getByRole("option", { name: /Dr\. Mehta/ })).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText(/^doctor/i), "7")
    await waitFor(() => expect(screen.getByText("Consultation - Dr. Mehta")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /register & collect ₹600\.00/i }))
    await waitFor(() => expect(screen.getByText("TEST-000001")).toBeInTheDocument())

    const body = vi.mocked(registerVisit).mock.calls[0][0] as Record<string, any>
    expect(body.patient).toMatchObject({ first_name: "Sunita", last_name: "Patil", gender: "female", mobile: "9876501234", state: "Maharashtra", district: "Pune" })
    expect(body.visit).toMatchObject({ doctor: "7", payer_type: "self" })
    expect(body.billing.payments).toEqual([{ method: "cash", amount: "600.00", reference: "" }])
    expect(screen.getByText("3")).toBeInTheDocument() // queue token
  })

  it("only offers credit for payers the hospital allows", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByRole("option", { name: /Dr\. Mehta/ })).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText(/^doctor/i), "7")
    await waitFor(() => expect(screen.getByText(/credit \(not for this payer\)/i)).toBeInTheDocument())
    await user.click(screen.getByRole("radio", { name: "Corporate" }))
    await waitFor(() => expect(screen.getByLabelText(/^credit$/i)).not.toBeDisabled())
  })
})
