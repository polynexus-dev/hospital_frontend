import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "../../store/auth"
import { LoginPage } from "./LoginPage"

vi.mock("../../api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/auth")>()
  return { ...actual, login: vi.fn(), verifyMfa: vi.fn(), fetchMe: vi.fn() }
})

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard content</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe("LoginPage", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
    vi.clearAllMocks()
  })

  it("logs straight in when the account has no MFA challenge", async () => {
    const { login, fetchMe } = await import("../../api/auth")
    vi.mocked(login).mockResolvedValue({ access: "acc-1", refresh: "ref-1" })
    // @ts-expect-error partial User for this test
    vi.mocked(fetchMe).mockResolvedValue({ id: 1, email: "doc@test-hospital.example" })

    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), "doc@test-hospital.example")
    await user.type(screen.getByLabelText(/^password$/i), "correct-password")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => expect(screen.getByText("Dashboard content")).toBeInTheDocument())
    expect(useAuthStore.getState().accessToken).toBe("acc-1")
  })

  it("switches to the OTP step when the account has MFA enabled, then verifies", async () => {
    const { login, verifyMfa, fetchMe } = await import("../../api/auth")
    vi.mocked(login).mockResolvedValue({ mfa_required: true, mfa_token: "challenge-token" })
    vi.mocked(verifyMfa).mockResolvedValue({ access: "acc-2", refresh: "ref-2" })
    // @ts-expect-error partial User for this test
    vi.mocked(fetchMe).mockResolvedValue({ id: 2, email: "owner@test-hospital.example" })

    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), "owner@test-hospital.example")
    await user.type(screen.getByLabelText(/^password$/i), "correct-password")
    await user.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument())
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/6-digit code/i), "123456")
    await user.click(screen.getByRole("button", { name: /verify/i }))

    await waitFor(() => expect(screen.getByText("Dashboard content")).toBeInTheDocument())
    expect(verifyMfa).toHaveBeenCalledWith("challenge-token", "123456")
    expect(useAuthStore.getState().accessToken).toBe("acc-2")
  })

  it("shows an error and lets the user retry on a wrong OTP", async () => {
    const { login, verifyMfa } = await import("../../api/auth")
    const { ApiError } = await import("../../api/client")
    vi.mocked(login).mockResolvedValue({ mfa_required: true, mfa_token: "challenge-token" })
    vi.mocked(verifyMfa).mockRejectedValue(new ApiError(400, { otp: "Invalid code." }, "bad otp"))

    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), "owner@test-hospital.example")
    await user.type(screen.getByLabelText(/^password$/i), "correct-password")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/6-digit code/i), "000000")
    await user.click(screen.getByRole("button", { name: /verify/i }))

    await waitFor(() => expect(screen.getByText(/invalid or expired code/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument() // still on the OTP step
  })

  it("returns to the credentials step from the OTP step via Back", async () => {
    const { login } = await import("../../api/auth")
    vi.mocked(login).mockResolvedValue({ mfa_required: true, mfa_token: "challenge-token" })

    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), "owner@test-hospital.example")
    await user.type(screen.getByLabelText(/^password$/i), "correct-password")
    await user.click(screen.getByRole("button", { name: /sign in/i }))
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /back/i }))

    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
  })
})
