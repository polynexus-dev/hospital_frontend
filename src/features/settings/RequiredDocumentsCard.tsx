import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"
import type { Paginated } from "../../types/api"
import { useAuthStore } from "../../store/auth"

interface Requirement {
  id: number
  stage: string
  name: string
  category: string
  required: boolean
  only_if_insured: boolean
  valid_days: number | null
  reuse_same_category: boolean
  help_text: string
  order: number
  is_active: boolean
}

const STAGES: Record<string, string> = {
  registration: "Registration", admission: "Admission", surgery: "Surgery", radiology: "Radiology", laboratory: "Laboratory", insurance: "Insurance / TPA",
}
const CATEGORIES: Record<string, string> = {
  id_proof: "ID proof", insurance_card: "Insurance card", consent: "Consent form", report: "Report", prescription: "Prescription", other: "Other",
}
const input = "h-8 px-2 border border-border-strong rounded-control text-[12.5px]"

/** Settings → Required documents: what the hospital needs at each stage.
 *  Hospital administrators edit; everyone with patient access can read. */
export function RequiredDocumentsCard() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const q = useQuery({ queryKey: ["document-requirements"], queryFn: () => api.get<Paginated<Requirement>>("/document-requirements/?page_size=200"), retry: false })
  // Hospital admins; the server enforces the exact rule.
  const canEdit = !!user && (user.permissions ?? []).includes("accounts.change_user")
  const [draft, setDraft] = useState({ stage: "registration", name: "", category: "other", required: true, valid_days: "" })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["document-requirements"] })
  const add = useMutation({
    mutationFn: () => api.post("/document-requirements/", { ...draft, valid_days: draft.valid_days ? Number(draft.valid_days) : null, order: 100 }),
    onSuccess: () => { setDraft({ ...draft, name: "", valid_days: "" }); refresh() },
  })
  const patch = useMutation({ mutationFn: ({ id, body }: { id: number; body: Partial<Requirement> }) => api.patch(`/document-requirements/${id}/`, body), onSuccess: refresh })

  if (q.isError || !q.data) return null
  const rows = q.data.results

  return (
    <Card padded>
      <Eyebrow>Required documents</Eyebrow>
      <p className="text-[13px] text-ink-3 mb-3">What patients must give you at each stage. Staff see a checklist on the patient's Documents tab and can ask the patient to upload through the portal.</p>
      {Object.entries(STAGES).map(([stage, label]) => {
        const items = rows.filter((r) => r.stage === stage)
        if (!items.length) return null
        return (
          <div key={stage} className="mb-3">
            <div className="text-[12px] font-semibold text-ink-2 mb-1">{label}</div>
            <ul className="divide-y divide-border-faint border border-border-faint rounded-control">
              {items.map((r) => (
                <li key={r.id} className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] ${r.is_active ? "" : "opacity-50"}`}>
                  <span>
                    {r.name} <span className="text-ink-4">· {CATEGORIES[r.category]}{r.only_if_insured ? " · insured patients only" : ""}{r.valid_days ? ` · within ${r.valid_days} days` : ""}</span>
                  </span>
                  {canEdit ? (
                    <span className="flex items-center gap-3 shrink-0">
                      <label className="flex items-center gap-1"><input type="checkbox" checked={r.required} onChange={(e) => patch.mutate({ id: r.id, body: { required: e.target.checked } })} /> required</label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={r.is_active} onChange={(e) => patch.mutate({ id: r.id, body: { is_active: e.target.checked } })} /> in use</label>
                    </span>
                  ) : (
                    <span className="text-ink-4 shrink-0">{r.required ? "required" : "optional"}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {canEdit && (
        <form className="flex flex-wrap items-end gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
          <select aria-label="Stage" className={input} value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value })}>
            {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input aria-label="Document name" required className={`${input} w-56`} placeholder="e.g. Contrast consent" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select aria-label="Kind" className={input} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input aria-label="Must be from the last N days" type="number" min={1} className={`${input} w-28`} placeholder="recent (days)" value={draft.valid_days} onChange={(e) => setDraft({ ...draft, valid_days: e.target.value })} />
          <label className="flex items-center gap-1 text-[12.5px]"><input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} /> required</label>
          <Button size="sm" type="submit" disabled={add.isPending}>Add</Button>
        </form>
      )}
      {(add.isError || patch.isError) && <div className="text-[12px] text-danger-text mt-2">{extractApiError(add.error || patch.error)}</div>}
    </Card>
  )
}
