import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import { api } from "../../api/client"
import { AbdmRecordsCard } from "./AbdmRecordsCard"

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AbdmRecordsCard patientId={7} />
    </QueryClientProvider>,
  )
}

const received = {
  id: 1, hip_id: "CITY-CLINIC", title: "Prescription", checksum_ok: true, care_context_reference: "rx-1", created_at: "2026-10-29T10:00:00Z",
  bundle: { entry: [
    { resource: { resourceType: "Composition", title: "Prescription" } },
    { resource: { resourceType: "MedicationRequest", medicationCodeableConcept: { text: "Amlodipine 5mg" } } },
  ] },
}

describe("AbdmRecordsCard", () => {
  afterEach(() => vi.restoreAllMocks())

  it("links the selected records to the patient's ABHA", async () => {
    vi.spyOn(api, "get").mockImplementation(async (path: string) => {
      if (path.startsWith("/abdm/abha-links/?")) return { results: [{ id: 3, status: "linked", abha_address: "asha@sbx" }] }
      if (path === "/abdm/abha-links/3/records/") return [
        { reference: "prescription:9", display: "Prescription — 29 Oct 2026", hi_type: "Prescription", status: "unlinked" },
        { reference: "lab:4", display: "Lab report — 28 Oct 2026", hi_type: "DiagnosticReport", status: "linked" },
      ]
      return { results: [] }
    })
    const post = vi.spyOn(api, "post").mockResolvedValue({})
    const user = userEvent.setup()
    renderCard()

    await user.click(await screen.findByLabelText("Link Prescription — 29 Oct 2026"))
    await user.click(screen.getByRole("button", { name: /link selected to abha/i }))

    await waitFor(() => expect(post).toHaveBeenCalledWith("/abdm/abha-links/3/link_records/", { references: ["prescription:9"] }))
    expect(screen.queryByLabelText("Link Lab report — 28 Oct 2026")).not.toBeInTheDocument() // already linked
  })

  it("shows what other providers sent, summarised from the FHIR document", async () => {
    vi.spyOn(api, "get").mockImplementation(async (path: string) => (path.startsWith("/abdm/received-records/") ? { results: [received] } : { results: [] }))
    const user = userEvent.setup()
    renderCard()

    await user.click(await screen.findByRole("button", { name: /prescription/i }))
    expect(screen.getByText("From CITY-CLINIC", { exact: false })).toBeInTheDocument()
    expect(screen.getByText("Medication Request: Amlodipine 5mg")).toBeInTheDocument()
  })
})
