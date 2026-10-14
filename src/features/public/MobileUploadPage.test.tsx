import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MobileUploadPage } from "./MobileUploadPage"

const info = { hospital: "Sai Hospital", patient: "Ravi", uhid: "•••0042", category: "Insurance card", requirement: "", expires_at: "2026-10-14T12:00:00Z", uploads: 0, max_files: 10, open: true }

function show() {
  render(<MemoryRouter initialEntries={["/m/upload/tok123"]}><Routes><Route path="/m/upload/:token" element={<MobileUploadPage />} /></Routes></MemoryRouter>)
}

afterEach(() => vi.unstubAllGlobals())

describe("MobileUploadPage", () => {
  it("shows who the upload is for and sends a photo", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => info })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...info, uploads: 1, uploaded: "Insurance card (from phone)" }) })
    vi.stubGlobal("fetch", fetchMock)
    show()
    expect(await screen.findByText("For Ravi (UHID •••0042)")).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText("Choose a file"), new File(["%PDF"], "card.pdf", { type: "application/pdf" }))
    expect(await screen.findByText("✓ card.pdf uploaded")).toBeInTheDocument()
    expect(fetchMock.mock.calls[1][0]).toContain("/mobile-upload/tok123/")
    expect(fetchMock.mock.calls[1][1].method).toBe("POST")
  })

  it("explains an expired link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: "This link isn't valid. Ask the hospital staff for a new QR code." }) }))
    show()
    expect(await screen.findByRole("alert")).toHaveTextContent("new QR code")
  })
})
