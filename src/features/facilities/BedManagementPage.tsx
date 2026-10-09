import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  FiPlus,
  FiSearch,
  FiRefreshCw,
  FiEdit3,
  FiTrash2,
  FiEye,
  FiSliders,
  FiCheckCircle,
  FiClock,
  FiTool,
  FiUserCheck,
  FiGrid,
  FiList,
  FiMove,
  FiX,
  FiAlertTriangle,
  FiUserPlus,
} from "react-icons/fi"
import { RiHotelBedLine, RiHospitalLine } from "react-icons/ri"
import { MdMeetingRoom } from "react-icons/md"
import { Pill } from "../../components/ui/Pill"
import { LoadingState, ErrorState } from "../../components/ui/QueryStates"
import {
  listBeds,
  createBed,
  updateBed,
  deleteBed,
  assignBed,
  updateBedStatus,
  getBedTypes,
  listRooms,
  listWards,
  createRoom,
  createWard,
  type Bed,
  type BedStatus,
  type CreateBedPayload,
  type UpdateBedPayload,
  type AssignBedPayload,
} from "../../api/facilities"
import { listPatients } from "../../api/patients"
import { listDoctors } from "../../api/appointments"
import type { Tone } from "../../components/ui/tone"

const BED_TYPES = [
  { value: "general", label: "General Ward Bed" },
  { value: "icu", label: "ICU / Critical Care Bed" },
  { value: "vip", label: "VIP Private Suite" },
  { value: "semi_private", label: "Semi-Private Bed" },
  { value: "isolation", label: "Isolation Ward Bed" },
  { value: "emergency", label: "Emergency / Triage Bed" },
]

const ROOM_TYPES = [
  { value: "general", label: "General Room" },
  { value: "deluxe", label: "Deluxe Room" },
  { value: "private", label: "Private Single Room" },
  { value: "semi_private", label: "Semi-Private / Twin" },
  { value: "icu", label: "ICU Room" },
  { value: "isolation", label: "Isolation Room" },
]

const WARD_TYPES = [
  { value: "general", label: "General Inpatient" },
  { value: "icu", label: "Intensive Care (ICU)" },
  { value: "emergency", label: "Emergency / Triage" },
  { value: "maternity", label: "Maternity Ward" },
  { value: "pediatric", label: "Pediatric Ward" },
  { value: "surgical", label: "Surgical Post-Op" },
]

interface ColumnConfig {
  id: BedStatus
  title: string
  subtitle: string
  color: string
  bgLight: string
  borderLight: string
  dropBorder: string
  icon: typeof FiCheckCircle
  tone: Tone
}

const COLUMNS: ColumnConfig[] = [
  {
    id: "available",
    title: "Available",
    subtitle: "Ready for admission",
    color: "text-emerald-700 dark:text-emerald-400",
    bgLight: "bg-emerald-500/5",
    borderLight: "border-emerald-500/20",
    dropBorder: "border-emerald-500 bg-emerald-500/10",
    icon: FiCheckCircle,
    tone: "ok",
  },
  {
    id: "occupied",
    title: "Occupied",
    subtitle: "Currently admitted",
    color: "text-blue-700 dark:text-blue-400",
    bgLight: "bg-blue-500/5",
    borderLight: "border-blue-500/20",
    dropBorder: "border-blue-500 bg-blue-500/10",
    icon: FiUserCheck,
    tone: "info",
  },
  {
    id: "reserved",
    title: "Reserved",
    subtitle: "Booked / Pre-admit",
    color: "text-amber-700 dark:text-amber-400",
    bgLight: "bg-amber-500/5",
    borderLight: "border-amber-500/20",
    dropBorder: "border-amber-500 bg-amber-500/10",
    icon: FiClock,
    tone: "warn",
  },
  {
    id: "maintenance",
    title: "Maintenance",
    subtitle: "Sanitizing / Repair",
    color: "text-rose-700 dark:text-rose-400",
    bgLight: "bg-rose-500/5",
    borderLight: "border-rose-500/20",
    dropBorder: "border-rose-500 bg-rose-500/10",
    icon: FiTool,
    tone: "bad",
  },
]

export function BedManagementPage() {
  const queryClient = useQueryClient()

  // View mode
  const [viewMode, setViewMode] = useState<"KANBAN" | "TABLE">("KANBAN")

  // Filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWardId, setSelectedWardId] = useState<string>("all")
  const [selectedBedType, setSelectedBedType] = useState<string>("all")

  // Drag and drop states
  const [draggedBedId, setDraggedBedId] = useState<number | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<BedStatus | null>(null)
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: "ok" | "err" } | null>(null)

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isRetrieveModalOpen, setIsRetrieveModalOpen] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isWardRoomModalOpen, setIsWardRoomModalOpen] = useState(false)

  // Detail / Form States
  const [retrievedBed, setRetrievedBed] = useState<Bed | null>(null)
  const [createForm, setCreateForm] = useState<CreateBedPayload>({
    room: 0,
    bed_number: "",
    bed_type: "general",
    status: "available",
  })

  const [updateForm, setUpdateForm] = useState<{ id: number; data: UpdateBedPayload }>({
    id: 0,
    data: { room: 0, bed_number: "", bed_type: "general", status: "available" },
  })

  const [deleteTarget, setDeleteTarget] = useState<Bed | null>(null)

  // Bed Assignment State (/facilities/beds/<id>/assign/)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignTargetBed, setAssignTargetBed] = useState<Bed | null>(null)
  const [assignForm, setAssignForm] = useState<AssignBedPayload>({
    patient: "",
    admitting_doctor: "",
    admission_type: "planned",
    admission_diagnosis: "",
  })

  // Bed Reservation State (POST /facilities/beds/<id>/update_status/ with { status: "reserved", patient })
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false)
  const [reserveTargetBed, setReserveTargetBed] = useState<Bed | null>(null)
  const [reservePatientId, setReservePatientId] = useState<string>("")

  const openReserveModal = (bed: Bed) => {
    if (bed.status === "occupied") {
      showToast(
        "Action Blocked",
        "An occupied bed cannot be converted to reserved. Please discharge/free the bed first.",
        "err"
      )
      return
    }
    setReserveTargetBed(bed)
    const available = patientsList.filter((p: any) => {
      const existing = assignedPatientBedMap.get(String(p.id))
      if (!existing) return true
      if (existing.bedId === bed.id) return true
      return false
    })
    setReservePatientId(available[0]?.id ? String(available[0].id) : "")
    setIsReserveModalOpen(true)
  }

  // Queries for Patients & Doctors dropdowns
  const { data: patientsData } = useQuery({
    queryKey: ["patients-list-dropdown"],
    queryFn: () => listPatients(),
  })
  const { data: doctorsData } = useQuery({
    queryKey: ["doctors-list-dropdown"],
    queryFn: () => listDoctors(),
  })
  const patientsList = patientsData?.results ?? []
  const doctorsList = (doctorsData?.results ?? []).filter((d: any) => d.is_active ?? true)

  // Quick Ward / Room Form
  const [wardForm, setWardForm] = useState({ name: "General Ward A", ward_type: "general", floor: "1st Floor" })
  const [roomForm, setRoomForm] = useState({ ward: 0, room_number: "101", room_type: "general" })

  // Toast auto-clear
  const showToast = (title: string, desc: string, type: "ok" | "err" = "ok") => {
    setToastMessage({ title, desc, type })
    setTimeout(() => {
      setToastMessage((prev) => (prev?.title === title ? null : prev))
    }, 3500)
  }

  // Queries
  const { data: bedsData, isLoading: isBedsLoading, isError: isBedsError, refetch: refetchBeds } = useQuery({
    queryKey: ["facilities-beds"],
    queryFn: () => listBeds({ page_size: "150" }),
  })

  const { data: roomsData } = useQuery({
    queryKey: ["facilities-rooms"],
    queryFn: () => listRooms({ page_size: "100" }),
  })

  const { data: wardsData } = useQuery({
    queryKey: ["facilities-wards"],
    queryFn: () => listWards(),
  })

  // GET /facilities/beds/types/
  const { data: remoteBedTypes } = useQuery({
    queryKey: ["facilities-bed-types"],
    queryFn: () => getBedTypes(),
  })

  const configuredBedTypes = useMemo(() => {
    if (remoteBedTypes && Array.isArray(remoteBedTypes) && remoteBedTypes.length > 0) {
      return remoteBedTypes.map((t) => ({ value: t.id, label: t.label }))
    }
    return BED_TYPES
  }, [remoteBedTypes])

  const beds = bedsData?.results ?? []
  const rooms = roomsData?.results ?? []
  const wards = wardsData?.results ?? []

  // Create room lookup map
  const roomMap = useMemo(() => {
    const map = new Map<number, typeof rooms[0]>()
    for (const r of rooms) map.set(r.id, r)
    return map
  }, [rooms])

  // Create ward lookup map
  const wardMap = useMemo(() => {
    const map = new Map<number, typeof wards[0]>()
    for (const w of wards) map.set(w.id, w)
    return map
  }, [wards])

  // Map of patients that already have an occupied or reserved bed
  const assignedPatientBedMap = useMemo(() => {
    const map = new Map<string, { bedId: number; bedNumber: string; status: BedStatus }>()
    for (const b of beds) {
      if ((b.status === "occupied" || b.status === "reserved") && b.patient?.id) {
        map.set(String(b.patient.id), {
          bedId: b.id,
          bedNumber: b.bed_number,
          status: b.status,
        })
      }
    }
    return map
  }, [beds])

  // Patients available for assignment (exclude patients who already have another active or reserved bed)
  const availablePatientsForAssign = useMemo(() => {
    return patientsList.filter((p: any) => {
      const existing = assignedPatientBedMap.get(String(p.id))
      if (!existing) return true
      if (assignTargetBed && existing.bedId === assignTargetBed.id) return true
      return false
    })
  }, [patientsList, assignedPatientBedMap, assignTargetBed])

  // Patients available for reservation (exclude patients who already have another active or reserved bed)
  const availablePatientsForReserve = useMemo(() => {
    return patientsList.filter((p: any) => {
      const existing = assignedPatientBedMap.get(String(p.id))
      if (!existing) return true
      if (reserveTargetBed && existing.bedId === reserveTargetBed.id) return true
      return false
    })
  }, [patientsList, assignedPatientBedMap, reserveTargetBed])

  // Auto-set ward in roomForm if wards become available
  useEffect(() => {
    if (wards.length > 0 && (!roomForm.ward || roomForm.ward === 0)) {
      setRoomForm((prev) => ({ ...prev, ward: wards[0].id }))
    }
  }, [wards])

  // Auto-set room in createForm if room becomes available
  useEffect(() => {
    if (rooms.length > 0 && (!createForm.room || createForm.room === 0)) {
      setCreateForm((prev) => ({ ...prev, room: rooms[0].id }))
    }
  }, [rooms])



  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateBedPayload) => createBed(data),
    onSuccess: (newBed) => {
      queryClient.invalidateQueries({ queryKey: ["facilities-beds"] })
      setIsCreateModalOpen(false)
      showToast("Bed Created", `Bed ${newBed.bed_number} created successfully in ${newBed.status}`)
      setCreateForm({ room: rooms[0]?.id || 0, bed_number: "", bed_type: "general", status: "available" })
    },
    onError: (err: any) => {
      showToast("Create Failed", err?.response?.data ? JSON.stringify(err.response.data) : err.message, "err")
    },
  })



  // POST /facilities/beds/<id>/update_status/
  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      patient,
    }: {
      id: number | string
      status: BedStatus | string
      patient?: string | number | null
    }) => {
      const currentBed = beds.find((b) => String(b.id) === String(id))
      if (currentBed?.status === "occupied" && status === "reserved") {
        throw new Error("Cannot convert an occupied bed to reserved. Discharge/free the bed first.")
      }
      return updateBedStatus(id, { status, patient })
    },
    onSuccess: (_, { id, status }) => {
      queryClient.invalidateQueries({ queryKey: ["facilities-beds"] })
      queryClient.invalidateQueries({ queryKey: ["beds"] })
      setIsReserveModalOpen(false)
      showToast("Bed Status Updated", `Bed #${id} is now ${status}`)
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["facilities-beds"] })
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : err.message)
      showToast("Status Update Failed", msg, "err")
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBedPayload }) => updateBed(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["facilities-beds"] })
      setIsUpdateModalOpen(false)
      showToast("Bed Updated", `Bed ${updated.bed_number} saved`)
    },
    onError: (err: any) => {
      showToast("Update Failed", err?.response?.data ? JSON.stringify(err.response.data) : err.message, "err")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities-beds"] })
      setIsDeleteModalOpen(false)
      showToast("Bed Removed", "The bed has been removed from facilities.")
    },
    onError: (err: any) => {
      showToast("Delete Failed", err?.response?.data ? JSON.stringify(err.response.data) : err.message, "err")
    },
  })

  const createWardMutation = useMutation({
    mutationFn: () => createWard(wardForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities-wards"] })
      setWardForm({ name: "", ward_type: "general", floor: "1st Floor" })
      showToast("Ward Created", "New ward registered")
    },
  })

  const createRoomMutation = useMutation({
    mutationFn: (data?: any) => {
      const payload = data || roomForm
      if (!payload.ward || payload.ward === 0) {
        throw new Error("A valid Ward is required before creating a Room. Please create or select a Ward.")
      }
      return createRoom(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities-rooms"] })
      setRoomForm((prev) => ({ ...prev, room_number: "" }))
      showToast("Room Created", "New room registered successfully")
    },
    onError: (err: any) => {
      const msg = err?.response?.data
        ? Object.entries(err.response.data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join(" | ")
        : err.message
      showToast("Room Creation Failed", msg, "err")
    },
  })

  // Assign Bed Mutation (/facilities/beds/<id>/assign/)
  const assignMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number | string; payload: AssignBedPayload }) => {
      const existing = assignedPatientBedMap.get(String(payload.patient))
      if (existing && existing.bedId !== Number(id)) {
        throw new Error(
          `This patient is already ${existing.status === "reserved" ? "reserved for" : "admitted to"} Bed ${existing.bedNumber}. A patient cannot be assigned to multiple beds.`
        )
      }
      const currentBed = beds.find((b) => String(b.id) === String(id))
      // If the bed is currently in maintenance, free it first in one seamless process
      if (currentBed?.status === "maintenance") {
        await updateBedStatus(id, { status: "available" })
      }
      return assignBed(id, payload)
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["facilities-beds"] })
      setIsAssignModalOpen(false)
      showToast("Bed Assigned", `Bed #${id} successfully assigned to patient!`)
      setAssignForm({
        patient: "",
        admitting_doctor: "",
        admission_type: "planned",
        admission_diagnosis: "",
      })
    },
    onError: (err: any) => {
      showToast("Assignment Failed", err?.response?.data ? JSON.stringify(err.response.data) : err.message, "err")
    },
  })

  const openAssignModal = (bed: Bed) => {
    setAssignTargetBed(bed)
    const available = patientsList.filter((p: any) => {
      const existing = assignedPatientBedMap.get(String(p.id))
      if (!existing) return true
      if (existing.bedId === bed.id) return true
      return false
    })
    const defaultPatient = bed.patient?.id
      ? String(bed.patient.id)
      : available[0]?.id
      ? String(available[0].id)
      : ""
    setAssignForm({
      patient: defaultPatient,
      admitting_doctor: doctorsList[0]?.id ? String(doctorsList[0].id) : "",
      admission_type: "planned",
      admission_diagnosis: "",
    })
    setIsAssignModalOpen(true)
  }

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, bed: Bed) => {
    setDraggedBedId(bed.id)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", String(bed.id))
  }

  const handleDragEnd = () => {
    setDraggedBedId(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, status: BedStatus) => {
    e.preventDefault()
    const draggedBed = beds.find((b) => b.id === draggedBedId)
    // Block drag-over on Reserved if the bed is Occupied
    if (draggedBed?.status === "occupied" && status === "reserved") {
      e.dataTransfer.dropEffect = "none"
      if (dragOverColumn === "reserved") {
        setDragOverColumn(null)
      }
      return
    }
    e.dataTransfer.dropEffect = "move"
    if (dragOverColumn !== status) {
      setDragOverColumn(status)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as HTMLElement | null
    if (!e.currentTarget.contains(related)) {
      setDragOverColumn(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetStatus: BedStatus) => {
    e.preventDefault()
    setDragOverColumn(null)
    setDraggedBedId(null)
    const idStr = e.dataTransfer.getData("text/plain")
    const bedId = Number(idStr) || draggedBedId
    if (!bedId) return

    const targetBed = beds.find((b) => b.id === bedId)
    if (!targetBed || targetBed.status === targetStatus) return

    // Strictly block converting Occupied to Reserved!
    if (targetBed.status === "occupied" && targetStatus === "reserved") {
      showToast(
        "Action Blocked",
        "An occupied bed cannot be converted to reserved. Please discharge/free the bed first.",
        "err"
      )
      return
    }

    // If dragging to Occupied, prompt user with the assign modal to capture patient & doctor details!
    if (targetStatus === "occupied") {
      openAssignModal(targetBed)
      return
    }

    // If dragging to Reserved, prompt user with the reserve modal because backend requires 'patient' ID!
    if (targetStatus === "reserved") {
      openReserveModal(targetBed)
      return
    }

    // Optimistic UI update in tanstack cache
    queryClient.setQueryData(["facilities-beds"], (old: any) => {
      if (!old || !old.results) return old
      return {
        ...old,
        results: old.results.map((b: Bed) =>
          b.id === bedId
            ? { ...b, status: targetStatus, patient: targetStatus === "available" ? null : b.patient }
            : b
        ),
      }
    })

    // Execute POST /facilities/beds/<id>/update_status/
    updateStatusMutation.mutate({ id: bedId, status: targetStatus })
  }

  // Filtered beds
  const filteredBeds = useMemo(() => {
    return beds.filter((b) => {
      const matchesSearch =
        b.bed_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.bed_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(b.id).includes(searchQuery)

      const roomObj = roomMap.get(b.room)
      const matchesWard = selectedWardId === "all" || (roomObj && String(roomObj.ward) === selectedWardId)
      const matchesType = selectedBedType === "all" || b.bed_type === selectedBedType

      return matchesSearch && matchesWard && matchesType
    })
  }, [beds, searchQuery, selectedWardId, selectedBedType, roomMap])

  // Count stats
  const totalBeds = beds.length
  const availableBedsCount = beds.filter((b) => b.status === "available").length
  const occupiedBedsCount = beds.filter((b) => b.status === "occupied").length
  const reservedBedsCount = beds.filter((b) => b.status === "reserved").length
  const maintenanceBedsCount = beds.filter((b) => b.status === "maintenance").length
  const occupancyPercentage = totalBeds > 0 ? Math.round((occupiedBedsCount / totalBeds) * 100) : 0

  return (
    <div className="flex flex-col gap-2.5 p-1 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border transition-all animate-bounce-short ${
            toastMessage.type === "ok"
              ? "bg-emerald-900/95 text-emerald-100 border-emerald-700 shadow-emerald-950/20"
              : "bg-rose-900/95 text-rose-100 border-rose-700 shadow-rose-950/20"
          }`}
        >
          {toastMessage.type === "ok" ? (
            <FiCheckCircle className="text-emerald-400 text-lg shrink-0" />
          ) : (
            <FiAlertTriangle className="text-rose-400 text-lg shrink-0" />
          )}
          <div>
            <div className="font-bold text-xs">{toastMessage.title}</div>
            <div className="text-[11px] opacity-90">{toastMessage.desc}</div>
          </div>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75">
            <FiX className="text-xs" />
          </button>
        </div>
      )}

      {/* Header bar (Compact) */}
      <div className="flex items-center justify-between bg-surface px-3.5 py-2 rounded-xl border border-border shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand/20 to-brand-tint flex items-center justify-center text-brand text-lg shadow-inner shrink-0">
            <RiHotelBedLine />
          </div>
          <div>
            <div className="text-sm font-bold text-ink-1 flex items-center gap-2 leading-none">
              <span>Facilities & Bed Management</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-tint text-brand border border-brand/20 flex items-center gap-1">
                <RiHospitalLine className="text-[10px]" /> ERP Facilities
              </span>
            </div>
            <div className="text-[11px] text-ink-4 mt-1 leading-none">
              Hospital Bed Board Matrix · Real-time availability & inpatient occupancy tracking
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsWardRoomModalOpen(true)}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-surface text-ink-2 hover:bg-page border border-border-strong transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <MdMeetingRoom className="text-xs text-ink-3" />
            <span>Add Ward / Room</span>
          </button>

          <button
            onClick={() => {
              setCreateForm((p) => ({ ...p, status: "available" }))
              setIsCreateModalOpen(true)
            }}
            className="h-8 px-3.5 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-hover transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs shadow-brand/20"
          >
            <FiPlus className="text-xs font-bold" />
            <span>Add Bed</span>
          </button>
        </div>
      </div>

      {/* Metrics Stat Cards (Compact Space-Saving) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Total Beds */}
        <div className="group p-2.5 bg-surface border border-border rounded-xl shadow-2xs hover:border-brand/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-ink-4 text-[11px]">
              <RiHotelBedLine className="text-brand text-xs" /> Total Beds
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-page text-ink-3 font-mono">
              {rooms.length} Rms · {wards.length} Wards
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-ink-1 group-hover:scale-105 transition-transform origin-left">
              {totalBeds}
            </span>
            <span className="text-[10px] text-ink-4">Total Capacity</span>
          </div>
          <div className="w-full bg-page h-1 rounded-full mt-1.5 overflow-hidden">
            <div className="bg-brand h-full rounded-full transition-all duration-500" style={{ width: "100%" }} />
          </div>
        </div>

        {/* Available Beds */}
        <div className="group p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl shadow-2xs hover:border-emerald-500/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
              <FiCheckCircle className="text-emerald-600 text-xs" /> Available Beds
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold">
              Ready
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-emerald-800 dark:text-emerald-300 group-hover:scale-105 transition-transform origin-left">
              {availableBedsCount}
            </span>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 font-medium">Ready for admit</span>
          </div>
          <div className="w-full bg-emerald-200/50 dark:bg-emerald-950 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${totalBeds > 0 ? (availableBedsCount / totalBeds) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Occupied Beds */}
        <div className="group p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl shadow-2xs hover:border-blue-500/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400 text-[11px]">
              <FiUserCheck className="text-blue-600 text-xs" /> Occupied Beds
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold">
              {occupancyPercentage}% Occupancy
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-blue-800 dark:text-blue-300 group-hover:scale-105 transition-transform origin-left">
              {occupiedBedsCount}
            </span>
            <span className="text-[10px] text-blue-700/80 dark:text-blue-400 font-medium">Inpatients</span>
          </div>
          <div className="w-full bg-blue-200/50 dark:bg-blue-950 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${occupancyPercentage}%` }}
            />
          </div>
        </div>

        {/* Maintenance & Reserved */}
        <div className="group p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-xl shadow-2xs hover:border-rose-500/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400 text-[11px]">
              <FiTool className="text-rose-600 text-xs" /> Blocked / Mnt
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold">
              {reservedBedsCount} Rsv · {maintenanceBedsCount} Mnt
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-lg font-black text-rose-800 dark:text-rose-300 group-hover:scale-105 transition-transform origin-left">
              {maintenanceBedsCount + reservedBedsCount}
            </span>
            <span className="text-[10px] text-rose-700/80 dark:text-rose-400 font-medium">Unavailable</span>
          </div>
          <div className="w-full bg-rose-200/50 dark:bg-rose-950 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${totalBeds > 0 ? ((maintenanceBedsCount + reservedBedsCount) / totalBeds) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and View Controls Toolbar */}
      <div className="flex items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 text-xs" />
            <input
              type="text"
              placeholder="Search bed number, type or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 pl-8 pr-3 text-xs border border-border-strong rounded-lg bg-surface w-60 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            <FiSliders className="text-xs text-ink-4 ml-1" />
            <select
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
              className="h-8.5 px-2.5 text-xs border border-border-strong rounded-lg bg-surface focus:outline-none cursor-pointer"
            >
              <option value="all">All Wards</option>
              {wards.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name} ({w.floor})
                </option>
              ))}
            </select>

            <select
              value={selectedBedType}
              onChange={(e) => setSelectedBedType(e.target.value)}
              className="h-8.5 px-2.5 text-xs border border-border-strong rounded-lg bg-surface focus:outline-none cursor-pointer"
            >
              <option value="all">All Bed Types</option>
              {configuredBedTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Switcher & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-page p-1 rounded-lg border border-border text-xs">
            <button
              onClick={() => setViewMode("KANBAN")}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "KANBAN"
                  ? "bg-surface text-brand shadow-xs"
                  : "text-ink-3 hover:text-ink-1"
              }`}
            >
              <FiGrid className="text-xs" />
              <span>Board View</span>
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "TABLE"
                  ? "bg-surface text-brand shadow-xs"
                  : "text-ink-3 hover:text-ink-1"
              }`}
            >
              <FiList className="text-xs" />
              <span>Table View</span>
            </button>
          </div>

          <button
            onClick={() => refetchBeds()}
            title="Refresh bed data"
            className="h-8.5 w-8.5 flex items-center justify-center rounded-lg border border-border hover:bg-page text-ink-3 hover:text-brand transition-all active:rotate-180 duration-300 cursor-pointer"
          >
            <FiRefreshCw className="text-xs" />
          </button>
        </div>
      </div>

      {/* Main Board Content */}
      {isBedsLoading ? (
        <LoadingState />
      ) : isBedsError ? (
        <ErrorState title="Failed to load beds" message="Could not connect to /facilities/beds/ API" />
      ) : filteredBeds.length === 0 ? (
        <div className="py-16 px-4 flex flex-col items-center justify-center text-center bg-surface border border-dashed border-border rounded-xl shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-brand-tint/60 text-brand flex items-center justify-center text-3xl mb-3 shadow-inner">
            <RiHotelBedLine />
          </div>
          <h4 className="text-base font-bold text-ink-1">No Beds Found</h4>
          <p className="text-xs text-ink-4 max-w-sm mt-1 mb-5">
            There are currently no beds matching your filter criteria or registered in the facilities system.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setCreateForm((p) => ({ ...p, status: "available" }))
                setIsCreateModalOpen(true)
              }}
              className="h-9 px-4 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-hover shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <FiPlus className="text-sm font-bold" />
              <span>Create New Bed</span>
            </button>
            <button
              onClick={() => setIsWardRoomModalOpen(true)}
              className="h-9 px-4 text-xs font-semibold rounded-lg bg-surface border border-border-strong text-ink-2 hover:bg-page cursor-pointer flex items-center gap-1.5"
            >
              <MdMeetingRoom className="text-sm text-ink-3" />
              <span>Add Ward / Room</span>
            </button>
          </div>
        </div>
      ) : viewMode === "KANBAN" ? (
        /* ================= TRELLO-LIKE KANBAN DRAG & DROP BOARD ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((column) => {
            const columnBeds = filteredBeds.filter((b) => b.status === column.id)
            const isDropTarget = dragOverColumn === column.id
            const ColumnIcon = column.icon

            return (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex flex-col rounded-xl border p-3.5 transition-all duration-200 min-h-[540px] ${
                  isDropTarget
                    ? `${column.dropBorder} shadow-lg scale-[1.01]`
                    : "bg-surface/80 border-border shadow-xs"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/80">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${column.bgLight} ${column.color}`}
                    >
                      <ColumnIcon />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-ink-1 flex items-center gap-1.5">
                        <span>{column.title}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-page border border-border text-ink-3">
                          {columnBeds.length}
                        </span>
                      </div>
                      <div className="text-[10px] text-ink-4">{column.subtitle}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setCreateForm((p) => ({ ...p, status: column.id }))
                      setIsCreateModalOpen(true)
                    }}
                    title={`Add new ${column.title} bed`}
                    className="w-6 h-6 rounded-md hover:bg-page text-ink-4 hover:text-ink-1 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <FiPlus className="text-xs" />
                  </button>
                </div>

                {/* Drop Zone Placeholder when dragging */}
                {isDropTarget && (
                  <div className="mb-2 py-3 border-2 border-dashed border-brand/50 rounded-lg bg-brand/5 text-center text-xs text-brand font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                    <FiMove className="text-xs" /> Drop here to set {column.title}
                  </div>
                )}

                {/* Bed Cards */}
                <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[620px] pr-1">
                  {columnBeds.length === 0 ? (
                    <div className="py-8 text-center text-xs text-ink-4 border border-dashed border-border/70 rounded-lg bg-page/30 flex flex-col items-center justify-center gap-1">
                      <RiHotelBedLine className="text-lg opacity-40" />
                      <span>No {column.title.toLowerCase()} beds</span>
                      <button
                        onClick={() => {
                          setCreateForm((p) => ({ ...p, status: column.id }))
                          setIsCreateModalOpen(true)
                        }}
                        className="text-[11px] font-semibold text-brand hover:underline mt-1 cursor-pointer"
                      >
                        + Add bed
                      </button>
                    </div>
                  ) : (
                    columnBeds.map((bed) => {
                      const isBeingDragged = draggedBedId === bed.id
                      const roomObj = roomMap.get(bed.room)
                      const wardObj = roomObj ? wardMap.get(roomObj.ward) : null

                      return (
                        <div
                          key={bed.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, bed)}
                          onDragEnd={handleDragEnd}
                          className={`group bg-surface rounded-xl border border-border/80 shadow-xs hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing select-none p-3.5 flex flex-col justify-between gap-2.5 border-l-4 ${
                            bed.status === "available"
                              ? "border-l-emerald-500 hover:border-l-emerald-600"
                              : bed.status === "occupied"
                              ? "border-l-blue-500 hover:border-l-blue-600"
                              : bed.status === "reserved"
                              ? "border-l-amber-500 hover:border-l-amber-600"
                              : "border-l-rose-500 hover:border-l-rose-600"
                          } ${
                            isBeingDragged
                              ? "ring-2 ring-brand border-brand shadow-lg"
                              : "hover:-translate-y-0.5"
                          }`}
                        >
                          {/* Card Header: Bed Icon + Bed Label + Status */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                                  bed.status === "available"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : bed.status === "occupied"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                    : bed.status === "reserved"
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                }`}
                              >
                                <RiHotelBedLine />
                              </div>
                              <div>
                                <div className="text-[13.5px] font-bold text-ink-1 group-hover:text-brand transition-colors tracking-tight">
                                  {bed.bed_number}
                                </div>
                                <div className="text-[10px] font-mono text-ink-4">ID #{bed.id}</div>
                              </div>
                            </div>

                            <span
                              className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize border ${
                                bed.status === "available"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                  : bed.status === "occupied"
                                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                                  : bed.status === "reserved"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                              }`}
                            >
                              {bed.status}
                            </span>
                          </div>

                          {/* Chips Row: Room, Ward & Bed Type */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {/* Room Badge */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-page border border-border text-[11px] font-medium text-ink-2">
                              <MdMeetingRoom className="text-xs text-ink-3" />
                              <span>{roomObj?.room_number ? `Room ${roomObj.room_number}` : `Room #${bed.room}`}</span>
                            </span>

                            {/* Ward Badge */}
                            {wardObj && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-page border border-border text-[11px] font-medium text-ink-3 max-w-[130px] truncate"
                                title={wardObj.name}
                              >
                                <RiHospitalLine className="text-xs text-ink-4 shrink-0" />
                                <span className="truncate">{wardObj.name}</span>
                              </span>
                            )}

                            {/* Bed Type Badge */}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-tint/60 text-brand text-[10.5px] font-semibold capitalize border border-brand/10">
                              {bed.bed_type.replace("_", " ")}
                            </span>
                          </div>

                          {/* Patient Info Card (If Occupied / Reserved / Patient Assigned) */}
                          {bed.patient ? (
                            <div
                              className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                                bed.status === "reserved"
                                  ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60"
                                  : "bg-blue-50/70 dark:bg-blue-950/40 border-blue-200/70 dark:border-blue-800/60"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 font-bold ${
                                    bed.status === "reserved"
                                      ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                                      : "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                                  }`}
                                >
                                  <FiUserCheck />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-ink-1 truncate" title={bed.patient.name}>
                                    {bed.patient.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-ink-3 truncate">
                                    UHID: {bed.patient.uhid}
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  bed.status === "reserved"
                                    ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200/80 dark:border-amber-800"
                                    : "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border-blue-200/80 dark:border-blue-800"
                                }`}
                              >
                                {bed.status === "reserved" ? "Reserved" : "Admitted"}
                              </span>
                            </div>
                          ) : bed.status === "reserved" ? (
                            <div className="p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                              <FiClock className="text-xs shrink-0" />
                              <span className="font-medium">Reserved for incoming patient</span>
                            </div>
                          ) : null}

                          {/* Action Button: Assign or Reserve (if available) OR Free Bed (if occupied/reserved/maintenance) */}
                          {bed.status === "available" ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openAssignModal(bed)
                                }}
                                className="flex-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              >
                                <FiUserPlus className="text-xs" />
                                <span>Assign</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openReserveModal(bed)
                                }}
                                className="py-1.5 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                                title="Reserve bed for a patient"
                              >
                                <FiClock className="text-xs" />
                                <span>Reserve</span>
                              </button>
                            </div>
                          ) : bed.status === "reserved" ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openAssignModal(bed)
                                }}
                                className="flex-1 py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                                title="Admit patient to turn Reserved into Occupied"
                              >
                                <FiUserCheck className="text-xs" />
                                <span>Admit (Occupy)</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateStatusMutation.mutate({ id: bed.id, status: "available" })
                                }}
                                disabled={updateStatusMutation.isPending}
                                className="py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                                title="Cancel reservation and free bed (set to Available)"
                              >
                                <FiCheckCircle className="text-xs" />
                                <span>Free</span>
                              </button>
                            </div>
                          ) : bed.status === "maintenance" ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openAssignModal(bed)
                                }}
                                className="flex-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                                title="Free bed from maintenance and admit a patient directly in one process"
                              >
                                <FiUserPlus className="text-xs" />
                                <span>Assign (Occupy)</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateStatusMutation.mutate({ id: bed.id, status: "available" })
                                }}
                                disabled={updateStatusMutation.isPending}
                                className="py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                                title="End maintenance and mark bed as Available"
                              >
                                <FiCheckCircle className="text-xs" />
                                <span>Free</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                updateStatusMutation.mutate({ id: bed.id, status: "available" })
                              }}
                              disabled={updateStatusMutation.isPending}
                              className="w-full py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Free this bed and change status to Available (POST /facilities/beds/<id>/update_status/)"
                            >
                              <FiCheckCircle className="text-xs" />
                              <span>Free Bed (Make Available)</span>
                            </button>
                          )}

                          {/* Bottom Action Buttons (Clean & Minimalist) */}
                          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                            <span className="text-[10px] text-ink-4 font-mono">
                              {roomObj?.room_type ? `${roomObj.room_type} room` : ""}
                            </span>
                            <div className="flex items-center gap-1">

                              {/* View / Retrieve */}
                              <button
                                onClick={() => {
                                  setRetrievedBed(bed)
                                  setIsRetrieveModalOpen(true)
                                }}
                                title="View details"
                                className="w-6.5 h-6.5 rounded-md flex items-center justify-center text-ink-3 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                              >
                                <FiEye className="text-xs" />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => {
                                  setUpdateForm({
                                    id: bed.id,
                                    data: {
                                      room: bed.room,
                                      bed_number: bed.bed_number,
                                      bed_type: bed.bed_type,
                                      status: bed.status,
                                    },
                                  })
                                  setIsUpdateModalOpen(true)
                                }}
                                title="Edit bed"
                                className="w-6.5 h-6.5 rounded-md flex items-center justify-center text-ink-3 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                              >
                                <FiEdit3 className="text-xs" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => {
                                  setDeleteTarget(bed)
                                  setIsDeleteModalOpen(true)
                                }}
                                title="Delete bed"
                                className="w-6.5 h-6.5 rounded-md flex items-center justify-center text-ink-3 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              >
                                <FiTrash2 className="text-xs" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ================= CLASSIC TABLE VIEW ================= */
        <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-page text-ink-3 font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4">Bed ID</th>
                <th className="py-3 px-4">Bed Label</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Room & Ward</th>
                <th className="py-3 px-4">Current Status</th>
                <th className="py-3 px-4">Assigned Patient</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBeds.map((bed) => {
                const roomObj = roomMap.get(bed.room)
                const wardObj = roomObj ? wardMap.get(roomObj.ward) : null

                return (
                  <tr key={bed.id} className="hover:bg-page/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-ink-3">#{bed.id}</td>
                    <td className="py-3 px-4 font-bold text-ink-1 flex items-center gap-2">
                      <RiHotelBedLine className="text-brand text-sm" />
                      <span>{bed.bed_number}</span>
                    </td>
                    <td className="py-3 px-4 capitalize text-ink-2">{bed.bed_type.replace("_", " ")}</td>
                    <td className="py-3 px-4 text-ink-3">
                      <div>
                        Room #{bed.room} {roomObj ? `(No. ${roomObj.room_number})` : ""}
                      </div>
                      {wardObj && <div className="text-[11px] text-ink-4">{wardObj.name}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <Pill
                        tone={
                          bed.status === "available"
                            ? "ok"
                            : bed.status === "occupied"
                            ? "info"
                            : bed.status === "reserved"
                            ? "warn"
                            : "bad"
                        }
                      >
                        {bed.status}
                      </Pill>
                    </td>
                    <td className="py-3 px-4">
                      {bed.patient ? (
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold ${
                              bed.status === "reserved"
                                ? "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300"
                                : "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            <FiUserCheck />
                          </div>
                          <div>
                            <div className="font-semibold text-ink-1 text-xs">{bed.patient.name}</div>
                            <div className="text-[10.5px] font-mono text-ink-3">
                              {bed.patient.uhid ? `UHID: ${bed.patient.uhid}` : ""} {bed.status === "reserved" ? "(Reserved)" : ""}
                            </div>
                          </div>
                        </div>
                      ) : bed.status === "reserved" ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium text-[11px] flex items-center gap-1">
                          <FiClock className="text-xs" /> Reserved
                        </span>
                      ) : bed.status === "available" ? (
                        <button
                          onClick={() => openAssignModal(bed)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <FiUserPlus className="text-xs" />
                          <span>Assign Patient</span>
                        </button>
                      ) : (
                        <span className="text-ink-4 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {bed.status === "available" || bed.status === "maintenance" ? (
                          <button
                            onClick={() => openAssignModal(bed)}
                            title={bed.status === "maintenance" ? "Free bed and assign patient in one step" : "Assign bed to patient"}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 rounded transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <FiUserPlus className="text-xs" />
                            <span>Assign</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatusMutation.mutate({ id: bed.id, status: "available" })}
                            title="Free bed (set to available)"
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <FiCheckCircle className="text-xs" />
                            <span>Free</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setRetrievedBed(bed)
                            setIsRetrieveModalOpen(true)
                          }}
                          className="p-1.5 text-ink-3 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                        >
                          <FiEye className="text-xs" />
                        </button>
                        <button
                          onClick={() => {
                            setUpdateForm({
                              id: bed.id,
                              data: {
                                room: bed.room,
                                bed_number: bed.bed_number,
                                bed_type: bed.bed_type,
                                status: bed.status,
                              },
                            })
                            setIsUpdateModalOpen(true)
                          }}
                          className="p-1.5 text-ink-3 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        >
                          <FiEdit3 className="text-xs" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTarget(bed)
                            setIsDeleteModalOpen(true)
                          }}
                          className="p-1.5 text-ink-3 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        >
                          <FiTrash2 className="text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* 1. CREATE BED MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-tint text-brand flex items-center justify-center text-base">
                  <FiPlus />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-1">Create New Hospital Bed</h3>
                  <div className="text-[11px] text-ink-4">Register bed into room and status matrix</div>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-page text-ink-4 hover:text-ink-1 flex items-center justify-center cursor-pointer"
              >
                <FiX />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              {rooms.length === 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FiAlertTriangle /> No rooms exist yet. Create a room first!
                  </span>
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(false)
                      setIsWardRoomModalOpen(true)
                    }}
                    className="font-bold underline text-xs cursor-pointer"
                  >
                    + Add Room
                  </button>
                </div>
              )}

              <div>
                <label className="block font-semibold text-ink-2 mb-1">Target Room *</label>
                {rooms.length > 0 ? (
                  <select
                    value={createForm.room}
                    onChange={(e) => setCreateForm({ ...createForm, room: Number(e.target.value) })}
                    className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs focus:ring-2 focus:ring-brand/30 focus:outline-none"
                  >
                    {rooms.map((r) => {
                      const w = wardMap.get(r.ward)
                      return (
                        <option key={r.id} value={r.id}>
                          Room #{r.id} · No. {r.room_number} ({r.room_type}) {w ? `· ${w.name}` : ""}
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <input
                    type="number"
                    placeholder="Enter Room ID"
                    value={createForm.room || ""}
                    onChange={(e) => setCreateForm({ ...createForm, room: Number(e.target.value) })}
                    className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-ink-2 mb-1">Bed Number / Label *</label>
                <input
                  type="text"
                  placeholder="e.g. BED-101-A, ICU-04"
                  value={createForm.bed_number}
                  onChange={(e) => setCreateForm({ ...createForm, bed_number: e.target.value })}
                  className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs focus:ring-2 focus:ring-brand/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-2 mb-1">Bed Type *</label>
                <select
                  value={createForm.bed_type}
                  onChange={(e) => setCreateForm({ ...createForm, bed_type: e.target.value })}
                  className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs focus:ring-2 focus:ring-brand/30 focus:outline-none"
                >
                  {configuredBedTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink-2 mb-1">Initial Status</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as BedStatus })}
                  className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs focus:ring-2 focus:ring-brand/30 focus:outline-none"
                >
                  <option value="available">🟢 Available (Ready for admission)</option>
                  <option value="occupied">🔵 Occupied (Currently admitted)</option>
                  <option value="reserved">🟠 Reserved (Pre-booked)</option>
                  <option value="maintenance">🔴 Maintenance (Sanitation / Repair)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-surface border border-border text-ink-2 hover:bg-page cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!createForm.room || !createForm.bed_number || createMutation.isPending}
                onClick={() => createMutation.mutate(createForm)}
                className="h-8.5 px-4 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-hover disabled:opacity-50 transition-all cursor-pointer shadow-sm"
              >
                {createMutation.isPending ? "Creating..." : "Save Bed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. RETRIEVE BED DETAIL MODAL */}
      {isRetrieveModalOpen && retrievedBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-base">
                  <FiEye />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-1">Bed Details: {retrievedBed.bed_number}</h3>
                  <div className="text-[11px] text-ink-4">Infrastructure entity details</div>
                </div>
              </div>
              <button
                onClick={() => setIsRetrieveModalOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-page text-ink-4 hover:text-ink-1 flex items-center justify-center cursor-pointer"
              >
                <FiX />
              </button>
            </div>

            <div className="p-4 bg-page rounded-xl border border-border text-xs space-y-2.5 font-medium">
              <div className="flex items-center justify-between">
                <span className="text-ink-4">Database ID:</span>
                <span className="font-mono font-bold text-ink-1">#{retrievedBed.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-4">Bed Number:</span>
                <span className="font-bold text-ink-1">{retrievedBed.bed_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-4">Status:</span>
                <Pill
                  tone={
                    retrievedBed.status === "available"
                      ? "ok"
                      : retrievedBed.status === "occupied"
                      ? "info"
                      : retrievedBed.status === "reserved"
                      ? "warn"
                      : "bad"
                  }
                >
                  {retrievedBed.status}
                </Pill>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-4">Bed Type:</span>
                <span className="capitalize text-ink-1">{retrievedBed.bed_type.replace("_", " ")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-4">Room Association:</span>
                <span className="text-ink-1">Room #{retrievedBed.room}</span>
              </div>

              {/* Patient Details Section */}
              {retrievedBed.patient ? (
                <div className="mt-2 pt-2.5 border-t border-border/80 flex flex-col gap-1.5">
                  <div className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <FiUserCheck className="text-sm" /> Admitted Patient
                  </div>
                  <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-lg border border-blue-200/80 dark:border-blue-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-4">Patient Name:</span>
                      <span className="font-semibold text-ink-1">{retrievedBed.patient.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-4">UHID:</span>
                      <span className="font-mono text-ink-2 font-medium">{retrievedBed.patient.uhid}</span>
                    </div>
                    {retrievedBed.patient.admission_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-ink-4">Admission ID:</span>
                        <span className="font-mono text-[10px] text-ink-3 truncate max-w-[190px]">
                          {retrievedBed.patient.admission_id}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : retrievedBed.status === "available" ? (
                <div className="mt-2 pt-2.5 border-t border-border/80 flex items-center justify-between">
                  <span className="text-ink-4">Assigned Patient:</span>
                  <button
                    onClick={() => {
                      setIsRetrieveModalOpen(false)
                      openAssignModal(retrievedBed)
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <FiUserPlus className="text-xs" />
                    <span>Assign Patient</span>
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end border-t border-border pt-3">
              <button
                onClick={() => setIsRetrieveModalOpen(false)}
                className="h-8.5 px-4 text-xs font-semibold rounded-lg bg-surface border border-border text-ink-2 hover:bg-page cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. UPDATE BED MODAL */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center text-base">
                  <FiEdit3 />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-1">Edit Bed #{updateForm.id}</h3>
                  <div className="text-[11px] text-ink-4">Modify bed specifications</div>
                </div>
              </div>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-page text-ink-4 hover:text-ink-1 flex items-center justify-center cursor-pointer"
              >
                <FiX />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="block font-semibold text-ink-2 mb-1">Room Association</label>
                <select
                  value={updateForm.data.room}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, data: { ...updateForm.data, room: Number(e.target.value) } })
                  }
                  className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room #{r.id} · No. {r.room_number} ({r.room_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink-2 mb-1">Bed Label / Number</label>
                <input
                  type="text"
                  value={updateForm.data.bed_number}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, data: { ...updateForm.data, bed_number: e.target.value } })
                  }
                  className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-2 mb-1">Bed Type</label>
                <select
                  value={updateForm.data.bed_type}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, data: { ...updateForm.data, bed_type: e.target.value } })
                  }
                  className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs"
                >
                  {configuredBedTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink-2 mb-1">Status</label>
                <select
                  value={updateForm.data.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value as BedStatus
                    const currentBed = beds.find((b) => b.id === updateForm.id)
                    if (currentBed?.status === "occupied" && nextStatus === "reserved") {
                      showToast(
                        "Action Blocked",
                        "Cannot convert an occupied bed to reserved. Discharge/free the bed first.",
                        "err"
                      )
                      return
                    }
                    setUpdateForm({ ...updateForm, data: { ...updateForm.data, status: nextStatus } })
                  }}
                  className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs"
                >
                  <option value="available">🟢 Available</option>
                  <option value="occupied">🔵 Occupied</option>
                  {beds.find((b) => b.id === updateForm.id)?.status === "occupied" ? (
                    <option value="reserved" disabled>
                      🟠 Reserved (Blocked: Bed is Occupied)
                    </option>
                  ) : (
                    <option value="reserved">🟠 Reserved</option>
                  )}
                  <option value="maintenance">🔴 Maintenance</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-surface border border-border text-ink-2 hover:bg-page cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate(updateForm)}
                className="h-8.5 px-4 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-hover transition-all cursor-pointer shadow-sm"
              >
                {updateMutation.isPending ? "Saving..." : "Update Bed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-sm p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center text-lg shrink-0">
                <FiTrash2 />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-1">Remove Bed</h3>
                <div className="text-[11px] text-ink-4">Confirm bed removal</div>
              </div>
            </div>

            <p className="text-xs text-ink-3">
              Are you sure you want to delete bed{" "}
              <strong className="text-ink-1 font-bold">{deleteTarget.bed_number}</strong> (#{deleteTarget.id})? This
              cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-surface border border-border text-ink-2 hover:bg-page cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="h-8.5 px-4 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-all cursor-pointer shadow-sm"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Bed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADD WARD / ROOM MODAL */}
      {isWardRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-lg p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-tint text-brand flex items-center justify-center text-base">
                  <MdMeetingRoom />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-1">Manage Facility Infrastructure</h3>
                  <div className="text-[11px] text-ink-4">Register new Wards and Rooms</div>
                </div>
              </div>
              <button
                onClick={() => setIsWardRoomModalOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-page text-ink-4 hover:text-ink-1 flex items-center justify-center cursor-pointer"
              >
                <FiX />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              {/* Add Ward */}
              <div className="flex flex-col gap-2.5 p-3.5 bg-page rounded-xl border border-border">
                <div className="font-bold text-ink-1 flex items-center gap-1.5">
                  <RiHospitalLine className="text-brand text-sm" /> 1. Create Ward
                </div>
                <div>
                  <label className="block font-semibold text-ink-3 mb-1">Ward Name</label>
                  <input
                    type="text"
                    placeholder="e.g. ICU Ward, General B"
                    value={wardForm.name}
                    onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })}
                    className="w-full h-8 px-2.5 border rounded-lg bg-surface text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-3 mb-1">Ward Type</label>
                  <select
                    value={wardForm.ward_type}
                    onChange={(e) => setWardForm({ ...wardForm, ward_type: e.target.value })}
                    className="w-full h-8 px-2 border rounded-lg bg-surface text-xs"
                  >
                    {WARD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-ink-3 mb-1">Floor</label>
                  <input
                    type="text"
                    placeholder="e.g. 1st Floor, 3rd Floor"
                    value={wardForm.floor}
                    onChange={(e) => setWardForm({ ...wardForm, floor: e.target.value })}
                    className="w-full h-8 px-2.5 border rounded-lg bg-surface text-xs"
                  />
                </div>
                <button
                  disabled={!wardForm.name.trim() || createWardMutation.isPending}
                  onClick={() => createWardMutation.mutate()}
                  className="mt-1 h-8 rounded-lg bg-brand text-white font-semibold hover:bg-brand-hover disabled:opacity-50 transition-all cursor-pointer text-xs"
                >
                  {createWardMutation.isPending ? "Saving..." : "Save Ward"}
                </button>
              </div>

              {/* Add Room */}
              <div className="flex flex-col gap-2.5 p-3.5 bg-page rounded-xl border border-border">
                <div className="font-bold text-ink-1 flex items-center gap-1.5">
                  <MdMeetingRoom className="text-brand text-sm" /> 2. Create Room
                </div>
                <div>
                  <label className="block font-semibold text-ink-3 mb-1">Assign to Ward</label>
                  {wards.length === 0 ? (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                      No wards exist yet. Please create a ward first on the left.
                    </div>
                  ) : (
                    <select
                      value={roomForm.ward || wards[0]?.id}
                      onChange={(e) => setRoomForm({ ...roomForm, ward: Number(e.target.value) })}
                      className="w-full h-8 px-2 border rounded-lg bg-surface text-xs"
                    >
                      {wards.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.floor ? `(${w.floor})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-ink-3 mb-1">Room Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 101, 202-B"
                    value={roomForm.room_number}
                    onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })}
                    className="w-full h-8 px-2.5 border rounded-lg bg-surface text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-3 mb-1">Room Type</label>
                  <select
                    value={roomForm.room_type}
                    onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
                    className="w-full h-8 px-2 border rounded-lg bg-surface text-xs"
                  >
                    {ROOM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  disabled={
                    (!roomForm.ward && !wards[0]) ||
                    !roomForm.room_number.trim() ||
                    createRoomMutation.isPending
                  }
                  onClick={() => {
                    const targetWardId = roomForm.ward || wards[0]?.id
                    if (!targetWardId || targetWardId === 0) {
                      showToast("Ward Required", "Please create or select a valid Ward first.", "err")
                      return
                    }
                    createRoomMutation.mutate({
                      ward: targetWardId,
                      room_number: roomForm.room_number.trim(),
                      room_type: roomForm.room_type || "general",
                    })
                  }}
                  className="mt-1 h-8 rounded-lg bg-brand text-white font-semibold hover:bg-brand-hover disabled:opacity-50 transition-all cursor-pointer text-xs"
                >
                  {createRoomMutation.isPending ? "Saving..." : "Save Room"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-border pt-3">
              <button
                onClick={() => setIsWardRoomModalOpen(false)}
                className="h-8.5 px-4 text-xs font-semibold rounded-lg bg-surface border border-border text-ink-2 hover:bg-page cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ASSIGN BED TO PATIENT MODAL (POST /facilities/beds/<id>/assign/) */}
      {isAssignModalOpen && assignTargetBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${
                    assignTargetBed.status === "reserved"
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-blue-500/10 text-blue-600"
                  }`}
                >
                  <FiUserPlus />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-1">
                    {assignTargetBed.status === "reserved"
                      ? "Admit Reserved Patient"
                      : assignTargetBed.status === "maintenance"
                      ? "Admit Patient & Free Bed"
                      : "Assign Patient to Bed"}
                  </h3>
                  <div className="text-[11px] text-ink-3">
                    {assignTargetBed.status === "reserved"
                      ? `Turn reservation into active admission for bed ${assignTargetBed.bed_number}`
                      : assignTargetBed.status === "maintenance"
                      ? `Frees bed ${assignTargetBed.bed_number} from maintenance and assigns patient in one process`
                      : `Admit a patient directly to ${assignTargetBed.bed_number}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-page text-ink-4 hover:text-ink-1 flex items-center justify-center cursor-pointer"
              >
                <FiX />
              </button>
            </div>

            {/* Target Bed Summary */}
            <div className="p-3 bg-page rounded-xl border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-sm text-brand">
                  <RiHotelBedLine />
                </div>
                <div>
                  <div className="font-bold text-ink-1">{assignTargetBed.bed_number}</div>
                  <div className="text-[11px] text-ink-3 capitalize">
                    {assignTargetBed.bed_type.replace("_", " ")} Bed · Room #{assignTargetBed.room}
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border ${
                  assignTargetBed.status === "reserved"
                    ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200/80 dark:border-amber-800"
                    : assignTargetBed.status === "maintenance"
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200/80 dark:border-rose-800"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300"
                }`}
              >
                {assignTargetBed.status}
              </span>
            </div>

            {/* Maintenance Auto-Release Notice */}
            {assignTargetBed.status === "maintenance" && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
                <FiCheckCircle className="text-blue-600 dark:text-blue-400 text-sm shrink-0" />
                <div className="flex-1 leading-snug">
                  <span className="font-semibold">Auto-Release:</span>{" "}
                  <span className="text-blue-700 dark:text-blue-300">
                    Bed will be automatically freed from maintenance upon admission.
                  </span>
                </div>
              </div>
            )}

            {/* Reserved Patient Details Card (When bed is already reserved) */}
            {assignTargetBed.patient ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm shrink-0 font-bold">
                    <FiUserCheck />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400">
                      Reserved Patient
                    </div>
                    <div className="text-xs font-bold text-ink-1">
                      {assignTargetBed.patient.name}
                    </div>
                    <div className="text-[10px] text-ink-3 font-mono">
                      UHID: {assignTargetBed.patient.uhid}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                  Locked to Patient
                </span>
              </div>
            ) : null}

            <div className="flex flex-col gap-3.5 text-xs">
              {/* Patient Selection (Only displayed when bed does NOT have a reserved patient) */}
              {!assignTargetBed.patient && assignTargetBed.status !== "reserved" && (
                <div>
                  <label className="block font-semibold text-ink-2 mb-1">
                    Select Patient *
                  </label>
                  {availablePatientsForAssign.length > 0 ? (
                    <select
                      value={assignForm.patient}
                      onChange={(e) => setAssignForm({ ...assignForm, patient: e.target.value })}
                      className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs focus:ring-2 focus:ring-brand/30 focus:outline-none"
                    >
                      <option value="">Select an unassigned patient...</option>
                      {availablePatientsForAssign.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.name || `Patient #${p.id}`} {p.uhid ? `(UHID: ${p.uhid})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
                      All registered patients already have active or reserved beds. No unassigned patients available.
                    </div>
                  )}
                </div>
              )}

              {/* Admitting Doctor Selection */}
              <div>
                <label className="block font-semibold text-ink-2 mb-1">
                  Admitting Doctor *
                </label>
                {doctorsList.length > 0 ? (
                  <select
                    value={assignForm.admitting_doctor}
                    onChange={(e) => setAssignForm({ ...assignForm, admitting_doctor: e.target.value })}
                    className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs focus:ring-2 focus:ring-brand/30 focus:outline-none"
                  >
                    <option value="">Select admitting doctor...</option>
                    {doctorsList.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.user_name || d.name || d.full_name || `#${d.id}`}{" "}
                        {d.department_name ? `(${d.department_name})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter doctor UUID or ID (e.g. 5)"
                    value={assignForm.admitting_doctor}
                    onChange={(e) => setAssignForm({ ...assignForm, admitting_doctor: e.target.value })}
                    className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs focus:ring-2 focus:ring-brand/30 focus:outline-none"
                  />
                )}
              </div>

              {/* Admission Type */}
              <div>
                <label className="block font-semibold text-ink-2 mb-1">
                  Admission Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, admission_type: "planned" })}
                    className={`h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      assignForm.admission_type === "planned"
                        ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                        : "bg-surface border-border text-ink-3 hover:bg-page"
                    }`}
                  >
                    <span>Planned Admission</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, admission_type: "emergency" })}
                    className={`h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      assignForm.admission_type === "emergency"
                        ? "bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                        : "bg-surface border-border text-ink-3 hover:bg-page"
                    }`}
                  >
                    <span>Emergency</span>
                  </button>
                </div>
              </div>

              {/* Admission Diagnosis */}
              <div>
                <label className="block font-semibold text-ink-2 mb-1">
                  Admission Diagnosis <span className="font-normal text-ink-4">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Acute appendicitis, scheduled for laparoscopy"
                  value={assignForm.admission_diagnosis}
                  onChange={(e) => setAssignForm({ ...assignForm, admission_diagnosis: e.target.value })}
                  className="w-full p-2.5 border border-border-strong rounded-lg bg-surface text-xs focus:ring-2 focus:ring-brand/30 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              {assignTargetBed.status === "reserved" ? (
                <button
                  type="button"
                  disabled={updateStatusMutation.isPending}
                  onClick={() => {
                    setIsAssignModalOpen(false)
                    updateStatusMutation.mutate({
                      id: assignTargetBed.id,
                      status: "occupied",
                      patient: assignTargetBed.patient?.id || assignForm.patient || undefined,
                    })
                  }}
                  className="h-8.5 px-3 text-xs font-semibold rounded-lg bg-page border border-border text-ink-2 hover:bg-border/60 transition-all cursor-pointer"
                  title="Directly switch status to Occupied via update_status API without creating full admission entry"
                >
                  Direct Mark Occupied
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-surface border border-border text-ink-2 hover:bg-page cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={
                    (!assignForm.patient && !assignTargetBed.patient?.id) ||
                    !assignForm.admitting_doctor ||
                    assignMutation.isPending
                  }
                  onClick={() =>
                    assignMutation.mutate({
                      id: assignTargetBed.id,
                      payload: {
                        ...assignForm,
                        patient:
                          assignForm.patient ||
                          (assignTargetBed.patient?.id ? String(assignTargetBed.patient.id) : ""),
                      },
                    })
                  }
                  className="h-8.5 px-4 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <FiUserCheck className="text-xs" />
                  <span>
                    {assignMutation.isPending
                      ? "Processing..."
                      : assignTargetBed.status === "maintenance"
                      ? "Free & Assign Patient"
                      : assignTargetBed.status === "reserved"
                      ? "Admit & Occupy Bed"
                      : "Confirm & Assign Patient"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. RESERVE BED MODAL (POST /facilities/beds/<id>/update_status/ with { status: "reserved", patient }) */}
      {isReserveModalOpen && reserveTargetBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center text-base">
                  <FiClock />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-1">
                    Reserve Bed: {reserveTargetBed.bed_number}
                  </h3>
                  <div className="text-[11px] text-ink-3">
                    Reserve this bed for an incoming patient
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsReserveModalOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-page text-ink-4 hover:text-ink-1 flex items-center justify-center cursor-pointer"
              >
                <FiX />
              </button>
            </div>

            {/* Target Bed Summary */}
            <div className="p-3 bg-page rounded-xl border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-sm text-brand">
                  <RiHotelBedLine />
                </div>
                <div>
                  <div className="font-bold text-ink-1">{reserveTargetBed.bed_number}</div>
                  <div className="text-[11px] text-ink-3 capitalize">
                    {reserveTargetBed.bed_type.replace("_", " ")} Bed · Room #{reserveTargetBed.room}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300">
                {reserveTargetBed.status}
              </span>
            </div>

            <div className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-ink-2 mb-1">
                  Select Patient to Reserve For *
                </label>
                {availablePatientsForReserve.length > 0 ? (
                  <select
                    value={reservePatientId}
                    onChange={(e) => setReservePatientId(e.target.value)}
                    className="w-full h-9 px-3 border border-border-strong rounded-lg bg-surface text-xs focus:ring-2 focus:ring-brand/30 focus:outline-none"
                  >
                    <option value="">Select an unassigned patient...</option>
                    {availablePatientsForReserve.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.name || `Patient #${p.id}`} {p.uhid ? `(UHID: ${p.uhid})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
                    All registered patients already have active or reserved beds. No unassigned patients available to reserve.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <button
                onClick={() => setIsReserveModalOpen(false)}
                className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-surface border border-border text-ink-2 hover:bg-page cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!reservePatientId || availablePatientsForReserve.length === 0 || updateStatusMutation.isPending}
                onClick={() => {
                  const existing = assignedPatientBedMap.get(String(reservePatientId))
                  if (existing && existing.bedId !== reserveTargetBed.id) {
                    showToast(
                      "Reservation Blocked",
                      `This patient already has Bed ${existing.bedNumber} (${existing.status}). A patient cannot be assigned multiple beds.`,
                      "err"
                    )
                    return
                  }
                  updateStatusMutation.mutate({
                    id: reserveTargetBed.id,
                    status: "reserved",
                    patient: reservePatientId,
                  })
                }}
                className="h-8.5 px-4 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <FiClock className="text-xs" />
                <span>{updateStatusMutation.isPending ? "Reserving..." : "Confirm & Reserve Bed"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
