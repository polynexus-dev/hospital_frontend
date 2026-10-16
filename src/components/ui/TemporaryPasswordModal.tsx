import { useState } from "react"
import type { TemporaryPassword } from "../../api/accounts"

// Shows an admin-issued one-time password exactly once (new login or reset).
// Only its hash is stored; closing this dialog is the last chance to see it.
export function TemporaryPasswordModal({ result, title = "Login ready", onClose }: { result: TemporaryPassword; title?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${result.email}\nTemporary password: ${result.temporary_password}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-surface dark:bg-slate-800 rounded-xl shadow-xl border border-border dark:border-slate-700 p-6 space-y-4">
        <h2 className="text-lg font-bold text-ink dark:text-slate-100">{title}</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-4">Sign in with</dt>
            <dd className="font-medium text-ink dark:text-slate-100 break-all">{result.email}</dd>
          </div>
          {result.role && (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-4">Role</dt>
              <dd className="text-ink dark:text-slate-100">{result.role}</dd>
            </div>
          )}
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-4">Temporary password</dt>
            <dd className="mt-1 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-control bg-page dark:bg-slate-900 border border-border text-base font-mono tracking-wider select-all text-ink dark:text-slate-100">
                {result.temporary_password}
              </code>
              <button type="button" onClick={copy} className="px-3 py-2 text-xs font-semibold rounded-control border border-border-strong hover:bg-page">
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </dd>
          </div>
        </dl>
        <div className="text-[12.5px] text-warning-text bg-warning-bg rounded-control px-3 py-2 leading-relaxed">
          Give this to the person directly. It is shown only now. At their first sign-in they must choose their own password; until then this one is the only way in.
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-control bg-brand text-white hover:bg-brand-hover">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
