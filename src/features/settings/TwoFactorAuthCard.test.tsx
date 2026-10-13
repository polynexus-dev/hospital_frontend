import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "../../store/auth"
import { TwoFactorAuthCard } from "./TwoFactorAuthCard"
import type { User } from "../../types/api"

vi.mock("../../api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/auth")>()
  return { ...actual, setup2FA: vi.fn(), enable2FA: vi.fn(), disable2FA: vi.fn(), fetchMe: vi.fn(), list2FADevices: vi.fn().mockResolvedValue([]), remove2FADevice: vi.fn() }
})

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,stub") },
}))

const baseUser: User = {
  id: 1,
  email: "owner@test-hospital.example",
  phone: null,
  first_name: "Owner",
  last_name: "",
  hospital: "h1",
  department: null,
  role: 1,
  role_name: "Owner",
  permissions: [],
  preferred_language: "en",
  is_active: true,
  is_staff: true,
  is_superuser: false,
  is_saas_admin: false,
  is_2fa_enabled: false,
  requires_mfa: true,
  date_joined: "2026-01-01T00:00:00Z",
}

describe("TwoFactorAuthCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: baseUser })
  })

  it("shows the setup-required banner when the role requires MFA but it isn't enabled yet", () => {
    render(<TwoFactorAuthCard />)
    expect(screen.getByText(/requires two-factor authentication/i)).toBeInTheDocument()
  })

  it("walks through setup: fetch QR + secret, confirm with OTP, then reflects enabled", async () => {
    const { setup2FA, enable2FA, fetchMe } = await import("../../api/auth")
    vi.mocked(setup2FA).mockResolvedValue({ secret: "JBSWY3DPEHPK3PXP", provisioning_uri: "otpauth://totp/x" })
    vi.mocked(enable2FA).mockResolvedValue({ is_2fa_enabled: true })
    vi.mocked(fetchMe).mockResolvedValue({ ...baseUser, is_2fa_enabled: true })

    const user = userEvent.setup()
    render(<TwoFactorAuthCard />)

    await user.click(screen.getByRole("button", { name: /set up two-factor authentication/i }))
    await user.click(screen.getByRole("button", { name: /continue/i }))
    await waitFor(() => expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument())

    await user.type(screen.getByLabelText(/6-digit code/i), "654321")
    await user.click(screen.getByRole("button", { name: /confirm and enable/i }))

    expect(enable2FA).toHaveBeenCalledWith("654321")
    await waitFor(() => expect(screen.getByText(/now enabled/i)).toBeInTheDocument())
    expect(useAuthStore.getState().user?.is_2fa_enabled).toBe(true)
  })

  it("rejects an incorrect OTP during setup without leaving the setup step", async () => {
    const { setup2FA, enable2FA } = await import("../../api/auth")
    const { ApiError } = await import("../../api/client")
    vi.mocked(setup2FA).mockResolvedValue({ secret: "SECRET", provisioning_uri: "otpauth://totp/x" })
    vi.mocked(enable2FA).mockRejectedValue(new ApiError(400, { otp: "Invalid code." }, "bad otp"))

    const user = userEvent.setup()
    render(<TwoFactorAuthCard />)
    await user.click(screen.getByRole("button", { name: /set up two-factor authentication/i }))
    await user.click(screen.getByRole("button", { name: /continue/i }))
    await waitFor(() => expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument())

    await user.type(screen.getByLabelText(/6-digit code/i), "000000")
    await user.click(screen.getByRole("button", { name: /confirm and enable/i }))

    await waitFor(() => expect(screen.getByText(/invalid code/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument() // still on the setup step
  })

  it("disables 2FA after the current password is confirmed", async () => {
    useAuthStore.setState({ user: { ...baseUser, is_2fa_enabled: true } })
    const { disable2FA, fetchMe } = await import("../../api/auth")
    vi.mocked(disable2FA).mockResolvedValue({ is_2fa_enabled: false })
    vi.mocked(fetchMe).mockResolvedValue({ ...baseUser, is_2fa_enabled: false })

    const user = userEvent.setup()
    render(<TwoFactorAuthCard />)

    await user.click(screen.getByRole("button", { name: /^disable$/i }))
    await user.type(screen.getByLabelText(/password/i), "current-password")
    await user.click(screen.getByRole("button", { name: /disable two-factor authentication/i }))

    expect(disable2FA).toHaveBeenCalledWith("current-password")
    await waitFor(() => expect(screen.getByText(/has been disabled/i)).toBeInTheDocument())
    expect(useAuthStore.getState().user?.is_2fa_enabled).toBe(false)
  })

  it("names the first app and sends that name", async () => {
    const { setup2FA } = await import("../../api/auth")
    vi.mocked(setup2FA).mockResolvedValue({ secret: "S", provisioning_uri: "otpauth://totp/x" })
    const user = userEvent.setup()
    render(<TwoFactorAuthCard />)
    await user.click(screen.getByRole("button", { name: /set up two-factor authentication/i }))
    const name = screen.getByLabelText(/name for this app/i)
    await user.clear(name)
    await user.type(name, "Work phone")
    await user.click(screen.getByRole("button", { name: /continue/i }))
    expect(setup2FA).toHaveBeenCalledWith("Work phone", "")
  })

  it("adds a second app only with a code from an existing one", async () => {
    useAuthStore.setState({ user: { ...baseUser, is_2fa_enabled: true } })
    const { list2FADevices, setup2FA, enable2FA, fetchMe } = await import("../../api/auth")
    vi.mocked(list2FADevices).mockResolvedValue([{ id: 1, name: "My phone", created_at: "2026-10-01T00:00:00Z", last_used_at: null }])
    vi.mocked(setup2FA).mockResolvedValue({ secret: "NEWSECRET", provisioning_uri: "otpauth://totp/x" })
    vi.mocked(enable2FA).mockResolvedValue({ is_2fa_enabled: true })
    vi.mocked(fetchMe).mockResolvedValue({ ...baseUser, is_2fa_enabled: true })

    const user = userEvent.setup()
    render(<TwoFactorAuthCard />)
    await waitFor(() => expect(screen.getByText("My phone")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /add another authenticator app/i }))
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument()
    const continueButton = screen.getByRole("button", { name: /show qr code/i })
    await user.type(screen.getByLabelText(/name for this app/i), "Backup phone")
    expect(continueButton).toBeDisabled() // no code from the existing app yet
    await user.type(screen.getByLabelText(/current code from an app/i), "123456")
    await user.click(continueButton)
    expect(setup2FA).toHaveBeenCalledWith("Backup phone", "123456")

    await waitFor(() => expect(screen.getByText("NEWSECRET")).toBeInTheDocument())
    expect(screen.getByAltText("TOTP QR code")).toBeInTheDocument()
    expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/6-digit code/i), "654321")
    await user.click(screen.getByRole("button", { name: /confirm and enable/i }))
    await waitFor(() => expect(screen.getByText(/authenticator app added/i)).toBeInTheDocument())
  })

  it("removes one app with the password and keeps 2FA on", async () => {
    useAuthStore.setState({ user: { ...baseUser, is_2fa_enabled: true } })
    const { list2FADevices, remove2FADevice, fetchMe } = await import("../../api/auth")
    vi.mocked(list2FADevices).mockResolvedValue([
      { id: 1, name: "Lost phone", created_at: "2026-10-01T00:00:00Z", last_used_at: null },
      { id: 2, name: "Backup phone", created_at: "2026-10-02T00:00:00Z", last_used_at: null },
    ])
    vi.mocked(remove2FADevice).mockResolvedValue({ is_2fa_enabled: true })
    vi.mocked(fetchMe).mockResolvedValue({ ...baseUser, is_2fa_enabled: true })

    const user = userEvent.setup()
    render(<TwoFactorAuthCard />)
    await waitFor(() => expect(screen.getByText("Lost phone")).toBeInTheDocument())
    await user.click(screen.getAllByRole("button", { name: /^remove$/i })[0])
    await user.type(screen.getByLabelText(/password/i), "current-password")
    await user.click(screen.getByRole("button", { name: /remove this app/i }))

    expect(remove2FADevice).toHaveBeenCalledWith(1, "current-password")
    await waitFor(() => expect(screen.getByText(/authenticator app removed/i)).toBeInTheDocument())
  })
})
