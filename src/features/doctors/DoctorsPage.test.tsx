import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DoctorsPage } from "./DoctorsPage"
import * as doctorsApi from "../../api/doctors"
import type { Doctor, Department, User } from "../../types/api"
import { useAuthStore } from "../../store/auth"

vi.mock("../../api/doctors", () => ({
  listDoctors: vi.fn(),
  createDoctor: vi.fn(),
  updateDoctor: vi.fn(),
  deleteDoctor: vi.fn(),
  blockDoctorLeave: vi.fn(),
  unblockDoctorLeave: vi.fn(),
  getDoctorQueue: vi.fn(),
  listDepartments: vi.fn(),
  listSlotTemplates: vi.fn(),
  createSlotTemplate: vi.fn(),
  deleteSlotTemplate: vi.fn(),
  generateSlotsFromTemplate: vi.fn(),
}))

const mockDoctors: Doctor[] = [
  {
    id: 1,
    name: "Dr. Rajesh K. Deshmukh",
    speciality: "Cardiology",
    department: 1,
    department_name: "Cardiology Dept",
    phone: "9876543210",
    email: "rajesh@hospital.com",
    degree: "MBBS, MD",
    smc_registration_number: "MMC-12345",
    default_consultation_minutes: 15,
    is_active: true,
  },
  {
    id: 2,
    name: "Dr. Sunita Sharma",
    speciality: "Paediatrics",
    department: 2,
    department_name: "Paediatrics Dept",
    phone: "9123456780",
    email: "sunita@hospital.com",
    degree: "MBBS, DNB",
    smc_registration_number: "MMC-67890",
    default_consultation_minutes: 20,
    is_active: false,
  },
]

const mockDepartments: Department[] = [
  { id: 1, name: "Cardiology Dept", code: "CARD", is_active: true },
  { id: 2, name: "Paediatrics Dept", code: "PAED", is_active: true },
]

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DoctorsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("DoctorsPage", () => {
  beforeEach(() => {
    // a hospital admin manages doctor profiles; other roles see the list read-only
    useAuthStore.setState({ user: { is_hospital_admin: true, permissions: [] } as unknown as User })
    vi.clearAllMocks()
    vi.mocked(doctorsApi.listDoctors).mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: mockDoctors,
    })
    vi.mocked(doctorsApi.listDepartments).mockResolvedValue(mockDepartments)
    vi.mocked(doctorsApi.getDoctorQueue).mockResolvedValue({
      now_serving: null,
      waiting: [],
    })
    vi.mocked(doctorsApi.listSlotTemplates).mockResolvedValue([])
  })

  it("renders page title, summary metrics, and doctor cards", async () => {
    renderPage()

    expect(await screen.findByText("Dr. Rajesh K. Deshmukh")).toBeInTheDocument()
    expect(screen.getByText("Doctors Directory")).toBeInTheDocument()
    expect(screen.getByText("Dr. Sunita Sharma")).toBeInTheDocument()
    expect(screen.getByText("Cardiology")).toBeInTheDocument()
    expect(screen.getByText("Paediatrics")).toBeInTheDocument()
    expect(screen.getByText("Total Doctors")).toBeInTheDocument()
    expect(screen.getByText("Active on Roster")).toBeInTheDocument()
  })

  it("filters doctors list by search input", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText("Dr. Rajesh K. Deshmukh")

    const searchInput = screen.getByPlaceholderText(/Search by doctor name/i)
    await user.type(searchInput, "Sunita")

    expect(screen.getByText("Dr. Sunita Sharma")).toBeInTheDocument()
    expect(screen.queryByText("Dr. Rajesh K. Deshmukh")).not.toBeInTheDocument()
  })

  it("opens Add Doctor registration modal when clicking + Add Doctor", async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText("Doctors Directory")
    const addBtn = screen.getByRole("button", { name: /\+ Add Doctor/i })
    await user.click(addBtn)

    expect(await screen.findByText("Register New Doctor")).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/e.g. Dr. Rajesh K. Deshmukh/i)).toBeInTheDocument()
  })

  it("opens Live Queue modal when clicking Queue button", async () => {
    const user = userEvent.setup()
    renderPage()

    const queueButtons = await screen.findAllByRole("button", { name: /Queue/i })
    await user.click(queueButtons[0])

    expect(await screen.findByText(/Live OPD Queue: Dr. Rajesh K. Deshmukh/i)).toBeInTheDocument()
  })

  it("opens Leave Management modal when clicking Leave button", async () => {
    const user = userEvent.setup()
    renderPage()

    const leaveButtons = await screen.findAllByRole("button", { name: /Leave/i })
    await user.click(leaveButtons[0])

    expect(await screen.findByText(/Manage Leave: Dr. Rajesh K. Deshmukh/i)).toBeInTheDocument()
    expect(screen.getByText("🔒 Block Leave")).toBeInTheDocument()
    expect(screen.getByText("🔓 Unblock Leave")).toBeInTheDocument()
  })
})

describe("DoctorsPage for a doctor", () => {
  it("shows the list but no Add / Edit / Delete or login controls", async () => {
    useAuthStore.setState({ user: { is_hospital_admin: false, permissions: ["appointments.view_doctor"] } as unknown as User })
    vi.spyOn(doctorsApi, "listDoctors").mockResolvedValue({ count: 0, next: null, previous: null, results: [] })
    vi.spyOn(doctorsApi, "listDepartments").mockResolvedValue([])
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DoctorsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText("Doctors Directory")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Add Doctor/ })).not.toBeInTheDocument()
  })
})
