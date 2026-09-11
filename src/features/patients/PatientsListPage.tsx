import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { NeutralTag } from "../../components/ui/Pill"
import { ErrorState, LoadingState } from "../../components/ui/QueryStates"
import { createPatient, listPatients } from "../../api/patients"
import type { Patient } from "../../types/api"

export function PatientsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
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
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.first_name || !formData.mobile) return
    createMutation.mutate(formData)
  }

  const patients = data?.results ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Patient Directory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Search and manage complete Patient 360 records</p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>+ New Patient</Button>
      </div>

      <Card className="p-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by patient name, mobile, MRN, email..."
            className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {isLoading && <LoadingState />}
      {isError && <ErrorState />}

      {!isLoading && !isError && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
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
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
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
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                        {p.full_name || `${p.first_name} ${p.last_name}`}
                      </td>
                      <td className="px-6 py-4">{p.mobile}</td>
                      <td className="px-6 py-4 capitalize">{p.gender || "N/A"}</td>
                      <td className="px-6 py-4">
                        <NeutralTag>{(p.preferred_language || "en").toUpperCase()}</NeutralTag>
                      </td>
                      <td className="px-6 py-4">{p.city || "—"}</td>
                      <td className="px-6 py-4">{p.insurance_provider || "Self-pay"}</td>
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
          <Card className="w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Register New Patient</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">First Name *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Last Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Mobile *</label>
                  <input
                    required
                    type="tel"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Gender</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Preferred Language</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
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
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">City</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Create Patient"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
