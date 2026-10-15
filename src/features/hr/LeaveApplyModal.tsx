import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { createLeaveRequest } from "../../api/hr"
import { FieldInput } from "../../components/resource/ResourceTable"

// Apply for leave against a leave type, seeing the balance as you go.
// "Block" types refuse a request beyond the balance (no negative balance);
// "warn" types accept it and flag it for the approver.

interface LeaveTypeRow { id: number; code: string; name: string; when_short: string }
interface Bal { leave_type: number; available: string; pending: string; when_short: string }

const inputCls = "w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
const labelCls = "block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1"
const employeeField = {
  key: "employee", label: "Employee", type: "fk" as const, source: "/hr/employees/", required: true,
  sourceLabel: (r: any) => `${r.employee_code} ${[r.user_detail?.first_name, r.user_detail?.last_name].filter(Boolean).join(" ") || r.designation || ""}`,
}

const daysBetween = (a: string, b: string) => (a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1 : 0)

export function LeaveApplyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [types, setTypes] = useState<LeaveTypeRow[]>([])
  const [employee, setEmployee] = useState<unknown>(null)
  const [typeId, setTypeId] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [halfDay, setHalfDay] = useState(false)
  const [reason, setReason] = useState("")
  const [bal, setBal] = useState<Bal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get<any>("/hr/leave-types/?is_active=true&page_size=100").then((r) => setTypes(r.results ?? r)).catch(() => setTypes([]))
  }, [])

  const year = (start || new Date().toISOString()).slice(0, 4)
  useEffect(() => {
    setBal(null)
    if (!employee || !typeId) return
    api.get<any[]>(`/hr/leave-balances/summary/?employee=${employee}&year=${year}`)
      .then((r) => setBal((r[0]?.balances ?? []).find((b: Bal) => String(b.leave_type) === typeId) ?? null))
      .catch(() => setBal(null))
  }, [employee, typeId, year])

  const days = halfDay ? 0.5 : Math.max(daysBetween(start, end || start), 0)
  const left = bal ? Number(bal.available) - Number(bal.pending) : null
  const short = left !== null && days > left

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createLeaveRequest({ employee: Number(employee), leave_type_master: Number(typeId), start_date: start, end_date: halfDay ? start : end || start, half_day: halfDay, reason })
      onSaved()
      onClose()
    } catch (err) {
      setError(extractApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-ink dark:text-slate-100">Apply Leave Request</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Employee</label>
            <FieldInput field={employeeField} value={employee} onChange={setEmployee} />
          </div>
          <div>
            <label className={labelCls} htmlFor="leave-type">Leave type</label>
            <select id="leave-type" required value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
              <option value="">— select —</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
            </select>
            {types.length === 0 && <p className="text-xs text-ink-4 mt-1">No leave types yet — add them under HR › Leave types.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="leave-start">Start date</label>
              <input id="leave-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="leave-end">End date</label>
              <input id="leave-end" type="date" required={!halfDay} disabled={halfDay} value={halfDay ? start : end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2 dark:text-slate-300">
            <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} /> Half day
          </label>
          <div>
            <label className={labelCls} htmlFor="leave-reason">Reason</label>
            <input id="leave-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
          </div>
          {bal && (
            <div className={`text-sm rounded-lg px-3 py-2 ${short ? (bal.when_short === "block" ? "bg-danger-bg text-danger-text" : "bg-warning-bg text-warning-text") : "bg-page dark:bg-slate-900 text-ink-3"}`}>
              {left} day(s) left in {year}{Number(bal.pending) > 0 ? ` after ${bal.pending} pending` : ""} · this request: {days}
              {short && (bal.when_short === "block" ? " — not enough balance; this leave type doesn't allow a negative balance." : " — more than the balance; it will be flagged for the approver.")}
            </div>
          )}
          {error && <div className="text-sm text-danger-text">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-ink-4">Cancel</button>
            <button type="submit" disabled={busy || !employee || !typeId || (short && bal?.when_short === "block")} className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg disabled:opacity-50">
              Submit Leave Request
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
