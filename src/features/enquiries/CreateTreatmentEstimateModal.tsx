import { useState, useMemo } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { listDoctors } from "../../api/appointments"
import { listPatients } from "../../api/patients"
import { createTreatmentEstimate, type TreatmentEstimate } from "../../api/enquiries"
import type { Doctor } from "../../types/api"
import { Button } from "../../components/ui/Button"
import { showToast } from "../../components/ui/Toast"

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  defaultPatientId?: number
  defaultEnquiryId?: number
}

const COMMON_PROCEDURES = [
  "Total Knee Replacement (TKR)",
  "Total Hip Replacement (THR)",
  "Laparoscopic Cholecystectomy",
  "Laparoscopic Appendectomy",
  "Normal Vaginal Delivery",
  "Cesarean Section (LSCS)",
  "Cataract Surgery (Phaco + Monofocal IOL)",
  "Cataract Surgery (Phaco + Premium Trifocal IOL)",
  "Coronary Angiography",
  "Coronary Angioplasty (PTCA + DES)",
  "Transurethral Resection of Prostate (TURP)",
  "Hernioplasty (Mesh Repair)",
]

const SURGICAL_DEPARTMENTS = [
  "Orthopedics & Joint Care",
  "General & Laparoscopic Surgery",
  "Obstetrics & Gynecology",
  "Cardiology & Cath Lab",
  "Ophthalmology / Eye Care",
  "Urology & Nephrology",
  "ENT & Head/Neck",
  "Neuro Surgery & Spine",
  "Surgical Oncology",
]

export function CreateTreatmentEstimateModal({ open, onClose, onCreated, defaultPatientId, defaultEnquiryId }: Props) {
  const [patientId, setPatientId] = useState<number | undefined>(defaultPatientId)
  const [patientSearch, setPatientSearch] = useState("")
  const [doctorId, setDoctorId] = useState<number | undefined>()
  const [departmentName, setDepartmentName] = useState("Orthopedics & Joint Care")
  const [procedureName, setProcedureName] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [roomCategory, setRoomCategory] = useState<TreatmentEstimate["room_category"]>("semi_private")
  const [stayDays, setStayDays] = useState(2)

  // Cost items
  const [surgeonFee, setSurgeonFee] = useState<number>(35000)
  const [otCharges, setOtCharges] = useState<number>(20000)
  const [roomCharges, setRoomCharges] = useState<number>(12000)
  const [medicinesEstimate, setMedicinesEstimate] = useState<number>(15000)
  const [implantsInvestigations, setImplantsInvestigations] = useState<number>(25000)

  // Insurance & Pre-Auth
  const [paymentMode, setPaymentMode] = useState<TreatmentEstimate["payment_mode"]>("insurance")
  const [tpaName, setTpaName] = useState("Star Health")
  const [preauthStatus, setPreauthStatus] = useState<TreatmentEstimate["insurance_preauth_status"]>("pending_docs")
  const [approvedAmount, setApprovedAmount] = useState<number | undefined>()
  const [stage, setStage] = useState<TreatmentEstimate["stage"]>("counseling")
  const [notes, setNotes] = useState("")


  const computedTotal = useMemo(() => {
    return (Number(surgeonFee) || 0) + (Number(otCharges) || 0) + (Number(roomCharges) || 0) + (Number(medicinesEstimate) || 0) + (Number(implantsInvestigations) || 0)
  }, [surgeonFee, otCharges, roomCharges, medicinesEstimate, implantsInvestigations])

  const { data: doctorsData } = useQuery({
    queryKey: ["appointments", "doctors"],
    queryFn: listDoctors,
    enabled: open,
  })

  const { data: patientsData } = useQuery({
    queryKey: ["patients", patientSearch],
    queryFn: () => listPatients(patientSearch),
    enabled: open && patientSearch.length >= 2,
  })

  const createMutation = useMutation({
    mutationFn: createTreatmentEstimate,
    onSuccess: () => {
      showToast("Treatment cost estimate created successfully!", "success")
      onCreated()
      onClose()
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.detail || "Failed to create treatment estimate", "error")
    },
  })

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!procedureName.trim()) {
      showToast("Please enter or select a procedure name", "error")
      return
    }

    createMutation.mutate({
      patient: patientId || undefined,
      enquiry: defaultEnquiryId || undefined,
      doctor: doctorId || undefined,
      department_name: departmentName,
      procedure_name: procedureName,
      diagnosis,
      room_category: roomCategory,
      stay_days: Number(stayDays) || 1,
      surgeon_fee: surgeonFee,
      ot_charges: otCharges,
      room_charges: roomCharges,
      medicines_estimate: medicinesEstimate,
      implants_investigations: implantsInvestigations,
      total_estimate: computedTotal,
      payment_mode: paymentMode,
      tpa_name: tpaName,
      insurance_preauth_status: preauthStatus,
      approved_preauth_amount: approvedAmount || undefined,
      stage,
      notes,
    })
  }

  const doctorList: Doctor[] = doctorsData?.results || []


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📋</span> Generate Surgical Treatment Estimate
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create an itemized surgical package estimate & financial counseling quote for the patient
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm">
          {/* Patient Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Patient (or search by name/phone)
            </label>
            <input
              type="text"
              placeholder="Type patient name or mobile..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {patientsData && patientsData.results.length > 0 && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                {patientsData.results.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setPatientId(p.id)
                      setPatientSearch(`${p.full_name} (${p.mobile || p.uhid || "ID: " + p.id})`)
                    }}
                    className={`cursor-pointer rounded px-2.5 py-1.5 text-xs hover:bg-teal-50 dark:hover:bg-teal-900/30 flex justify-between ${
                      patientId === p.id ? "bg-teal-100 font-semibold text-teal-800 dark:bg-teal-900/50 dark:text-teal-200" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span>{p.full_name}</span>
                    <span className="text-slate-400">{p.mobile || p.uhid}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Procedure & Doctor Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Procedure Name *
              </label>
              <input
                type="text"
                list="procedure-suggestions"
                required
                placeholder="e.g. Total Knee Replacement"
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <datalist id="procedure-suggestions">
                {COMMON_PROCEDURES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Consultant / Operating Surgeon
              </label>
              <select
                value={doctorId || ""}
                onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select Doctor...</option>
                {doctorList.map((doc: Doctor) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.name || `Doctor #${doc.id}`} ({doc.speciality || "Surgeon"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <select
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {SURGICAL_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>


            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Clinical Diagnosis
              </label>
              <input
                type="text"
                placeholder="e.g. Severe Osteoarthritis Grade IV"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Room & Stay Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Room Category
              </label>
              <select
                value={roomCategory}
                onChange={(e) => setRoomCategory(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="general">General Ward</option>
                <option value="semi_private">Semi-Private (Twin Sharing)</option>
                <option value="private">Private Room (AC)</option>
                <option value="deluxe">Deluxe Suite</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expected Inpatient Stay (Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={stayDays}
                onChange={(e) => setStayDays(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Cost Breakdown Grid */}
          <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4 dark:border-teal-900/50 dark:bg-teal-950/20">
            <h3 className="text-xs font-semibold text-teal-800 dark:text-teal-200 mb-3 flex items-center gap-1.5">
              <span>💰</span> Cost Breakdown (INR)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Surgeon / Team Fee
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={surgeonFee}
                  onChange={(e) => setSurgeonFee(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  OT & Recovery
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={otCharges}
                  onChange={(e) => setOtCharges(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Room & Nursing
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={roomCharges}
                  onChange={(e) => setRoomCharges(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Medicines & Fluids
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={medicinesEstimate}
                  onChange={(e) => setMedicinesEstimate(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Implants / Stents
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={implantsInvestigations}
                  onChange={(e) => setImplantsInvestigations(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="bg-teal-100/70 dark:bg-teal-900/40 rounded-lg p-2 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-teal-800 dark:text-teal-300">
                  Total Package
                </span>
                <span className="text-base font-bold text-teal-900 dark:text-teal-100">
                  ₹{computedTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Payment & Insurance Pre-Auth */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Channel
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="cash">Self Pay / Cash</option>
                <option value="insurance">Private Insurance (Cashless)</option>
                <option value="govt_scheme">Ayushman / CGHS / Govt Scheme</option>
                <option value="corporate">Corporate TPA</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                TPA / Insurer Name
              </label>
              <input
                type="text"
                placeholder="e.g. Star Health, Medi Assist"
                value={tpaName}
                onChange={(e) => setTpaName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pre-Auth Status
              </label>
              <select
                value={preauthStatus}
                onChange={(e) => setPreauthStatus(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="not_applicable">Not Applicable (Cash)</option>
                <option value="pending_docs">Documents Pending</option>
                <option value="submitted">Submitted to TPA</option>
                <option value="query_raised">Query Raised by TPA</option>
                <option value="approved">Pre-Auth Approved</option>
                <option value="denied">Pre-Auth Denied</option>
              </select>
            </div>

            {preauthStatus === "approved" && (
              <div>
                <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                  Approved Pre-Auth (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150000"
                  value={approvedAmount || ""}
                  onChange={(e) => setApprovedAmount(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full rounded-lg border border-emerald-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none dark:border-emerald-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            )}
          </div>


          {/* Stage & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Counseling Funnel Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="advised">Advised by Doctor</option>
                <option value="counseling">Financial Counseling</option>
                <option value="estimate_shared">Estimate Shared with Patient</option>
                <option value="preauth_in_progress">Insurance Pre-Auth in Progress</option>
                <option value="scheduled">Surgery Scheduled</option>
                <option value="converted">Admitted / Converted</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Financial Counselor Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Patient agreed for private room, waiting for spouse approval"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Generating..." : "Generate Estimate Sheet"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
