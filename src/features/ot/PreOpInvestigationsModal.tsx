import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, extractApiError } from "../../api/client"
import type { SurgeryRequest } from "../../types/api"

// MedNet M2.22 OT: the anaesthetist orders the pre-operative work-up from the
// pre-op screen. Lab orders follow the lab's department-split / merge rules;
// everything ordered here stays listed with its status for the pre-op review.

interface Catalogue { id: number; name: string; code?: string; department?: string; modality?: string }
interface Workup {
  lab: { order: number; order_number: string; test: string; status: string; priority: string; ordered_at: string }[]
  radiology: { order: number; test: string; status: string; priority: string; ordered_at: string }[]
}

// The usual pre-anaesthetic work-up, ticked in one click when present in the catalogue.
const STANDARD = ["CBC", "Blood sugar", "Serum creatinine", "Electrolytes", "PT/INR", "HIV", "HBsAg", "HCV", "Blood group", "ECG", "Chest X-ray"]

export function PreOpInvestigationsModal({ request, onClose }: { request: SurgeryRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const key = ["preop-workup", request.id]
  const workup = useQuery({ queryKey: key, queryFn: () => api.get<Workup>(`/ot/surgery-requests/${request.id}/investigations/`) })
  const labs = useQuery({ queryKey: ["lab-tests-active"], queryFn: () => api.get<{ results: Catalogue[] }>("/laboratory/tests/?is_active=true&page_size=500") })
  const imaging = useQuery({ queryKey: ["radiology-procedures-active"], queryFn: () => api.get<{ results: Catalogue[] }>("/radiology/procedures/?is_active=true&page_size=200") })
  const [lab, setLab] = useState<number[]>([])
  const [rad, setRad] = useState<number[]>([])
  const [priority, setPriority] = useState(request.priority && request.priority !== "elective" ? "urgent" : "routine")
  const [notes, setNotes] = useState("")
  const [filter, setFilter] = useState("")
  const [error, setError] = useState<string | null>(null)

  const order = useMutation({
    mutationFn: () => api.post<Workup>(`/ot/surgery-requests/${request.id}/request-investigations/`, { lab_tests: lab, radiology_procedures: rad, priority, notes }),
    onSuccess: () => { setLab([]); setRad([]); setNotes(""); setError(null); qc.invalidateQueries({ queryKey: key }) },
    onError: (e) => setError(extractApiError(e)),
  })

  const labList = labs.data?.results ?? []
  const radList = imaging.data?.results ?? []
  const match = (c: Catalogue) => !filter || `${c.name} ${c.code ?? ""}`.toLowerCase().includes(filter.toLowerCase())
  const toggle = (list: number[], set: (v: number[]) => void, id: number) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const standard = () => {
    const isStd = (c: Catalogue) => STANDARD.some((s) => c.name.toLowerCase().includes(s.toLowerCase()) || (c.code ?? "").toLowerCase() === s.toLowerCase())
    setLab(Array.from(new Set([...lab, ...labList.filter(isStd).map((c) => c.id)])))
    setRad(Array.from(new Set([...rad, ...radList.filter(isStd).map((c) => c.id)])))
  }
  const ordered = workup.data
  const patient = request.patient_detail ? `${request.patient_detail.first_name} ${request.patient_detail.last_name}` : `Patient #${request.patient}`

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-label="Pre-op investigations">
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Pre-op investigations</h2>
            <p className="text-sm text-ink-4">{patient} · {request.proposed_procedure}</p>
          </div>
          <button onClick={onClose} className="text-ink-4 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <section>
          <div className="text-[11px] uppercase tracking-[.06em] font-semibold text-ink-4 mb-1">Already ordered</div>
          {!ordered || (ordered.lab.length === 0 && ordered.radiology.length === 0) ? (
            <div className="text-[12.5px] text-ink-5">Nothing ordered from the OT yet.</div>
          ) : (
            <table className="w-full text-[12.5px]">
              <tbody className="divide-y divide-border">
                {[...ordered.lab.map((l) => ({ ...l, kind: "Lab" })), ...ordered.radiology.map((r) => ({ ...r, order_number: "", kind: "Imaging" }))].map((r, i) => (
                  <tr key={`${r.kind}-${r.order}-${i}`}>
                    <td className="py-1 pr-2 text-ink-4">{r.kind}</td>
                    <td className="py-1 pr-2 font-medium">{r.test}</td>
                    <td className="py-1 pr-2 text-ink-4">{r.order_number}</td>
                    <td className="py-1 pr-2 capitalize">{r.status.replace("_", " ")}</td>
                    <td className="py-1 text-ink-4">{r.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <input className="flex-1 h-8 px-2.5 border border-border-strong rounded-control text-[12.5px]" placeholder="Find a test…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <button className="px-3 h-8 text-[12px] font-semibold rounded-control border border-border-strong" onClick={standard}>+ Standard pre-op panel</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[.06em] font-semibold text-ink-4 mb-1">Laboratory</div>
              <div className="max-h-56 overflow-y-auto border border-border rounded-control p-2 space-y-0.5">
                {labList.filter(match).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-[12.5px]">
                    <input type="checkbox" checked={lab.includes(c.id)} onChange={() => toggle(lab, setLab, c.id)} /> {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[.06em] font-semibold text-ink-4 mb-1">Imaging</div>
              <div className="max-h-56 overflow-y-auto border border-border rounded-control p-2 space-y-0.5">
                {radList.filter(match).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-[12.5px]">
                    <input type="checkbox" checked={rad.includes(c.id)} onChange={() => toggle(rad, setRad, c.id)} /> {c.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[12px] text-ink-4">Priority{" "}
              <select className="h-8 px-2 border border-border-strong rounded-control text-[12.5px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
              </select>
            </label>
            <input className="flex-1 h-8 px-2.5 border border-border-strong rounded-control text-[12.5px]" placeholder="Note for the lab (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </section>

        {error && <div className="text-[12.5px] text-danger-text">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-sm rounded-lg border border-border" onClick={onClose}>Close</button>
          <button className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-brand text-white disabled:opacity-50" disabled={(!lab.length && !rad.length) || order.isPending} onClick={() => order.mutate()}>
            {order.isPending ? "Ordering…" : `Order ${lab.length + rad.length || ""} investigation${lab.length + rad.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  )
}
