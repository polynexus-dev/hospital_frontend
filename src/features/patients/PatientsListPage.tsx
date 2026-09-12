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

export function PatientsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, setUser } = useAuthStore()
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string>(user?.hospital || "")

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
    gender: "male",
    preferred_language: "en",
    city: "",
    insurance_provider: "",
  })

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
        gender: "male",
        preferred_language: "en",
        city: "",
        insurance_provider: "",
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
                      <td className="px-6 py-4 text-slate-700">{p.mobile}</td>
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
    </div>
  )
}

