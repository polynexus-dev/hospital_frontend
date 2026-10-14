import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { BillAdjustModal } from "./BillAdjustModal"
import { api } from "../../api/client"
import type { Bill } from "../../types/api"

vi.mock("../../api/client", async (orig) => ({
  ...(await orig<typeof import("../../api/client")>()),
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn() },
}))

const bill = { id: 7, bill_number: "INV26000007", patient: 1, admission: null, total_amount: "6000", discount_amount: "0", net_amount: "6144", status: "unpaid", created_at: "", patient_category: "general", on_hold: false, items: [], payments: [] } as unknown as Bill

describe("BillAdjustModal", () => {
  it("puts a bill on hold with a reason", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ ...bill, on_hold: true, hold_reason: "Insurer query" })
    const changed = vi.fn()
    render(<BillAdjustModal bill={bill} onClose={vi.fn()} onChanged={changed} />)
    await userEvent.click(screen.getByRole("tab", { name: "Put on hold" }))
    const button = screen.getByRole("button", { name: "Put on hold" })
    expect(button).toBeDisabled()
    await userEvent.type(screen.getByLabelText("Reason"), "Insurer query")
    await userEvent.click(button)
    expect(api.post).toHaveBeenCalledWith("/billing/bills/7/hold/", { reason: "Insurer query" })
    expect(await screen.findByText("On hold")).toBeInTheDocument()
    expect(changed).toHaveBeenCalled()
  })
})
