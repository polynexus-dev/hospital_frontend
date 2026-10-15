import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { api } from "../../api/client"
import { LeaveApplyModal } from "./LeaveApplyModal"

vi.mock("../../api/client", async (orig) => ({
  ...(await orig<typeof import("../../api/client")>()),
  api: { get: vi.fn(), post: vi.fn() },
}))

const types = { results: [{ id: 1, code: "CL", name: "Casual leave", when_short: "block" }, { id: 2, code: "SL", name: "Sick leave", when_short: "warn" }] }
const employees = { results: [{ id: 5, employee_code: "N100", designation: "Staff Nurse", user_detail: { first_name: "Neha", last_name: "Joshi" } }] }
const summary = [{ employee: 5, balances: [{ leave_type: 1, available: "3", pending: "1", when_short: "block" }, { leave_type: 2, available: "2", pending: "0", when_short: "warn" }] }]

function mockApi() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith("/hr/leave-types/")) return types
    if (path.startsWith("/hr/employees/")) return employees
    if (path.startsWith("/hr/leave-balances/summary/")) return summary
    return { results: [] }
  })
}

async function fill(typeId: string, start: string, end: string) {
  await screen.findByRole("option", { name: "N100 Neha Joshi" })
  fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "5" } }) // employee picker
  fireEvent.change(screen.getByLabelText("Leave type"), { target: { value: typeId } })
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: start } })
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: end } })
}

describe("LeaveApplyModal", () => {
  it("blocks a request beyond the balance (after pending) on a block type", async () => {
    mockApi()
    render(<LeaveApplyModal onClose={vi.fn()} onSaved={vi.fn()} />)
    await screen.findByText("Casual leave (CL)")
    await fill("1", "2026-03-16", "2026-03-18")
    expect(await screen.findByText(/2 day\(s\) left in 2026 after 1 pending · this request: 3/)).toBeInTheDocument()
    expect(screen.getByText(/doesn't allow a negative balance/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Submit Leave Request" })).toBeDisabled()
  })

  it("warns but allows on a warn type, and sends the leave type and half day", async () => {
    mockApi()
    vi.mocked(api.post).mockResolvedValueOnce({ id: 9 })
    const saved = vi.fn()
    render(<LeaveApplyModal onClose={vi.fn()} onSaved={saved} />)
    await screen.findByText("Sick leave (SL)")
    await fill("2", "2026-03-16", "2026-03-18")
    expect(await screen.findByText(/flagged for the approver/)).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Half day"))
    expect(await screen.findByText(/this request: 0.5/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Submit Leave Request" }))
    expect(api.post).toHaveBeenCalledWith("/hr/leave-requests/", { employee: 5, leave_type_master: 2, start_date: "2026-03-16", end_date: "2026-03-16", half_day: true, reason: "" })
    expect(saved).toHaveBeenCalled()
  })
})
