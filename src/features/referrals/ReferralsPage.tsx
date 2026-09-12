import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { NeutralTag, SuccessTag } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"
import {
  listFieldVisits,
  listReferralLeagueTable,
  listReferringDoctors,
  createReferringDoctor,
  createFieldVisit,
  type ReferringDoctor,
} from "../../api/referrals"

export function ReferralsPage() {
  const [activeTab, setActiveTab] = useState<"league" | "directory" | "visits">("league")
  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [showLogVisit, setShowLogVisit] = useState(false)

  const { data: leagueData, isLoading: isLeagueLoading } = useQuery({
    queryKey: ["referrals-league"],
    queryFn: listReferralLeagueTable,
    enabled: activeTab === "league",
  })

  const { data: doctorsData, isLoading: isDoctorsLoading } = useQuery({
    queryKey: ["referral-doctors"],
    queryFn: listReferringDoctors,
    enabled: activeTab === "directory" || showLogVisit,
  })

  const { data: visitsData, isLoading: isVisitsLoading } = useQuery({
    queryKey: ["field-visits"],
    queryFn: listFieldVisits,
    enabled: activeTab === "visits",
  })

  const topDoctors = leagueData ?? []
  const allDoctors = doctorsData?.results ?? []
  const visits = visitsData?.results ?? []

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "gold":
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">🥇 GOLD TIER</span>
      case "silver":
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">🥈 SILVER TIER</span>
      default:
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-800/20 text-amber-700">🥉 BRONZE TIER</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Referral Doctor CRM</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Referring doctor directory, revenue attribution league table, & field visit touchpoints
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowLogVisit(true)}>
            + Log Field Visit
          </Button>
          <Button variant="primary" onClick={() => setShowAddDoctor(true)}>
            + Add Referring Doctor
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        {[
          { key: "league", label: "Referrer League Table" },
          { key: "directory", label: "Doctor Directory" },
          { key: "visits", label: "Field Visit Logs" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: REFERRER LEAGUE TABLE */}
      {activeTab === "league" && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Top Referring Doctors (Revenue Attributed)</h2>
              <p className="text-xs text-slate-500">Ranked by total patient referral revenue generated this year</p>
            </div>
          </div>

          {isLeagueLoading ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {topDoctors.map((doc, idx) => (
                <Card key={doc.id} className="p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold text-base flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">{doc.name}</h3>
                        {getTierBadge(doc.tier)}
                      </div>
                      <span className="text-xs text-slate-500">{doc.speciality} • {doc.clinic_name} ({doc.city})</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(doc.total_attributed_revenue || 0).toLocaleString("en-IN")}
                    </div>
                    <span className="text-xs text-slate-400">{doc.total_referrals || 0} Patient Referrals</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: DOCTOR DIRECTORY */}
      {activeTab === "directory" && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">All Registered Network Doctors</h2>
            <Button size="sm" variant="primary" onClick={() => setShowAddDoctor(true)}>
              + Add Doctor
            </Button>
          </div>
          {isDoctorsLoading ? (
            <LoadingState />
          ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">Doctor Name</th>
                  <th className="px-6 py-3 font-semibold">Clinic & City</th>
                  <th className="px-6 py-3 font-semibold">Contact</th>
                  <th className="px-6 py-3 font-semibold">Tier</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {allDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">
                      {doc.name}
                      <span className="block text-xs font-normal text-slate-400">{doc.speciality}</span>
                    </td>
                    <td className="px-6 py-4">{doc.clinic_name} ({doc.city})</td>
                    <td className="px-6 py-4 text-xs font-mono">{doc.mobile}</td>
                    <td className="px-6 py-4">{getTierBadge(doc.tier)}</td>
                    <td className="px-6 py-4">
                      {doc.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* TAB 3: FIELD VISITS */}
      {activeTab === "visits" && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Representative Field Visit Logs</h2>
            <Button size="sm" variant="secondary" onClick={() => setShowLogVisit(true)}>
              + Log Field Visit
            </Button>
          </div>
          {isVisitsLoading ? (
            <LoadingState />
          ) : (
            <div className="space-y-3">
              {visits.map((v) => (
                <Card key={v.id} className="p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{v.referring_doctor_name}</h3>
                    <span className="text-xs text-slate-400">Visit Date: {v.visit_date}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{v.notes}</p>
                  {v.outcome && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Outcome: {v.outcome}</p>}
                </Card>
              ))}
            </div>
          )}
        </Card>
      )}

      {showAddDoctor && (
        <NewReferringDoctorModal onClose={() => setShowAddDoctor(false)} />
      )}

      {showLogVisit && (
        <NewFieldVisitModal
          doctors={allDoctors}
          onClose={() => setShowLogVisit(false)}
        />
      )}
    </div>
  )
}

function NewReferringDoctorModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [speciality, setSpeciality] = useState("")
  const [clinicName, setClinicName] = useState("")
  const [city, setCity] = useState("Pune")
  const [mobile, setMobile] = useState("")
  const [email, setEmail] = useState("")
  const [tier, setTier] = useState<"gold" | "silver" | "bronze">("silver")
  const [notes, setNotes] = useState("")

  const addDoc = useMutation({
    mutationFn: () =>
      createReferringDoctor({
        name,
        speciality,
        clinic_name: clinicName,
        city,
        mobile,
        email,
        tier,
        notes,
        is_active: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-doctors"] })
      queryClient.invalidateQueries({ queryKey: ["referrals-league"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-5 w-[460px] shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-bold text-ink">Add Referring Doctor</h3>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-xs p-1">✕</button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Doctor Name *</label>
            <input
              placeholder="e.g. Dr. Rajesh Kulkarni"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Speciality</label>
              <input
                placeholder="e.g. General Physician, Ortho"
                value={speciality}
                onChange={(e) => setSpeciality(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Partnership Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as any)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              >
                <option value="gold">🥇 Gold Tier</option>
                <option value="silver">🥈 Silver Tier</option>
                <option value="bronze">🥉 Bronze Tier</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Clinic Name</label>
              <input
                placeholder="e.g. Kulkarni Clinic"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">City</label>
              <input
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Mobile *</label>
              <input
                placeholder="10-digit mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Email</label>
              <input
                placeholder="doctor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Notes / Relationship Info</label>
            <textarea
              rows={2}
              placeholder="e.g. Met at CME conference, interested in referring spine surgery cases"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border justify-end">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={addDoc.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => addDoc.mutate()}
            disabled={!name.trim() || !mobile.trim() || addDoc.isPending}
          >
            {addDoc.isPending ? "Saving…" : "Save Doctor"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function NewFieldVisitModal({
  doctors,
  onClose,
}: {
  doctors: ReferringDoctor[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [doctorId, setDoctorId] = useState<number | "">(doctors[0]?.id ?? "")
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split("T")[0])
  const [outcome, setOutcome] = useState("")
  const [notes, setNotes] = useState("")

  const logVisit = useMutation({
    mutationFn: () =>
      createFieldVisit({
        referring_doctor: Number(doctorId),
        visit_date: visitDate,
        notes: notes || "Routine touchpoint visit",
        outcome: outcome || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-visits"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-5 w-[440px] shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-bold text-ink">Log Field Visit Touchpoint</h3>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-xs p-1">✕</button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Referring Doctor *</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(Number(e.target.value))}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.clinic_name || d.city})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Visit Date</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Visit Outcome / Key Discussion</label>
            <input
              placeholder="e.g. Shared brochure, committed 3 ortho referrals/month"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Detailed Visit Notes</label>
            <textarea
              rows={3}
              placeholder="Doctor feedback, requested facilities, follow-up items..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border justify-end">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={logVisit.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => logVisit.mutate()}
            disabled={!doctorId || logVisit.isPending}
          >
            {logVisit.isPending ? "Logging…" : "Log Visit"}
          </Button>
        </div>
      </div>
    </div>
  )
}
