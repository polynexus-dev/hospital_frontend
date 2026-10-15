import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { api } from "../../api/client"
import type { OTSchedule } from "../../types/api"
import { OTBoard } from "./OTBoard"
import { OTChargesModal } from "./OTChargesModal"

vi.mock("../../api/client", async (orig) => ({
  ...(await orig<typeof import("../../api/client")>()),
  api: { get: vi.fn(), post: vi.fn() },
}))

const base = { surgery_request: 1, room: "OT-1", status: "scheduled", actual_start: null, actual_end: null, patient_uhid: "UH1", procedure: "Hernia repair", encounter_overridden: false, priority: "elective", grade: "Major", surgeon: "Dr. Rao", assistant: "", anaesthetist: "Dr. Das", cancellation_reason: "", charges_posted_at: null }

describe("OTBoard", () => {
  it("colours each case by encounter and shows the day's counts", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      date: "2026-10-12", rooms: ["OT-1", "OT-2"], counts: { opd: 1, ipd: 1, emergency: 0 },
      cases: [
        { ...base, id: 1, patient_name: "Meena Pillai", encounter: "opd", scheduled_start: "2026-10-12T03:30:00Z", scheduled_end: "2026-10-12T04:30:00Z" },
        { ...base, id: 2, room: "OT-2", patient_name: "Ravi Kale", encounter: "ipd", scheduled_start: "2026-10-12T05:30:00Z", scheduled_end: "2026-10-12T07:30:00Z" },
        { ...base, id: 3, room: "OT-2", patient_name: "Asha Rao", encounter: "emergency", priority: "emergency", status: "cancelled", cancellation_reason: "No blood", scheduled_start: "2026-10-12T09:30:00Z", scheduled_end: "2026-10-12T10:30:00Z" },
      ],
    })
    render(<OTBoard />)
    const opd = (await screen.findByText("Meena Pillai")).closest("div.rounded-lg")!
    expect(opd.className).toContain("border-l-accent")
    expect(screen.getByText("Ravi Kale").closest("div.rounded-lg")!.className).toContain("border-l-brand")
    const emergency = screen.getByText("Asha Rao").closest("div.rounded-lg")!
    expect(emergency.className).toContain("border-l-danger")
    expect(emergency).toHaveTextContent("Cancelled — No blood")
    expect(screen.getByText("OPD / day care · 1")).toBeInTheDocument()
    expect(screen.getByText("Emergency · 0")).toBeInTheDocument()
    expect(vi.mocked(api.get).mock.calls[0][0]).toMatch(/^\/ot\/schedules\/board\/\?date=\d{4}-\d{2}-\d{2}$/)
  })
})

describe("OTChargesModal", () => {
  const schedule = { id: 9, surgery_request: 1, operation_theatre_room: "OT-1", surgeon: 1, anaesthetist: null, scheduled_start: "", scheduled_end: "", status: "completed", charges_posted_at: null } as OTSchedule
  const preview = { grade: "Major", room_category: "private", problem: "", total: "39000", bill: null, bill_number: null, bill_net_amount: null,
    lines: [{ component: "surgeon", description: "Surgeon fee – Hernia repair (Dr. Rao)", amount: "30000", doctor: 1 }, { component: "ot", description: "OT charges – Major, private", amount: "9000", doctor: null }] }

  it("previews the tariff lines and posts them to the bill", async () => {
    vi.mocked(api.get).mockResolvedValueOnce(preview)
    vi.mocked(api.post).mockResolvedValueOnce({ ...preview, bill: 4, bill_number: "INV26000004", bill_net_amount: "41000" })
    const posted = vi.fn()
    render(<OTChargesModal schedule={schedule} onClose={vi.fn()} onPosted={posted} />)
    expect(await screen.findByText("Surgeon fee – Hernia repair (Dr. Rao)")).toBeInTheDocument()
    expect(screen.getByText("₹39,000")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Post to bill" }))
    expect(api.post).toHaveBeenCalledWith("/ot/schedules/9/charges/", {})
    expect(await screen.findByText(/Posted to bill INV26000004/)).toBeInTheDocument()
    expect(posted).toHaveBeenCalled()
  })

  it("explains why a surgery can't be priced and blocks posting", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ ...preview, lines: [], total: 0, problem: "Set the surgery grade on the request to price it." })
    render(<OTChargesModal schedule={schedule} onClose={vi.fn()} onPosted={vi.fn()} />)
    expect(await screen.findByText(/Set the surgery grade/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Post to bill" })).toBeDisabled()
  })
})
