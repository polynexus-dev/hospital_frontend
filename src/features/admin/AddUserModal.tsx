import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { createUser, issueTemporaryPassword, type TemporaryPassword } from "../../api/accounts"
import { extractApiError } from "../../api/client"
import { listDepartments } from "../../api/doctors"
import type { Role } from "../../types/api"

const inputCls = "w-full h-9 px-2.5 border border-border-strong rounded-control text-[13px] bg-white dark:bg-slate-900"

/** New login for any role: created without a password, then a one-time password is issued. */
export function AddUserModal({ roles, onClose, onCreated }: { roles: Role[]; onClose: () => void; onCreated: (result: TemporaryPassword) => void }) {
  const departments = useQuery({ queryKey: ["departments"], queryFn: listDepartments })
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "", department: "" })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const assignable = roles.filter((r) => r.assignable !== false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    let created: { id: number; email: string } | null = null
    try {
      created = await createUser({
        email: form.email.trim().toLowerCase(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || undefined,
        role: Number(form.role),
        department: form.department ? Number(form.department) : null,
      })
      const temp = await issueTemporaryPassword(created.id)
      const role = roles.find((r) => String(r.id) === form.role)?.name
      onCreated({ ...temp, role })
    } catch (err) {
      setError(created ? `The login ${created.email} was created, but no password could be issued: ${extractApiError(err)}. Use "Reset password" on it.` : extractApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-lg bg-surface dark:bg-slate-800 rounded-xl shadow-xl border border-border dark:border-slate-700 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-ink dark:text-slate-100">Add user</h2>
          <p className="text-[12.5px] text-ink-4">They get a one-time password to sign in, then choose their own.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[12px] font-semibold text-ink-3">
            First name *
            <input className={inputCls} required value={form.first_name} onChange={set("first_name")} />
          </label>
          <label className="text-[12px] font-semibold text-ink-3">
            Last name
            <input className={inputCls} value={form.last_name} onChange={set("last_name")} />
          </label>
          <label className="col-span-2 text-[12px] font-semibold text-ink-3">
            Email (used to sign in) *
            <input className={inputCls} type="email" required value={form.email} onChange={set("email")} />
          </label>
          <label className="text-[12px] font-semibold text-ink-3">
            Role *
            <select className={inputCls} required value={form.role} onChange={set("role")}>
              <option value="">Select a role</option>
              {assignable.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] font-semibold text-ink-3">
            Department
            <select className={inputCls} value={form.department} onChange={set("department")}>
              <option value="">—</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 text-[12px] font-semibold text-ink-3">
            Mobile
            <input className={inputCls} value={form.phone} onChange={set("phone")} />
          </label>
        </div>
        {error && <div className="text-[12.5px] text-danger-text bg-danger-bg rounded-control px-3 py-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-control border border-border-strong hover:bg-page">
            Cancel
          </button>
          <button disabled={busy} className="px-4 py-2 text-sm font-semibold rounded-control bg-brand text-white hover:bg-brand-hover disabled:opacity-60">
            {busy ? "Creating…" : "Create login"}
          </button>
        </div>
      </form>
    </div>
  )
}
