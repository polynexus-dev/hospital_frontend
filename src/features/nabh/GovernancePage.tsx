import { useEffect, useState } from "react"
import { api, extractApiError } from "../../api/client"
import { ModuleHub } from "../../components/resource/ModuleHub"
import { col, opts } from "./fields"
import { SSOSettings } from "./SSOSettings"

function SecurityPolicyForm() {
  const [p, setP] = useState<Record<string, any> | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    api.get<Record<string, any>>("/governance/security-policy/").then(setP).catch((e) => setErr(extractApiError(e)))
  }, [])
  if (!p) return <div className="text-sm text-slate-500">{err ?? "Loading…"}</div>
  const set = (k: string, v: unknown) => setP({ ...p, [k]: v })
  const num = (k: string, label: string) => (
    <label className="text-sm">
      <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
      <input type="number" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-900" value={p[k]} onChange={(e) => set(k, Number(e.target.value))} />
    </label>
  )
  const box = (k: string, label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p[k]} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
  )
  const save = async () => {
    setErr(null)
    try {
      setP(await api.patch("/governance/security-policy/", p))
      setMsg("Security policy saved.")
    } catch (e) {
      setErr(extractApiError(e))
    }
  }
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
        <h3 className="font-semibold">Password policy</h3>
        {num("password_min_length", "Minimum length")}
        {box("password_require_uppercase", "Uppercase letter")}
        {box("password_require_lowercase", "Lowercase letter")}
        {box("password_require_digit", "Digit")}
        {box("password_require_symbol", "Special character")}
        {num("password_expiry_days", "Expire after (days, 0 = never)")}
        {num("password_history_count", "Block reuse of last N passwords")}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
        <h3 className="font-semibold">Lockout & MFA</h3>
        {num("lockout_threshold", "Failed logins before lockout (0 = off)")}
        {num("lockout_minutes", "Lockout duration (minutes)")}
        {box("enforce_mfa_for_all", "Require MFA for every user")}
        {box("sso_required", "Require single sign-on (owner/admin keep password fallback)")}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
        <h3 className="font-semibold">Auto screen lock</h3>
        {box("idle_lock_enabled", "Lock idle screens")}
        {num("idle_lock_minutes", "Lock after (minutes of inactivity)")}
        <button onClick={save} className="mt-4 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Save policy</button>
        {msg && <div className="text-sm text-emerald-700">{msg}</div>}
        {err && <div className="text-sm text-rose-700">{err}</div>}
      </div>
    </div>
  )
}

function RetentionForm() {
  const [p, setP] = useState<Record<string, any> | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    api.get<Record<string, any>>("/governance/retention-policy/").then(setP).catch(() => setP(null))
  }, [])
  if (!p) return null
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex flex-wrap gap-4 items-end">
      <label className="text-sm">Backup retention (days)<input type="number" className="block mt-1 px-3 py-2 border rounded-lg" value={p.backup_retention_days} onChange={(e) => setP({ ...p, backup_retention_days: Number(e.target.value) })} /></label>
      <label className="text-sm">Auto backup every (hours)<input type="number" className="block mt-1 px-3 py-2 border rounded-lg" value={p.auto_backup_frequency_hours} onChange={(e) => setP({ ...p, auto_backup_frequency_hours: Number(e.target.value) })} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.auto_backup_enabled} onChange={(e) => setP({ ...p, auto_backup_enabled: e.target.checked })} /> Scheduled backups</label>
      <button onClick={async () => { setP(await api.patch("/governance/retention-policy/", p)); setMsg("Saved.") }} className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg">Save</button>
      {msg && <span className="text-sm text-emerald-700">{msg}</span>}
    </div>
  )
}

export function HelpCenter() {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<any[]>([])
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    api.get<any>(`/governance/help/?page_size=200${q ? `&search=${encodeURIComponent(q)}` : ""}`).then((r) => setRows(r.results ?? r)).catch(() => setRows([]))
  }, [q])
  const groups = rows.reduce<Record<string, any[]>>((acc, r) => ((acc[r.category] ??= []).push(r), acc), {})
  return (
    <div className="space-y-4 max-w-4xl">
      <input className="w-full px-4 py-3 text-sm border rounded-xl bg-white dark:bg-slate-900" placeholder="Search help, FAQs, tutorials, troubleshooting…" value={q} onChange={(e) => setQ(e.target.value)} />
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat}>
          <h3 className="text-xs uppercase font-semibold text-slate-500 mb-2">{cat}</h3>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {items.map((a) => (
              <div key={a.id} className="p-4">
                <button onClick={() => setOpen(open === a.id ? null : a.id)} className="w-full text-left font-semibold text-slate-900 dark:text-slate-100">{a.title} <span className="text-xs text-slate-400 font-normal">{a.module}</span></button>
                {open === a.id && (
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {a.body}
                    {a.video_url && <div className="mt-2"><a href={a.video_url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">Watch tutorial</a></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className="text-sm text-slate-500">No articles match.</div>}
    </div>
  )
}

export function GovernancePage() {
  return (
    <ModuleHub
      title="IT Governance & Security"
      subtitle="NABH DOM / DAC — password & lockout policy, screen lock, security events, audit rules & rollback, backups, accreditations, help"
      tabs={[
        { key: "policy", label: "Security policy", render: () => <SecurityPolicyForm /> },
        { key: "sso", label: "Single sign-on", render: () => <SSOSettings /> },
        {
          key: "events",
          label: "Security events",
          resource: {
            title: "Security event log", endpoint: "/governance/security-events/",
            filters: [{ key: "severity", label: "Severity", type: "select", options: opts("critical", "warning", "info") }, { key: "event_type", label: "Event", type: "select", options: opts("login_failed", "account_locked", "access_denied", "locked_login_attempt", "mfa_failed", "password_changed", "user_blocked", "rollback", "backup", "policy_changed") }],
            columns: [col("created_at", "When"), col("event_type", "Event"), { key: "severity", label: "Severity" }, col("username_attempted", "User"), col("ip_address", "IP"), col("path", "Path"), col("details", "Details")],
            toolbar: [{ label: "7-day summary", path: "summary/", method: "get" }],
          },
        },
        {
          key: "audit",
          label: "Audit trail",
          resource: {
            title: "Audit log (field-level changes)", endpoint: "/audit-logs/",
            columns: [col("created_at", "When"), col("actor_email", "User"), col("action", "Action"), col("model_name", "Record"), col("object_id", "ID"), col("changes", "Changes")],
            actions: [{
              label: "Roll back", path: "", method: "post", tone: "danger", url: (r) => `/governance/audit-logs/${r.id}/rollback/`,
              confirm: "Revert the fields changed in this entry to their previous values?",
              show: (r) => r.action === "update" && r.changes && Object.keys(r.changes).length > 0,
            }],
          },
        },
        {
          key: "rules",
          label: "Audit rules",
          resource: {
            title: "Audit capture & retention rules", endpoint: "/governance/audit-rules/", createLabel: "Add rule",
            description: "No rules = capture everything (except reads). Rules narrow capture per model/action, can switch on read-logging for sensitive records, and set retention.",
            columns: [col("name", "Rule"), col("model_name", "Model"), col("actions", "Actions"), col("capture_reads", "Log reads"), col("retention_days", "Retain (days)"), col("is_active", "Active")],
            fields: [{ key: "name", label: "Name", required: true }, { key: "model_name", label: "Model (* = all)", defaultValue: "*" },
              { key: "actions", label: "Actions (JSON)", type: "json", placeholder: '["create", "update", "delete"]' }, { key: "capture_reads", label: "Also log reads", type: "boolean" },
              { key: "retention_days", label: "Retention (days)", type: "number", defaultValue: 2555 }, { key: "is_active", label: "Active", type: "boolean", defaultValue: true }],
          },
        },
        {
          key: "backups",
          label: "Backups",
          render: () => (
            <div className="space-y-4">
              <RetentionForm />
              <BackupsTable />
            </div>
          ),
        },
        {
          key: "accreditations",
          label: "Accreditations",
          resource: {
            title: "Accreditations (shown on the login page)", endpoint: "/governance/accreditations/", createLabel: "Add accreditation",
            columns: [col("name", "Name"), col("issuing_body", "Issued by"), col("certificate_number", "Certificate"), col("issued_on", "Issued"), col("valid_until", "Valid until"), col("show_on_login", "On login page")],
            fields: [{ key: "name", label: "Name", required: true, placeholder: "NABH Full Accreditation" }, { key: "issuing_body", label: "Issuing body", defaultValue: "NABH" },
              { key: "certificate_number", label: "Certificate no." }, { key: "issued_on", label: "Issued on", type: "date" }, { key: "valid_until", label: "Valid until", type: "date" },
              { key: "show_on_login", label: "Show on login page", type: "boolean", defaultValue: true }],
          },
        },
        { key: "help", label: "Help centre", render: () => <HelpCenter /> },
        {
          key: "help-admin",
          label: "Manage help",
          resource: {
            title: "Help articles", endpoint: "/governance/help/", createLabel: "New article",
            columns: [col("category", "Category"), col("module", "Module"), col("title", "Title"), col("is_platform_wide", "Platform")],
            fields: [{ key: "category", label: "Category", type: "select", options: opts("guide", "faq", "tutorial", "troubleshooting", "policy"), defaultValue: "guide" }, { key: "module", label: "Module" },
              { key: "title", label: "Title", required: true }, { key: "body", label: "Body", type: "textarea", required: true }, { key: "video_url", label: "Video URL" }, { key: "tags", label: "Tags" }],
          },
        },
        { key: "releases", label: "Release notes", resource: { title: "Updates & security patches", endpoint: "/governance/release-notes/", columns: [col("released_on", "Released"), col("version", "Version"), col("kind", "Kind"), col("summary", "Summary")] } },
      ]}
    />
  )
}

function BackupsTable() {
  const [rows, setRows] = useState<any[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const load = () => api.get<any>("/governance/backups/").then((r) => setRows(r.results ?? r)).catch(() => setRows([]))
  useEffect(() => {
    load()
  }, [])
  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn()
      setMsg(done)
      load()
    } catch (e) {
      setMsg(extractApiError(e))
    }
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Backups</h3>
        <button onClick={() => act(() => api.post("/governance/backups/", {}), "Backup completed.")} className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg">Back up now</button>
      </div>
      {msg && <div className="text-sm text-slate-700">{msg}</div>}
      <table className="w-full text-sm">
        <thead><tr className="text-xs text-slate-500 text-left"><th>Started</th><th>Kind</th><th>Status</th><th>Records</th><th>Size</th><th>Expires</th><th /></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-t border-slate-100 dark:border-slate-700">
              <td className="py-2">{new Date(b.started_at).toLocaleString()}</td><td>{b.kind}</td><td>{b.status}</td><td>{b.record_count}</td>
              <td>{(b.size_bytes / 1024).toFixed(1)} KB</td><td>{b.expires_at ? new Date(b.expires_at).toLocaleDateString() : "—"}</td>
              <td className="text-right">
                {["success", "restored"].includes(b.status) && (
                  <button onClick={() => window.confirm("Restore this backup? Current values of the same records will be overwritten.") && act(() => api.post(`/governance/backups/${b.id}/restore/`, {}), "Restore complete.")} className="text-xs font-semibold text-rose-700">Restore</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
