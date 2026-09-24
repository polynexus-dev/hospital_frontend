import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { NeutralTag } from "../../components/ui/Pill"
import { ErrorState, LoadingState } from "../../components/ui/QueryStates"
import { createPatient, listPatients } from "../../api/patients"
import { listHospitals } from "../../api/hospitals"
import { switchHospital } from "../../api/auth"
import { extractApiError } from "../../api/client"
import { useAuthStore } from "../../store/auth"
import type { Patient } from "../../types/api"
import { RecallHubModal } from "./RecallHubModal"

export function PatientsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, setUser } = useAuthStore()
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false)
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false)
  const [noticeLang, setNoticeLang] = useState<"en" | "hi" | "mr">("en")
  const [revealedPatientIds, setRevealedPatientIds] = useState<number[]>([])
  const [revealTargetPatient, setRevealTargetPatient] = useState<Patient | null>(null)
  const [revealReason, setRevealReason] = useState("")
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string>(user?.hospital || "")

  const canViewSensitive = user?.permissions?.includes("patients.view_sensitive_demographics") ?? false

  const maskPhone = (phone: string) => {
    if (!phone) return "—"
    if (phone.length >= 10) {
      return phone.replace(/(\d{2,3})\d{5}(\d{3})/, "$1*****$2")
    }
    return phone.slice(0, 2) + "*****" + phone.slice(-2)
  }


  const { data: hospitalsList } = useQuery({
    queryKey: ["hospitals"],
    queryFn: listHospitals,
    enabled: !user?.hospital,
  })

  const availableBranches = useMemo(() => {
    if (user?.available_hospitals && user.available_hospitals.length > 0) {
      return user.available_hospitals
    }
    if (hospitalsList && hospitalsList.length > 0) {
      return hospitalsList.map((h) => ({
        id: h.id,
        name: h.name,
        slug: h.slug,
        city: h.city,
      }))
    }
    return []
  }, [user?.available_hospitals, hospitalsList])

  const [formData, setFormData] = useState<Partial<Patient>>({
    first_name: "",
    last_name: "",
    mobile: "",
    email: "",
    date_of_birth: "",
    gender: "male",
    preferred_language: "en",
    city: "",
    insurance_provider: "",
    guardian_name: "",
    guardian_phone: "",
    relationship_to_guardian: "Parent",
    guardian_consent_recorded: false,
  })

  const calculateAge = (dob: string | null | undefined): number | null => {
    if (!dob) return null
    const birthDate = new Date(dob)
    if (isNaN(birthDate.getTime())) return null
    const diff = Date.now() - birthDate.getTime()
    const ageDate = new Date(diff)
    return Math.abs(ageDate.getUTCFullYear() - 1970)
  }

  const patientAge = calculateAge(formData.date_of_birth)
  const isMinor = patientAge !== null && patientAge < 18

  const { data, isLoading, isError } = useQuery({
    queryKey: ["patients", search],
    queryFn: () => listPatients(search),
  })

  const createMutation = useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] })
      setIsModalOpen(false)
      setMutationError(null)
      setFormData({
        first_name: "",
        last_name: "",
        mobile: "",
        email: "",
        date_of_birth: "",
        gender: "male",
        preferred_language: "en",
        city: "",
        insurance_provider: "",
        guardian_name: "",
        guardian_phone: "",
        relationship_to_guardian: "Parent",
        guardian_consent_recorded: false,
      })
    },

    onError: (err) => {
      const msg = extractApiError(err, "Failed to create patient.")
      setMutationError(msg)
    },
  })

  const handleSwitchBranchDirectly = async (branchId: string) => {
    try {
      const updatedUser = await switchHospital(branchId)
      if (updatedUser) {
        setUser(updatedUser)
        setSelectedBranch(branchId)
        queryClient.invalidateQueries({ queryKey: ["patients"] })
      }
    } catch (err) {
      console.error("Failed to switch branch:", err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMutationError(null)
    if (!formData.first_name || !formData.mobile) return

    if (isMinor && (!formData.guardian_name || !formData.guardian_phone)) {
      setMutationError("DPDP Act §9 Mandate: Parent / Lawful Guardian Name & Verified Phone required for patients under 18 years.")
      return
    }

    // Ensure the user is attached to a hospital before creating
    if (!user?.hospital) {
      const targetBranch = selectedBranch || (availableBranches.length > 0 ? availableBranches[0].id : null)
      if (!targetBranch) {
        setMutationError("Please select a hospital branch to register this patient.")
        return
      }
      try {
        const updatedUser = await switchHospital(targetBranch)
        if (updatedUser) {
          setUser(updatedUser)
        }
      } catch (err) {
        setMutationError(extractApiError(err, "Failed to attach to the selected hospital branch."))
        return
      }
    }

    createMutation.mutate({
      ...formData,
      ...(isMinor ? { guardian_consent_recorded: true } : {}),
      ...(user?.hospital || selectedBranch ? { hospital: user?.hospital || selectedBranch } : {}),
    } as any)
  }

  const patients = data?.results ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Directory</h1>
          <p className="text-sm text-slate-600 mt-0.5">Search and manage complete Patient 360 records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setIsNoticeModalOpen(true)}
            className="border border-indigo-200 text-indigo-800 hover:bg-indigo-50"
          >
            📋 DPDP Itemized Notice
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsRecallModalOpen(true)}
            className="border border-teal-200 text-teal-800 hover:bg-teal-50"
          >
            🩺 Clinical Recalls Hub
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setMutationError(null)
              if (!selectedBranch && availableBranches.length > 0) {
                setSelectedBranch(availableBranches[0].id)
              }
              setIsModalOpen(true)
            }}
          >
            + New Patient
          </Button>
        </div>
      </div>

      {/* Hospital Warning Banner if not attached to a branch */}
      {!user?.hospital && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h3 className="font-bold text-sm text-amber-900">Hospital Branch Required</h3>
              <p className="text-xs text-amber-800">
                You are currently not attached to a hospital branch. Please select an active branch to register patients and view records.
              </p>
            </div>
          </div>
          {availableBranches.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-amber-900">Select Branch:</span>
              <select
                className="bg-white border border-amber-400 text-slate-900 font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs focus:ring-2 focus:ring-amber-500"
                value={selectedBranch || ""}
                onChange={(e) => handleSwitchBranchDirectly(e.target.value)}
              >
                <option value="" disabled>Choose active branch...</option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.city || "Main"})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <Card className="p-4 border border-slate-200 shadow-xs">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by patient name, mobile, MRN, email..."
            className="flex-1 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {isLoading && <LoadingState />}
      {isError && <ErrorState />}

      {!isLoading && !isError && (
        <Card className="overflow-hidden border border-slate-200 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-semibold">Patient Name</th>
                  <th className="px-6 py-3 font-semibold">Mobile</th>
                  <th className="px-6 py-3 font-semibold">Gender</th>
                  <th className="px-6 py-3 font-semibold">Language</th>
                  <th className="px-6 py-3 font-semibold">City</th>
                  <th className="px-6 py-3 font-semibold">Insurance</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                      No patients found matching your search.
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {p.full_name || `${p.first_name} ${p.last_name}`}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {canViewSensitive || revealedPatientIds.includes(p.id) ? (
                          <span className="font-mono">{p.mobile}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-500">{maskPhone(p.mobile)}</span>
                            <button
                              type="button"
                              title="Reveal PII with Audit Log"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRevealTargetPatient(p)
                              }}
                              className="text-xs px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 font-semibold"
                            >
                              👁️ Reveal
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 capitalize text-slate-700">{p.gender || "N/A"}</td>
                      <td className="px-6 py-4">
                        <NeutralTag>{(p.preferred_language || "en").toUpperCase()}</NeutralTag>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{p.city || "—"}</td>
                      <td className="px-6 py-4 text-slate-700">{p.insurance_provider || "Self-pay"}</td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/patients/${p.id}`)
                          }}
                        >
                          View 360 →
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* New Patient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-xl font-bold text-slate-900">Register New Patient</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {mutationError && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-start gap-2.5 shadow-2xs">
                <span className="text-base">❌</span>
                <div className="flex-1">
                  <div>{mutationError}</div>
                  {mutationError.includes("not attached to a hospital") && (
                    <div className="mt-1 font-normal text-rose-800">
                      Please select a hospital branch below to attach your account before saving this patient.
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Branch Selector inside modal if not attached to a hospital */}
              {!user?.hospital && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Hospital Branch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-3.5 py-2.5 border rounded-lg bg-white text-slate-900 border-amber-400 font-semibold text-sm focus:ring-2 focus:ring-amber-500"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  >
                    <option value="" disabled>Select hospital branch...</option>
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.city || "Main"})</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-amber-800 mt-1">
                    Your account will attach to this hospital branch to complete registration.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">First Name *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Mobile *</label>
                  <input
                    required
                    type="tel"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={formData.date_of_birth || ""}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Gender</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* DPDP §9 Minor Guardian Check */}
              {isMinor && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-amber-900 tracking-wider">
                      🛡️ Parent / Lawful Guardian Information (DPDP §9 Minor Consent Required)
                    </h4>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded">
                      Age: {patientAge} years
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-amber-900 mb-1">Guardian Name *</label>
                      <input
                        required
                        type="text"
                        placeholder="Parent / Guardian Full Name"
                        className="w-full px-3 py-1.5 border rounded-lg bg-white text-slate-900 border-amber-400 text-xs focus:ring-2 focus:ring-amber-500"
                        value={formData.guardian_name || ""}
                        onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-amber-900 mb-1">Guardian Phone / ID *</label>
                      <input
                        required
                        type="tel"
                        placeholder="Verified Phone Number"
                        className="w-full px-3 py-1.5 border rounded-lg bg-white text-slate-900 border-amber-400 text-xs focus:ring-2 focus:ring-amber-500"
                        value={formData.guardian_phone || ""}
                        onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-amber-900 mb-1">Relationship to Minor</label>
                    <select
                      className="w-full px-3 py-1.5 border rounded-lg bg-white text-slate-900 border-amber-400 text-xs focus:ring-2 focus:ring-amber-500"
                      value={formData.relationship_to_guardian || "Parent"}
                      onChange={(e) => setFormData({ ...formData, relationship_to_guardian: e.target.value })}
                    >
                      <option value="Parent">Parent (Mother / Father)</option>
                      <option value="Legal Guardian">Legal Guardian</option>
                      <option value="Grandparent">Grandparent</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Preferred Language</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={formData.preferred_language}
                    onChange={(e) => setFormData({ ...formData, preferred_language: e.target.value as any })}
                  >
                    <option value="en">English</option>
                    <option value="mr">Marathi (मराठी)</option>
                    <option value="hi">Hindi (हिंदी)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg bg-white text-slate-900 border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Create Patient"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Log PII Reveal Justification Modal */}
      {revealTargetPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md p-6 space-y-4 bg-white rounded-xl shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>🛡️</span> DPDP Audit Log: Reveal Patient PII
              </h2>
              <button
                type="button"
                onClick={() => setRevealTargetPatient(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are requesting to view full unmasked phone/contact details for <strong>{revealTargetPatient.full_name}</strong>. Under DPDP Act Section 4 data minimization, this action is audit-logged.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Justification Reason *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Front-desk patient check-in & ID verification"
                className="w-full p-2.5 border rounded-lg bg-white text-slate-900 border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                value={revealReason}
                onChange={(e) => setRevealReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button type="button" variant="secondary" onClick={() => setRevealTargetPatient(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  if (!revealReason.trim()) return
                  setRevealedPatientIds((prev) => [...prev, revealTargetPatient.id])
                  setRevealTargetPatient(null)
                  setRevealReason("")
                }}
              >
                Confirm & Log Audit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DPDP Section 5 Itemized Consent Notice Modal */}
      {isNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  📜 DPDP Act 2023 §5 Itemized Consent Notice
                </h2>
                <p className="text-xs text-slate-500">Multilingual Statutory Notice for Patient Onboarding</p>
              </div>
              <button
                type="button"
                onClick={() => setIsNoticeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg w-fit text-xs">
              <button
                type="button"
                onClick={() => setNoticeLang("en")}
                className={`px-3 py-1 rounded-md font-bold transition-colors ${
                  noticeLang === "en" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setNoticeLang("hi")}
                className={`px-3 py-1 rounded-md font-bold transition-colors ${
                  noticeLang === "hi" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                }`}
              >
                हिंदी (Hindi)
              </button>
              <button
                type="button"
                onClick={() => setNoticeLang("mr")}
                className={`px-3 py-1 rounded-md font-bold transition-colors ${
                  noticeLang === "mr" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                }`}
              >
                मराठी (Marathi)
              </button>
            </div>

            {/* Multilingual Notice Content */}
            <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed">
              {noticeLang === "en" && (
                <>
                  <h4 className="font-bold text-slate-900 text-sm">Itemized Patient Data Collection Notice</h4>
                  <p>In accordance with Digital Personal Data Protection Act 2023 (DPDP §5 & §9):</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>Data Collected:</strong> Name, Contact Number, Gender, Address, Medical History, Lab Diagnostics, and Insurance Details.</li>
                    <li><strong>Specified Purposes:</strong> Clinical treatment provision, TPA/Insurance claim processing, OPD appointment scheduling, and emergency contact alerts.</li>
                    <li><strong>Children Data (§9):</strong> Processing data of minors (&lt; 18 years) is performed strictly with verifiable parent/guardian consent.</li>
                    <li><strong>Grievance Redressal:</strong> Grievance Officer: <code>privacy@polynexus.health</code> | Toll Free: 1800-102-4422</li>
                  </ul>
                </>
              )}

              {noticeLang === "hi" && (
                <>
                  <h4 className="font-bold text-slate-900 text-sm">विस्तृत मरीज डेटा संग्रह सूचना (डीपीडीपी 2023)</h4>
                  <p>डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम 2023 (§5 एवं §9) के अनुसार:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>एकत्रित डेटा:</strong> नाम, संपर्क नंबर, लिंग, पता, चिकित्सा इतिहास, लैब रिपोर्ट और बीमा विवरण।</li>
                    <li><strong>निर्दिष्ट उद्देश्य:</strong> चिकित्सीय उपचार, टीपीए/बीमा दावा प्रसंस्करण, अपॉइंटमेंट और आपातकालीन संपर्क।</li>
                    <li><strong>नाबालिगों का डेटा (§9):</strong> 18 वर्ष से कम उम्र के बच्चों का डेटा माता-पिता की सहमति से संसाधित होता है।</li>
                    <li><strong>शिकायत निवारण:</strong> शिकायत अधिकारी: <code>privacy@polynexus.health</code> | टोल फ्री: 1800-102-4422</li>
                  </ul>
                </>
              )}

              {noticeLang === "mr" && (
                <>
                  <h4 className="font-bold text-slate-900 text-sm">सविस्तर रुग्ण डेटा संकलन सूचना (डीपीडीपी २०२३)</h4>
                  <p>डिजिटल वैयक्तिक डेटा संरक्षण कायदा २०२३ (कलम ५ आणि ९) नुसार:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li><strong>गोळा केलेला डेटा:</strong> नाव, संपर्क क्रमांक, लिंग, पत्ता, वैद्यकीय इतिहास, लॅब अहवाल आणि विमा तपशील.</li>
                    <li><strong>तपशीलवार उद्दिष्टे:</strong> वैद्यकीय उपचार, टीपीए/विमा दावा प्रक्रिया, भेटींचे नियोजन आणि आपत्कालीन संपर्क.</li>
                    <li><strong>अल्पवयीन मुलांचा डेटा (कलम ९):</strong> १८ वर्षांखालील मुलांचा डेटा पालकांच्या संमतीनेच प्रक्रिया केला जातो.</li>
                    <li><strong>तक्रार निवारण:</strong> तक्रार अधिकारी: <code>privacy@polynexus.health</code> | टोल फ्री: १८००-१०२-४४२२</li>
                  </ul>
                </>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button type="button" variant="primary" onClick={() => setIsNoticeModalOpen(false)}>
                I Understand & Acknowledge
              </Button>
            </div>
          </div>
        </div>
      )}

      <RecallHubModal
        open={isRecallModalOpen}
        onClose={() => setIsRecallModalOpen(false)}
        onBookAppointment={(p) => {
          navigate(`/appointments?patient=${p.id}`)
        }}
      />
    </div>
  )
}


