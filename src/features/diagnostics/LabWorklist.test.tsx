import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { LabWorklist } from "./LabWorklist"
import { labWorklist } from "../../api/laboratory"

vi.mock("../../api/laboratory", async (orig) => ({
  ...(await orig<typeof import("../../api/laboratory")>()),
  labWorklist: vi.fn().mockResolvedValue([
    { order: 7, order_number: "LAB2610140001", patient: 1, patient_name: "Meera", uhid: "UH1", priority: "stat", ordered_at: "2026-10-14T08:00:00Z",
      test: 3, test_name: "Haemoglobin", test_code: "HB", department: "hematology", status: "collected", result: null, value: "", unit: "g/dL",
      flag: "", calculated: false, due_at: "2026-10-14T10:00:00Z", overdue: true },
    { order: 7, order_number: "LAB2610140001", patient: 1, patient_name: "Meera", uhid: "UH1", priority: "stat", ordered_at: "2026-10-14T08:00:00Z",
      test: 4, test_name: "LDL", test_code: "LDL", department: "biochemistry", status: "resulted", result: 9, value: "400", unit: "mg/dL",
      flag: "critical", calculated: true, due_at: null, overdue: false },
  ]),
}))

describe("LabWorklist", () => {
  it("shows one row per test and opens its order", async () => {
    const onOpen = vi.fn()
    render(<QueryClientProvider client={new QueryClient()}><LabWorklist onOpenOrder={onOpen} /></QueryClientProvider>)
    expect(await screen.findByText("Haemoglobin")).toBeInTheDocument()
    expect(screen.getByText(/overdue/)).toBeInTheDocument()
    expect(screen.getByText("calc")).toBeInTheDocument()
    expect(screen.getByText("critical")).toBeInTheDocument()
    await userEvent.click(screen.getByText("LDL"))
    expect(onOpen).toHaveBeenCalledWith(7)
  })

  it("filters by department and stage", async () => {
    render(<QueryClientProvider client={new QueryClient()}><LabWorklist onOpenOrder={vi.fn()} /></QueryClientProvider>)
    await userEvent.selectOptions(screen.getByLabelText("Department"), "hematology")
    await userEvent.selectOptions(screen.getByLabelText("Stage"), "resulted")
    expect(labWorklist).toHaveBeenLastCalledWith({ department: "hematology", status: "resulted", priority: "" })
  })
})
