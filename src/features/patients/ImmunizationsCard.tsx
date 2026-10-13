import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"
import type { Paginated } from "../../types/api"

interface Immunization {
  id: number
  vaccine: string
  dose_number: number
  administered_on: string
  lot_number: string
  route: string
  site: string
  next_due_on: string | null
  adverse_event: string
}

const input = "h-9 px-3 border border-border-strong rounded-control text-[13px]"
const today = () => new Date().toISOString().slice(0, 10)

/** Vaccines given at the hospital; each dose can be shared with ABDM as an
 *  ImmunizationRecord. */
export function ImmunizationsCard({ patientId }: { patientId: number }) {
  const queryClient = useQueryClient()
  const key = ["immunizations", patientId]
  const list = useQuery({ queryKey: key, queryFn: () => api.get<Paginated<Immunization>>(`/clinical/immunizations/?patient=${patientId}`) })
  const [draft, setDraft] = useState({ vaccine: "", dose_number: 1, administered_on: today(), lot_number: "", route: "IM", site: "", next_due_on: "" })
  const add = useMutation({
    mutationFn: () => api.post<Immunization>("/clinical/immunizations/", { ...draft, patient: patientId, next_due_on: draft.next_due_on || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
      setDraft({ ...draft, vaccine: "", lot_number: "", site: "", next_due_on: "" })
    },
  })
  const rows = list.data?.results ?? []

  return (
    <Card padded>
      <Eyebrow>Immunizations</Eyebrow>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-4 mb-3">No vaccines recorded yet.</p>
      ) : (
        <table className="w-full text-[13px] mb-3">
          <thead className="text-left text-[11px] uppercase text-ink-4">
            <tr><th className="py-1">Vaccine</th><th>Dose</th><th>Given</th><th>Lot</th><th>Next due</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-1.5">{r.vaccine}{r.adverse_event && <span className="text-danger-text"> · AEFI: {r.adverse_event}</span>}</td>
                <td>{r.dose_number}</td>
                <td>{r.administered_on}</td>
                <td>{r.lot_number || "—"}</td>
                <td>{r.next_due_on || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
        <input aria-label="Vaccine" required className={`${input} w-56`} placeholder="Vaccine, e.g. MMR" value={draft.vaccine} onChange={(e) => setDraft({ ...draft, vaccine: e.target.value })} />
        <input aria-label="Dose number" type="number" min={1} className={`${input} w-20`} value={draft.dose_number} onChange={(e) => setDraft({ ...draft, dose_number: Number(e.target.value) || 1 })} />
        <input aria-label="Given on" type="date" className={input} value={draft.administered_on} onChange={(e) => setDraft({ ...draft, administered_on: e.target.value })} />
        <input aria-label="Lot number" className={`${input} w-28`} placeholder="Lot no." value={draft.lot_number} onChange={(e) => setDraft({ ...draft, lot_number: e.target.value })} />
        <select aria-label="Route" className={input} value={draft.route} onChange={(e) => setDraft({ ...draft, route: e.target.value })}>
          <option value="IM">IM</option><option value="SC">SC</option><option value="ID">ID</option><option value="PO">Oral</option><option value="NASINHLC">Nasal</option>
        </select>
        <input aria-label="Site" className={`${input} w-32`} placeholder="Site" value={draft.site} onChange={(e) => setDraft({ ...draft, site: e.target.value })} />
        <label className="text-[12px] text-ink-4 flex flex-col">Next due
          <input aria-label="Next due" type="date" className={input} value={draft.next_due_on} onChange={(e) => setDraft({ ...draft, next_due_on: e.target.value })} />
        </label>
        <Button size="sm" type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : "Record dose"}</Button>
      </form>
      {add.isError && <div className="text-[12px] text-danger-text mt-2">{extractApiError(add.error)}</div>}
    </Card>
  )
}
