import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"
import { useAuthStore } from "../store/auth"
import { RequireSaaSAdmin } from "./RequireSaaSAdmin"
import type { User } from "../types/api"

const baseUser: User = {
  id: 1,
  email: "someone@test-hospital.example",
  phone: null,
  first_name: "Some",
  last_name: "One",
  hospital: "h1",
  department: null,
  role: 1,
  role_name: "Front Desk",
  permissions: [],
  preferred_language: "en",
  is_active: true,
  is_staff: false,
  is_superuser: false,
  is_saas_admin: false,
  is_2fa_enabled: false,
  requires_mfa: false,
  date_joined: "2026-01-01T00:00:00Z",
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={["/saas"]}>
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard content</div>} />
        <Route element={<RequireSaaSAdmin />}>
          <Route path="/saas" element={<div>SaaS console content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe("RequireSaaSAdmin", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
  })

  it("redirects an ordinary hospital user to the dashboard", () => {
    useAuthStore.setState({ user: baseUser })
    renderGuarded()
    expect(screen.getByText("Dashboard content")).toBeInTheDocument()
    expect(screen.queryByText("SaaS console content")).not.toBeInTheDocument()
  })

  it("lets an is_saas_admin user through", () => {
    useAuthStore.setState({ user: { ...baseUser, is_saas_admin: true } })
    renderGuarded()
    expect(screen.getByText("SaaS console content")).toBeInTheDocument()
  })

  it("lets a superuser through even without is_saas_admin set", () => {
    // Mirrors apps.core.permissions.IsSaaSAdmin, which is
    // `is_superuser or is_saas_admin` — a superuser created before
    // createsuperuser started setting the flag must still get in.
    useAuthStore.setState({ user: { ...baseUser, is_superuser: true, is_saas_admin: false } })
    renderGuarded()
    expect(screen.getByText("SaaS console content")).toBeInTheDocument()
  })

  it("renders nothing while the user is still unresolved", () => {
    const { container } = renderGuarded()
    expect(container).toBeEmptyDOMElement()
  })
})
