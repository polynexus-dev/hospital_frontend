import React, { useEffect, useState } from "react"
import { approveLeaveRequest, createAttendance, createEmployee, createLeaveRequest, createShift, linkEmployeeUser, listAttendance, listEmployees, listLeaveRequests, listShifts, rejectLeaveRequest } from "../../api/hr"
import type { Attendance, Employee, LeaveRequest, Shift } from "../../types/api"

export function HRPage() {
  const [activeTab, setActiveTab] = useState<"employees" | "attendance" | "leaves" | "shifts">("employees")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  // Employee Modal
  const [showEmpModal, setShowEmpModal] = useState(false)
  const [empCode, setEmpCode] = useState("")
  const [empDesignation, setEmpDesignation] = useState("")
  const [empType, setEmpType] = useState<Employee["employment_type"]>("permanent")

  // Link User Modal
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [linkUserId, setLinkUserId] = useState("")

  // Attendance Modal
  const [showAttModal, setShowAttModal] = useState(false)
  const [attEmpId, setAttEmpId] = useState("")
  const [attStatus, setAttStatus] = useState<Attendance["status"]>("present")

  // Leave Modal
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveEmpId, setLeaveEmpId] = useState("")
  const [leaveType, setLeaveType] = useState("Casual Leave")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Shift Modal
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [shiftEmpId, setShiftEmpId] = useState("")
  const [shiftDate, setShiftDate] = useState("")
  const [shiftType, setShiftType] = useState<Shift["shift_type"]>("morning")

  const loadData = async () => {
    try {
      setLoading(true)
      const [empRes, attRes, lRes, sRes] = await Promise.all([
        listEmployees(),
        listAttendance(),
        listLeaveRequests(),
        listShifts(),
      ])
      setEmployees(empRes.results)
      setAttendance(attRes.results)
      setLeaves(lRes.results)
      setShifts(sRes.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createEmployee({
        employee_code: empCode,
        designation: empDesignation,
        employment_type: empType,
      })
      setShowEmpModal(false)
      setEmpCode("")
      setEmpDesignation("")
      loadData()
    } catch (err: any) {
      alert("Failed to register employee: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleLinkUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmp || !linkUserId) return
    try {
      await linkEmployeeUser(selectedEmp.id, Number(linkUserId))
      setSelectedEmp(null)
      setLinkUserId("")
      loadData()
    } catch (err: any) {
      alert("Failed to link user profile: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createAttendance({
        employee: Number(attEmpId),
        status: attStatus,
      })
      setShowAttModal(false)
      loadData()
    } catch (err: any) {
      alert("Failed to record attendance: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createLeaveRequest({
        employee: Number(leaveEmpId),
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
      })
      setShowLeaveModal(false)
      loadData()
    } catch (err: any) {
      alert("Failed to apply leave: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleApproveLeave = async (id: number) => {
    try {
      await approveLeaveRequest(id)
      loadData()
    } catch (err: any) {
      alert("Failed to approve leave: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleRejectLeave = async (id: number) => {
    try {
      await rejectLeaveRequest(id)
      loadData()
    } catch (err: any) {
      alert("Failed to reject leave: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createShift({
        employee: Number(shiftEmpId),
        shift_date: shiftDate,
        shift_type: shiftType,
      })
      setShowShiftModal(false)
      loadData()
    } catch (err: any) {
      alert("Failed to schedule shift: " + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Human Resources (HR) & Staff Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage hospital staff directory, user account linkages, attendance, leave approvals, and shift rosters.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEmpModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
          >
            + Register Staff
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-4">
        <button
          onClick={() => setActiveTab("employees")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "employees"
              ? "border-teal-600 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Staff Directory ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab("attendance")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "attendance"
              ? "border-teal-600 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Attendance ({attendance.length})
        </button>
        <button
          onClick={() => setActiveTab("leaves")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "leaves"
              ? "border-teal-600 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Leave Requests ({leaves.length})
        </button>
        <button
          onClick={() => setActiveTab("shifts")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "shifts"
              ? "border-teal-600 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Shift Roster ({shifts.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading HR records...</div>
      ) : activeTab === "employees" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Employment Type</th>
                <th className="px-4 py-3">User Account</th>
                <th className="px-4 py-3">Date Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No employees registered.
                  </td>
                </tr>
              ) : (
                employees.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-bold text-teal-600 dark:text-teal-400">{e.employee_code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{e.designation}</td>
                    <td className="px-4 py-3 capitalize text-xs font-semibold text-slate-600">{e.employment_type}</td>
                    <td className="px-4 py-3">
                      {e.user_detail ? (
                        <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                          {e.user_detail.first_name} ({e.user_detail.email})
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Unlinked</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{e.date_of_joining}</td>
                    <td className="px-4 py-3 text-right">
                      {!e.user && (
                        <button
                          onClick={() => setSelectedEmp(e)}
                          className="px-3 py-1 text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 rounded hover:bg-teal-200"
                        >
                          Link Account
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === "attendance" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAttModal(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded hover:bg-teal-700"
            >
              + Record Attendance
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      No attendance logs recorded.
                    </td>
                  </tr>
                ) : (
                  attendance.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{a.employee_code}</td>
                      <td className="px-4 py-3 text-slate-500">{a.date}</td>
                      <td className="px-4 py-3 capitalize font-semibold text-teal-600">{a.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "leaves" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowLeaveModal(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded hover:bg-teal-700"
            >
              + Apply Leave
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No leave requests.
                    </td>
                  </tr>
                ) : (
                  leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{l.employee_code}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{l.leave_type}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {l.start_date} to {l.end_date}
                      </td>
                      <td className="px-4 py-3 capitalize font-semibold text-slate-800 dark:text-slate-200">{l.status}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {l.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleApproveLeave(l.id)}
                              className="px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded hover:bg-green-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectLeave(l.id)}
                              className="px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded hover:bg-red-200"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowShiftModal(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded hover:bg-teal-700"
            >
              + Assign Shift
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Shift Date</th>
                  <th className="px-4 py-3">Shift Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      No shift assignments.
                    </td>
                  </tr>
                ) : (
                  shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{s.employee_code}</td>
                      <td className="px-4 py-3 text-slate-500">{s.shift_date}</td>
                      <td className="px-4 py-3 capitalize font-semibold text-teal-600">{s.shift_type}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Register Staff Member</h2>
            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Employee Code</label>
                <input
                  type="text"
                  required
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  placeholder="EMP-101"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={empDesignation}
                  onChange={(e) => setEmpDesignation(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  placeholder="Staff Nurse / Ward Boy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Employment Type</label>
                <select
                  value={empType}
                  onChange={(e) => setEmpType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="permanent">Permanent</option>
                  <option value="contract">Contract</option>
                  <option value="visiting">Visiting</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowEmpModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Account Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Link User Account</h2>
            <form onSubmit={handleLinkUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Target User ID</label>
                <input
                  type="number"
                  required
                  value={linkUserId}
                  onChange={(e) => setLinkUserId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  placeholder="User numeric ID"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSelectedEmp(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Link Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Record Attendance</h2>
            <form onSubmit={handleCreateAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Employee ID</label>
                <input
                  type="number"
                  required
                  value={attEmpId}
                  onChange={(e) => setAttEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={attStatus}
                  onChange={(e) => setAttStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half_day">Half Day</option>
                  <option value="leave">On Leave</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAttModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Save Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Apply Leave Request</h2>
            <form onSubmit={handleCreateLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Employee ID</label>
                <input
                  type="number"
                  required
                  value={leaveEmpId}
                  onChange={(e) => setLeaveEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Leave Type</label>
                <input
                  type="text"
                  required
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowLeaveModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Submit Leave Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Assign Shift</h2>
            <form onSubmit={handleCreateShift} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Employee ID</label>
                <input
                  type="number"
                  required
                  value={shiftEmpId}
                  onChange={(e) => setShiftEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Shift Date</label>
                  <input
                    type="date"
                    required
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Shift Type</label>
                  <select
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  >
                    <option value="morning">Morning Shift</option>
                    <option value="evening">Evening Shift</option>
                    <option value="night">Night Shift</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowShiftModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg">
                  Assign Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
