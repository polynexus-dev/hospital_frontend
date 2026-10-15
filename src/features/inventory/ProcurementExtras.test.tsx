import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { api } from "../../api/client"
import { CaseThreadModal } from "../tpa/InsuranceExtras"
import { CartPanel } from "./ProcurementExtras"

vi.mock("../../api/client", async (orig) => ({
  ...(await orig<typeof import("../../api/client")>()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

describe("CartPanel", () => {
  it("loads the saved cart, saves changes and raises the indent", async () => {
    let cart: { kind: string; header: Record<string, string>; lines: { item: number; quantity: number }[]; saved_at: string } = { kind: "indent", header: { department: "OT" }, lines: [{ item: 3, quantity: 5 }], saved_at: "2026-10-13T10:00:00Z" }
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path.startsWith("/inventory/cart/indent/")) return cart
      if (path.startsWith("/inventory/items/")) return { results: [{ id: 3, name: "Surgical gloves", code: "GLV" }] }
      return { results: [] }
    })
    vi.mocked(api.put).mockResolvedValue(cart)
    vi.mocked(api.post).mockImplementation(async () => {
      cart = { ...cart, header: {}, lines: [] }
      return { number: "SI000004" }
    })
    render(<CartPanel />)
    expect(await screen.findByText("Surgical gloves [GLV]")).toBeInTheDocument()
    expect(screen.getByDisplayValue("OT")).toBeInTheDocument()

    vi.useFakeTimers({ shouldAdvanceTime: true })
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "8" } })
    await act(async () => { vi.advanceTimersByTime(700) })
    expect(api.put).toHaveBeenCalledWith("/inventory/cart/indent/", { header: { department: "OT" }, lines: [{ item: 3, quantity: 8 }] })
    vi.useRealTimers()

    await userEvent.click(screen.getByRole("button", { name: "Raise indent" }))
    expect(api.post).toHaveBeenCalledWith("/inventory/cart/indent/submit/", {})
    expect(await screen.findByText("Indent SI000004 raised.")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("The cart is empty.")).toBeInTheDocument())
  })
})

describe("CaseThreadModal", () => {
  it("shows the thread and records an insurer approval with its amount", async () => {
    vi.mocked(api.get).mockResolvedValue({ results: [
      { id: 1, direction: "in", kind: "query", kind_label: "Query", subject: "Send discharge summary", body: "", amount: null, respond_by: "2099-01-01", received_at: "2026-10-12T09:00:00Z", resolved_at: null, is_open: true, recorded_by_name: "Asha", attachment: null },
    ] })
    vi.mocked(api.post).mockResolvedValue({})
    render(<CaseThreadModal target={{ type: "pre_auth", id: 7, label: "Pre-auth #7" }} onClose={vi.fn()} />)
    expect(await screen.findByText("Send discharge summary")).toBeInTheDocument()
    expect(screen.getByText("Open — reply by 2099-01-01")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "approval" } })
    await userEvent.type(screen.getByLabelText("Subject"), "Approved")
    await userEvent.type(screen.getByLabelText("Amount (₹)"), "60000")
    await userEvent.click(screen.getByRole("button", { name: "Record" }))
    expect(api.post).toHaveBeenCalledWith("/tpa/messages/", { preauth_request: 7, direction: "in", kind: "approval", subject: "Approved", body: "", amount: "60000" })
  })
})
