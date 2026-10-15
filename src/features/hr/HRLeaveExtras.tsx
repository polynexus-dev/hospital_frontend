import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { FieldInput, ResourceTable } from "../../components/resource/ResourceTable"
import { col, opts, patientField } from "../nabh/fields"

// MedNet M2.22 HR parity: leave types & balances (quota, accrual, carry
// forward, no negative), staff dependents linked to patient records (staff
// rate in billing), overtime (paid in payroll, part of the ESI wage).

const inputCls = "w-full px-3 py-2 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const cardCls = "bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4"
const employeeField = (key = "employee", label = "Employee", required = true) => ({
  key, label, type: "fk" as const, source: "/hr/employees/", required,
  sourceLabel: (r: any) => `${r.employee_code} ${[r.user_detail?.first_name, r.user_detail?.last_name].filter(Boolean).join(" ") || r.designation || ""}`,
})
const num = (v: unknown) => Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 1 })

export const leaveTypesResource = {
  title: "Leave types",
  description: "Yearly quota per type (leave year = calendar year). Monthly accrual credits quota/12 each month; joiners can get the quota for the months left. Short balance: block (no negative) or warn (the approver sees it flagged). Unpaid types cut payroll paid days.",
  endpoint: "/hr/leave-types/", createLabel: "Add leave type",
  columns: [col("code", "Code"), col("name", "Leave type"), col("annual_quota", "Days / year"), col("accrual", "Accrual"), col("carry_forward_max", "Carry forward max"), col("when_short", "When short"), col("is_paid", "Paid"), col("is_active", "Active")],
  fields: [
    { key: "code", label: "Code", required: true, placeholder: "EL" },
    { key: "name", label: "Name", required: true, placeholder: "Earned leave" },
    { key: "annual_quota", label: "Days per year", type: "number" as const, required: true },
    { key: "accrual", label: "Accrual", type: "select" as const, options: [{ value: "yearly", label: "Full quota on 1 January" }, { value: "monthly", label: "Quota / 12 each month" }], defaultValue: "yearly" },
    { key: "prorate_on_joining", label: "Pro-rate in the joining year", type: "boolean" as const, defaultValue: true },
    { key: "carry_forward_max", label: "Carry forward at most (days; 0 = lapses)", type: "number" as const, defaultValue: 0 },
    { key: "when_short", label: "When the balance is short", type: "select" as const, options: [{ value: "block", label: "Block — no negative balance" }, { value: "warn", label: "Warn — allow, flag for the approver" }], defaultValue: "block" },
    { key: "is_paid", label: "Paid leave", type: "boolean" as const, defaultValue: true },
    { key: "is_active", label: "Active", type: "boolean" as const, defaultValue: true },
  ],
}

interface Bal { leave_type: number; leave_type_name: string; code: string; opening: string; accrued: string; adjustment: string; used: string; pending: string; available: string; when_short: string }
interface EmpBal { employee: number; employee_code: string; employee_name: string; balances: Bal[] }

export function LeaveBalancesPanel() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [employee, setEmployee] = useState<unknown>(null)
  const [rows, setRows] = useState<EmpBal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.get<EmpBal[]>(`/hr/leave-balances/summary/?year=${year}${employee ? `&employee=${employee}` : ""}`).then(setRows).catch((e) => setError(extractApiError(e)))
  }
  useEffect(load, [year, employee]) // eslint-disable-line react-hooks/exhaustive-deps

  const carry = async () => {
    const from = year - 1
    if (!confirm(`Close ${from}: carry unused days (capped per leave type) into ${year}? Re-running replaces the carried-forward days.`)) return
    setError(null)
    try {
      const r = await api.post<{ balances_set: number }>("/hr/leave-balances/carry-forward/", { year: from })
      setNotice(`Carried forward ${from} → ${year}: ${r.balances_set} balance(s) set.`)
      load()
    } catch (e) {
      setError(extractApiError(e))
    }
  }

  const types = rows[0]?.balances ?? []
  return (
    <div className="space-y-6">
      <section className={cardCls}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Leave balances</h2>
            <p className="text-sm text-ink-4">Available = carried forward + accrued + adjustment − approved. Pending requests are shown in brackets and are held against the balance when new leave is applied for.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-ink-3">Year
              <input type="number" className={`${inputCls} mt-1 w-28`} value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
            </label>
            <label className="text-xs font-semibold text-ink-3 min-w-72">Employee
              <div className="mt-1"><FieldInput field={employeeField("employee", "Employee", false)} value={employee} onChange={setEmployee} /></div>
            </label>
            <button onClick={carry} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border-strong dark:border-slate-600">Carry forward {year - 1} → {year}</button>
          </div>
        </div>
        {notice && <div className="text-sm text-success-text">{notice}</div>}
        {error && <div className="text-sm text-danger-text">{error}</div>}
        {types.length === 0 ? (
          <div className="text-sm text-ink-4">No active leave types — add them under Leave types.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink-4 text-left">
                  <th className="py-2 pr-3 font-semibold">Employee</th>
                  {types.map((t) => <th key={t.leave_type} className="py-2 px-2 font-semibold text-right" title={t.leave_type_name}>{t.code}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft dark:divide-slate-700">
                {rows.map((r) => (
                  <tr key={r.employee}>
                    <td className="py-1.5 pr-3 whitespace-nowrap"><span className="font-medium">{r.employee_code}</span> <span className="text-ink-4">{r.employee_name}</span></td>
                    {r.balances.map((b) => {
                      const avail = Number(b.available)
                      return (
                        <td key={b.leave_type} className="py-1.5 px-2 text-right whitespace-nowrap" title={`Opening ${num(b.opening)} + accrued ${num(b.accrued)} + adj ${num(b.adjustment)} − used ${num(b.used)}`}>
                          <span className={`font-semibold ${avail < 0 ? "text-danger-text" : ""}`}>{num(b.available)}</span>
                          {Number(b.pending) > 0 && <span className="text-warning-text"> ({num(b.pending)})</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ResourceTable config={{
        title: "Carried forward & adjustments",
        description: "Opening = days carried forward into the year (set by the carry-forward run, or by hand). Adjustment = manual credit (+) or debit (−), e.g. compensatory off or encashment.",
        endpoint: "/hr/leave-balances/", createLabel: "Add adjustment",
        filters: [{ key: "year", label: "Year", type: "number" }],
        columns: [col("year", "Year"), col("employee_code", "Code"), col("employee_name", "Employee"), col("leave_type_name", "Leave type"), col("opening", "Carried forward"), col("adjustment", "Adjustment"), col("note", "Note")],
        fields: [
          employeeField(),
          { key: "leave_type", label: "Leave type", type: "fk", source: "/hr/leave-types/?is_active=true", required: true },
          { key: "year", label: "Year", type: "number", required: true, defaultValue: new Date().getFullYear() },
          { key: "opening", label: "Carried forward (days)", type: "number", defaultValue: 0 },
          { key: "adjustment", label: "Adjustment (days, + or −)", type: "number", defaultValue: 0 },
          { key: "note", label: "Note", required: true },
        ],
      }} />
    </div>
  )
}

function StaffPatientCard() {
  const [employee, setEmployee] = useState<unknown>(null)
  const [patient, setPatient] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setError(null)
    setNotice(null)
    try {
      const e = await api.patch<any>(`/hr/employees/${employee}/`, { patient: patient || null })
      setNotice(e.patient ? `${e.employee_code} linked to ${e.patient_name}.` : `${e.employee_code} unlinked.`)
    } catch (err) {
      setError(extractApiError(err))
    }
  }
  return (
    <section className={cardCls}>
      <div>
        <h2 className="text-lg font-bold">Employee's own patient record</h2>
        <p className="text-sm text-ink-4">Staff and their dependents are billed in the <b>staff</b> rate category (the “staff” rate on each tariff; tariffs without one use the base rate) until their exit is completed.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-xs font-semibold text-ink-3">Employee<div className="mt-1"><FieldInput field={employeeField()} value={employee} onChange={setEmployee} /></div></label>
        <label className="text-xs font-semibold text-ink-3">Patient record (blank = unlink)<div className="mt-1"><FieldInput field={patientField(false)} value={patient} onChange={setPatient} /></div></label>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!employee} className="px-4 py-2 text-sm font-semibold rounded-lg bg-success text-white disabled:opacity-50">Save link</button>
        {notice && <span className="text-sm text-success-text">{notice}</span>}
        {error && <span className="text-sm text-danger-text">{error}</span>}
      </div>
    </section>
  )
}

export function DependentsPanel() {
  return (
    <div className="space-y-6">
      <StaffPatientCard />
      <ResourceTable config={{
        title: "Employee dependents",
        description: "Family members linked to their patient records. Active dependents (until the end date, if any) get the staff rate.",
        endpoint: "/hr/dependents/", createLabel: "Add dependent",
        filters: [{ key: "is_active", label: "Active", type: "boolean" }],
        columns: [col("employee_code", "Code"), col("employee_name", "Employee"), { key: "patient_name", label: "Dependent", render: (r) => `${r.patient_name}${r.patient_uhid ? ` (${r.patient_uhid})` : ""}` }, col("relationship", "Relationship"), col("valid_until", "Until"), col("is_active", "Active")],
        fields: [
          employeeField(),
          patientField(),
          { key: "relationship", label: "Relationship", type: "select", options: [{ value: "spouse", label: "Spouse" }, { value: "child", label: "Child" }, { value: "parent", label: "Parent" }, { value: "parent_in_law", label: "Parent-in-law" }, { value: "sibling", label: "Sibling" }, { value: "other", label: "Other" }], required: true },
          { key: "valid_until", label: "Covered until (blank = no end)", type: "date" },
          { key: "is_active", label: "Active", type: "boolean", defaultValue: true },
        ],
        actions: [
          { label: "End cover", method: "patch", path: "", tone: "danger", show: (r) => r.is_active && !r.valid_until, url: (r) => `/hr/dependents/${r.id}/`,
            prompt: [{ key: "valid_until", label: "Staff rate until (last covered day)", type: "date", required: true }] },
        ],
      }} />
    </div>
  )
}

export const overtimeResource = {
  title: "Overtime",
  description: "Approved hours are paid in that month's payroll at the salary structure's overtime rate (default twice the ordinary hourly rate) and count towards the ESI wage. Someone other than the employee approves.",
  endpoint: "/hr/overtime/", createLabel: "Record overtime",
  filters: [{ key: "status", label: "Status", type: "select" as const, options: opts("pending", "approved", "rejected") }],
  columns: [col("date", "Date"), col("employee_code", "Code"), col("employee_name", "Employee"), col("hours", "Hours"), col("reason", "Reason"), { key: "status", label: "Status" }],
  fields: [employeeField(), { key: "date", label: "Date", type: "date" as const, required: true }, { key: "hours", label: "Hours", type: "number" as const, required: true }, { key: "reason", label: "Reason" }],
  actions: [
    { label: "Approve", path: "approve/", tone: "primary" as const, show: (r: any) => r.status === "pending" },
    { label: "Reject", path: "reject/", tone: "danger" as const, show: (r: any) => r.status === "pending" },
  ],
}
