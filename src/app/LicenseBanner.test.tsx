import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LicenseBanner } from "./LicenseBanner"
import { getLicenseStatus } from "../api/licensing"
import { useAuthStore } from "../store/auth"
import type { LicenseStatus, User } from "../types/api"

vi.mock("../api/licensing", () => ({ getLicenseStatus: vi.fn() }))

function renderAs(permissions: string[], status: LicenseStatus) {
  vi.mocked(getLicenseStatus).mockResolvedValue(status)
  useAuthStore.setState({ user: { id: 1, email: "u@x.in", permissions } as unknown as User })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><LicenseBanner /></MemoryRouter>
    </QueryClientProvider>,
  )
}

const support = { email: "support@polynexus.in", phone: "" }

describe("LicenseBanner", () => {
  beforeEach(() => vi.clearAllMocks())

  it("warns hospital admins before expiry, with days left and support contact", async () => {
    renderAs(["accounts.change_user"], { mode: "on_premise", state: "expiring_soon", days_left: 12, support })
    expect(await screen.findByText("License expires in 12 days.")).toBeInTheDocument()
    expect(screen.getByText(/support@polynexus.in/)).toBeInTheDocument()
  })

  it("tells every user when the system is read-only", async () => {
    renderAs([], { mode: "on_premise", state: "expired", support })
    expect(await screen.findByText(/read-only archive mode/)).toBeInTheDocument()
    expect(screen.queryByText("License settings")).not.toBeInTheDocument()
  })

  it("stays hidden from non-admins before expiry", async () => {
    const { container } = renderAs([], { mode: "on_premise", state: "expiring_soon", days_left: 12, support })
    await vi.waitFor(() => expect(getLicenseStatus).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
