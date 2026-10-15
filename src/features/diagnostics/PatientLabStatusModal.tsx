import { useQuery } from "@tanstack/react-query"
import { api, extractApiError, triggerBlobDownload } from "../../api/client"

// MedNet M2.22 lab "Pending investigations": every open investigation of
// the patient with a colour for its stage, and the reporting section
// (verified / dispatched orders).

interface Pending { order: number; order_number: string; test_name: string; department: string; status: string; priority: string; ordered_at: string; overdue: boolean; value: string; flag: string }
interface Reported { order: number; order_number: string; department: string; tests: string; ordered_at: string; verified_at: string | null; verified_by: string; dispatched_at: string | null; status: string }
interface Resp { patient: { id: number; name: string; uhid: string }; pending: Pending[]; counts: Record<string, number>; reporting: Reported[] }

export const STAGE: Record<string, { label: string; cls: string }> = {
  pending_collection: { label: "To collect", cls: "bg-slate-200 text-slate-700" },
  collected: { label: "Collected", cls: "bg-amber-100 text-amber-800" },
  in_process: { label: "In process", cls: "bg-sky-100 text-sky-800" },
  outsourced: { label: "Outsourced", cls: "bg-violet-100 text-violet-800" },
  resulted: { label: "Result entered", cls: "bg-indigo-100 text-indigo-800" },
  verified: { label: "Verified", cls: "bg-green-100 text-green-800" },
  dispatched: { label: "Dispatched", cls: "bg-emerald-200 text-emerald-900" },
}

export function StagePill({ stage }: { stage: string }) {
  const s = STAGE[stage] ?? { label: stage, cls: "bg-chip-bg" }
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${s.cls}`}>{s.label}</span>
}

export function PatientLabStatusModal({ patientId, onClose, onOpenOrder }: { patientId: number; onClose: () => void; onOpenOrder?: (id: number) => void }) {
  const q = useQuery({ queryKey: ["lab-patient-status", patientId], queryFn: () => api.get<Resp>(`/laboratory/orders/patient-status/?patient=${patientId}`) })
  const d = q.data
  const when = (v: string | null) => (v ? new Date(v).toLocaleString() : "—")
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-label="Pending investigations">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{d?.patient.name ?? "Patient"}</h2>
            <p className="text-sm text-ink-4">{d?.patient.uhid}</p>
          </div>
          <button onClick={onClose} className="text-ink-4 text-xl leading-none" aria-label="Close">×</button>
        </div>
        {d && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-ink-4 mr-1">Pending investigations:</span>
            {Object.keys(STAGE).filter((k) => k !== "dispatched" && d.counts[k]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1"><StagePill stage={k} /> {d.counts[k]}</span>
            ))}
          </div>
        )}
        <section>
          <div className="text-[11px] uppercase tracking-[.06em] font-semibold text-ink-4 mb-1">Pending investigations</div>
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-[11px] text-ink-4 border-b border-border"><th className="py-1.5">Investigation</th><th>Order</th><th>Department</th><th>Requested</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-border">
              {(d?.pending ?? []).map((r) => (
                <tr key={`${r.order}-${r.test_name}`} className={r.overdue ? "bg-danger-bg/30" : ""}>
                  <td className="py-1.5 font-medium">{r.test_name}{r.value ? <span className="text-ink-4 font-normal"> · {r.value}{r.flag ? ` (${r.flag})` : ""}</span> : null}</td>
                  <td><button className="text-brand font-semibold" onClick={() => onOpenOrder?.(r.order)}>{r.order_number || `#${r.order}`}</button></td>
                  <td className="capitalize">{r.department}</td>
                  <td>{when(r.ordered_at)}</td>
                  <td className="uppercase text-[11px]">{r.priority}</td>
                  <td><StagePill stage={r.status} />{r.overdue && <span className="ml-1 text-[11px] text-danger-text font-semibold">overdue</span>}</td>
                </tr>
              ))}
              {d && d.pending.length === 0 && <tr><td colSpan={6} className="py-3 text-ink-5">Nothing pending.</td></tr>}
            </tbody>
          </table>
        </section>
        <section>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] uppercase tracking-[.06em] font-semibold text-ink-4">Reporting</div>
            {d && d.reporting.length > 0 && (
              <button className="text-[12px] font-semibold text-brand" onClick={() => api.getBlob(`/laboratory/orders/patient-report/?patient=${patientId}`)
                .then((b) => triggerBlobDownload(b, `Lab_report_${d.patient.uhid}.pdf`)).catch((e) => alert(extractApiError(e)))}>
                Download merged report (PDF)
              </button>
            )}
          </div>
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-[11px] text-ink-4 border-b border-border"><th className="py-1.5">Department</th><th>Order</th><th>Requested</th><th>Finalised</th><th>By</th><th>Status</th></tr></thead>
            <tbody className="divide-y divide-border">
              {(d?.reporting ?? []).map((r) => (
                <tr key={r.order}>
                  <td className="py-1.5"><div className="font-medium capitalize">{r.department}</div><div className="text-[11px] text-ink-4">{r.tests}</div></td>
                  <td>{r.order_number}</td><td>{when(r.ordered_at)}</td><td>{when(r.verified_at)}</td><td>{r.verified_by || "—"}</td>
                  <td><StagePill stage={r.status} /></td>
                </tr>
              ))}
              {d && d.reporting.length === 0 && <tr><td colSpan={6} className="py-3 text-ink-5">No verified reports yet.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
