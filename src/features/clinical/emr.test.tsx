import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { api } from "../../api/client"
import { PatientHeaderCards } from "./PatientHeaderCards"
import { SpecialtyAssessmentSection } from "../nabh/ClinicalTemplates"

vi.mock("../../api/client", async (orig) => ({
  ...(await orig<typeof import("../../api/client")>()),
  api: { get: vi.fn(), post: vi.fn().mockResolvedValue({}) },
}))

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

describe("PatientHeaderCards", () => {
  it("headlines allergies, conditions, surgeries and high risks", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      patient: { id: 1, name: "Anu", uhid: "U1", age: 4, gender: "female", blood_group: "" },
      allergies: [{ allergen: "Penicillin", severity: "severe", reaction: "Rash" }], conditions: [{ condition: "Asthma", since: "2023" }],
      surgeries: [{ procedure: "Hernia repair", year: "2024" }], family: [], habits: {}, obstetric: {},
      risks: [{ tool: "Humpty Dumpty (paediatric falls)", level: "high", score: 17 }], alerts: 2, last_vitals: null,
    })
    wrap(<PatientHeaderCards patientId={1} />)
    expect(await screen.findByText(/Penicillin/)).toBeInTheDocument()
    expect(screen.getByText("Asthma (2023)")).toBeInTheDocument()
    expect(screen.getByText("Hernia repair · 2024")).toBeInTheDocument()
    expect(screen.getByText(/Humpty Dumpty.*high/)).toBeInTheDocument()
    expect(screen.getByText("Allergies · 2 alerts")).toBeInTheDocument()
  })
})

describe("SpecialtyAssessmentSection", () => {
  it("reloads the last answers when the case is the same complaint", async () => {
    const template = { id: 5, name: "Asthma review", category: "pulmonology", setting: "opd", is_active: true,
      fields: [{ key: "peak_flow", label: "Peak flow", type: "number" }] }
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path.startsWith("/clinical/assessment-templates/")) return { results: [template] }
      if (path.startsWith("/clinical/assessments/?encounter=")) return { results: [] }
      if (path.startsWith("/clinical/assessments/?patient=")) return { results: [{ id: 1, encounter: 3, assessed_at: "2026-09-01T10:00:00Z", data: { peak_flow: 320 } }] }
      return {}
    })
    wrap(<SpecialtyAssessmentSection encounterId={9} patientId={1} caseType="new_complaint" />)
    await userEvent.selectOptions(await screen.findByRole("combobox"), await screen.findByRole("option", { name: "Asthma review" }))
    await userEvent.click(screen.getByRole("button", { name: "Same complaint (follow-up)" }))
    expect(api.post).toHaveBeenCalledWith("/opd/encounters/9/case-type/", { case_type: "old_complaint" })
    expect(await screen.findByText(/Loaded from the assessment of/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByDisplayValue("320")).toBeInTheDocument())
  })
})
