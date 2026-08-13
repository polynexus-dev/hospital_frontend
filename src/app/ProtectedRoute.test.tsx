import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore } from "../store/auth"
import { ProtectedRoute } from "./ProtectedRoute"

vi.mock("../api/auth", () => ({
  fetchMe: vi.fn(),
}))

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Dashboard content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
    vi.clearAllMocks()
  })

  it("redirects to /login when there is no refresh token at all", () => {
    renderProtected()
    expect(screen.getByText("Login screen")).toBeInTheDocument()
  })

  it("renders the protected content immediately when a user is already in the store", () => {
    // @ts-expect-error partial User for this test
    useAuthStore.setState({ refreshToken: "r1", user: { id: 1, email: "x@example.com" } })
    renderProtected()
    expect(screen.getByText("Dashboard content")).toBeInTheDocument()
  })

  it("fetches the current user when a refresh token exists but no user is loaded yet, then renders", async () => {
    const { fetchMe } = await import("../api/auth")
    // @ts-expect-error partial User for this test
    vi.mocked(fetchMe).mockResolvedValue({ id: 1, email: "x@example.com", hospital_name: "Test Hospital" })
    useAuthStore.setState({ refreshToken: "r1", user: null })

    renderProtected()

    await waitFor(() => expect(screen.getByText("Dashboard content")).toBeInTheDocument())
    expect(useAuthStore.getState().user?.email).toBe("x@example.com")
  })

  it("logs out and redirects to /login when fetching the current user fails", async () => {
    const { fetchMe } = await import("../api/auth")
    vi.mocked(fetchMe).mockRejectedValue(new Error("401"))
    useAuthStore.setState({ refreshToken: "r1", user: null })

    renderProtected()

    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument())
    expect(useAuthStore.getState().refreshToken).toBeNull()
  })
})
