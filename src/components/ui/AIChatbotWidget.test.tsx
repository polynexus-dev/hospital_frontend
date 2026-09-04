import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "../../store/auth"
import { AIChatbotWidget } from "./AIChatbotWidget"

vi.mock("../../api/communications", () => ({
  postInteractiveChatAction: vi.fn(),
}))

function renderWidget() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AIChatbotWidget />
    </QueryClientProvider>
  )
}

describe("AIChatbotWidget", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
    vi.clearAllMocks()
  })

  it("starts closed, showing only the floating toggle button", () => {
    renderWidget()
    expect(screen.getByText("Polynexus HMS Bot")).toBeInTheDocument()
    expect(screen.queryByText("Instant OPD booking & information")).not.toBeInTheDocument()
  })

  it("shows the real hospital name in the footer, not a hardcoded one, once opened", async () => {
    // @ts-expect-error partial User for this test
    useAuthStore.setState({ user: { id: 1, email: "x@example.com", hospital_name: "Swasthyam Superspeciality Hospital" } })
    const { postInteractiveChatAction } = await import("../../api/communications")
    vi.mocked(postInteractiveChatAction).mockResolvedValue({ text: "Hello!", options: [], step: "main_menu", reply: "Hello!" })

    renderWidget()
    await userEvent.click(screen.getByText("Polynexus HMS Bot"))

    expect(await screen.findByText("Swasthyam Superspeciality Hospital")).toBeInTheDocument()
  })

  it("falls back to a generic label instead of a hardcoded hospital name when none is set", async () => {
    const { postInteractiveChatAction } = await import("../../api/communications")
    vi.mocked(postInteractiveChatAction).mockResolvedValue({ text: "Hello!", options: [], step: "main_menu", reply: "Hello!" })

    renderWidget()
    await userEvent.click(screen.getByText("Polynexus HMS Bot"))

    expect(await screen.findByText("Your Hospital")).toBeInTheDocument()
  })

  it("triggers the main_menu action on open and renders the returned options", async () => {
    const { postInteractiveChatAction } = await import("../../api/communications")
    vi.mocked(postInteractiveChatAction).mockResolvedValue({
      text: "Please select an option below:",
      options: [{ id: "book_opd", label: "Book OPD Appointment" }],
      step: "main_menu",
      reply: "Please select an option below:",
    })

    renderWidget()
    await userEvent.click(screen.getByText("Polynexus HMS Bot"))

    expect(await screen.findByText("Please select an option below:")).toBeInTheDocument()
    expect(await screen.findByText("Book OPD Appointment")).toBeInTheDocument()
    // react-query's useMutation invokes mutationFn with an extra internal
    // context argument beyond the payload — assert on the payload itself
    // (what the widget controls), not react-query's calling convention.
    expect(vi.mocked(postInteractiveChatAction).mock.calls[0][0]).toMatchObject({ action: "main_menu", language: "en" })
  })

  it("renders a booking-details form when the backend response requires input", async () => {
    const { postInteractiveChatAction } = await import("../../api/communications")
    vi.mocked(postInteractiveChatAction).mockResolvedValue({
      text: "Please share the patient's name and mobile number.",
      options: [],
      step: "collect_details",
      requires_input: ["name", "mobile"],
      pending_slot_id: 42,
      reply: "",
    })

    renderWidget()
    await userEvent.click(screen.getByText("Polynexus HMS Bot"))

    expect(await screen.findByPlaceholderText("Patient name")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Mobile number")).toBeInTheDocument()
    expect(screen.getByText("Confirm Booking")).toBeDisabled() // no mobile typed yet
  })

  it("switching language resets the conversation and re-triggers main_menu in the new language", async () => {
    const { postInteractiveChatAction } = await import("../../api/communications")
    vi.mocked(postInteractiveChatAction).mockResolvedValue({ text: "Hello!", options: [], step: "main_menu", reply: "" })

    renderWidget()
    await userEvent.click(screen.getByText("Polynexus HMS Bot"))
    await waitFor(() => expect(postInteractiveChatAction).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByText("मराठी"))

    await waitFor(() => {
      const calls = vi.mocked(postInteractiveChatAction).mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({ action: "main_menu", language: "mr" })
    })
  })
})
