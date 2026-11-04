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
    useAuthStore.setState({ accessToken: null, user: null })
    vi.clearAllMocks()
  })

  it("redirects to /login when nobody is signed in", () => {
    renderProtected()
    expect(screen.getByText("Login screen")).toBeInTheDocument()
  })

  it("renders the protected content immediately when a user is already in the store", async () => {
    const { fetchMe } = await import("../api/auth")
    vi.mocked(fetchMe).mockResolvedValue(undefined as never)
    // @ts-expect-error partial User for this test
    useAuthStore.setState({ user: { id: 1, email: "x@example.com" } })
    renderProtected()
    expect(screen.getByText("Dashboard content")).toBeInTheDocument()
  })

  it("redirects to /login once the session turns out to be gone (refresh failed -> logout)", async () => {
    const { fetchMe } = await import("../api/auth")
    vi.mocked(fetchMe).mockImplementation(async () => {
      useAuthStore.getState().logout() // what the API client does when the refresh cookie is rejected
      throw new Error("401")
    })
    // @ts-expect-error partial User for this test
    useAuthStore.setState({ user: { id: 1, email: "x@example.com" } })

    renderProtected()

    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument())
  })

  it("refreshes a cached user in the background so new permissions show up", async () => {
    const { fetchMe } = await import("../api/auth")
    // @ts-expect-error partial User for this test
    vi.mocked(fetchMe).mockResolvedValue({ id: 1, email: "x@example.com", permissions: ["governance.view_auditrule"] })
    // @ts-expect-error partial User for this test
    useAuthStore.setState({ user: { id: 1, email: "x@example.com", permissions: [] } })
    renderProtected()
    expect(screen.getByText("Dashboard content")).toBeInTheDocument() // no wait for the network
    await waitFor(() => expect(useAuthStore.getState().user?.permissions).toEqual(["governance.view_auditrule"]))
  })
})
