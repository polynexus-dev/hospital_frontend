import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { ApiError } from "../../api/client"
import {
  addProgressNote,
  createDischargeSummary,
  dischargeAdmission,
  finalizeDischargeSummary,
  finalizeProgressNote,
  listDischargeSummaries,
  listProgressNotes,
  type Admission,
} from "../../api/ipd"
import { addNursingNote, listNursingNotes, listMedicationAdministrations, recordMedicationAdministration } from "../../api/nursing"

const inputClass = "w-full h-8 px-2.5 border border-border-strong rounded-control text-[12.5px]"
const textareaClass = "w-full border border-border rounded-control p-2 text-[12.5px] leading-relaxed outline-none focus:border-brand"

// The IPD equivalent of ConsultationPanel — ward-care documentation for one
// Admission (doctor progress notes, nursing notes, medication
// administration, discharge summary + the discharge action itself). See
// docs/erp/04-workflows.md's IPD/discharge sub-workflow. Ward-transfer
// request/approval has no UI yet — deliberately deferred, see
// docs/erp/08-implementation-backlog.md Phase 4 status.
export function AdmissionDetailPanel({ admission, onDischarged }: { admission: Admission; onDischarged: () => void }) {
  const queryClient = useQueryClient()
  const isDischarged = admission.status !== "admitted"

  const progressNotesQuery = useQuery({ queryKey: ["ipd-progress-notes", admission.id], queryFn: () => listProgressNotes(admission.id) })
  const nursingNotesQuery = useQuery({ queryKey: ["nursing-notes", admission.id], queryFn: () => listNursingNotes(admission.id) })
  const medsQuery = useQuery({ queryKey: ["nursing-meds", admission.id], queryFn: () => listMedicationAdministrations(admission.id) })
  const dischargeSummariesQuery = useQuery({ queryKey: ["ipd-discharge-summaries", admission.id], queryFn: () => listDischargeSummaries(admission.id) })
  const summary = dischargeSummariesQuery.data?.results[0] ?? null

  const [progressNoteText, setProgressNoteText] = useState("")
  const addProgressNoteMutation = useMutation({
    mutationFn: () => addProgressNote(admission.id, progressNoteText),
    onSuccess: () => {
      setProgressNoteText("")
      queryClient.invalidateQueries({ queryKey: ["ipd-progress-notes", admission.id] })
    },
  })
  const finalizeProgressNoteMutation = useMutation({
    mutationFn: (id: number) => finalizeProgressNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ipd-progress-notes", admission.id] }),
  })

  const [nursingNoteText, setNursingNoteText] = useState("")
  const addNursingNoteMutation = useMutation({
    mutationFn: () => addNursingNote(admission.id, nursingNoteText),
    onSuccess: () => {
      setNursingNoteText("")
      queryClient.invalidateQueries({ queryKey: ["nursing-notes", admission.id] })
    },
  })

  const [medDraft, setMedDraft] = useState({ medication_name: "", dose: "" })
  const recordMedMutation = useMutation({
    mutationFn: () => recordMedicationAdministration({ admission: admission.id, ...medDraft }),
    onSuccess: () => {
      setMedDraft({ medication_name: "", dose: "" })
      queryClient.invalidateQueries({ queryKey: ["nursing-meds", admission.id] })
    },
  })

  const [summaryDraft, setSummaryDraft] = useState({ final_diagnosis: "", treatment_summary: "", follow_up_instructions: "" })
  const saveSummaryMutation = useMutation({
    mutationFn: () => createDischargeSummary({ admission: admission.id, ...summaryDraft }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summaries", admission.id] }),
  })
  const finalizeSummaryMutation = useMutation({
    mutationFn: () => finalizeDischargeSummary(summary!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summaries", admission.id] }),
  })

  const [dischargeError, setDischargeError] = useState<string | null>(null)
  const dischargeMutation = useMutation({
    mutationFn: () => dischargeAdmission(admission.id),
    onSuccess: () => {
      setDischargeError(null)
      queryClient.invalidateQueries({ queryKey: ["admissions"] })
      queryClient.invalidateQueries({ queryKey: ["beds"] })
      onDischarged()
    },
    onError: (err: unknown) => {
      const detail = err instanceof ApiError ? (err.body as { detail?: string } | null)?.detail : undefined
      setDischargeError(detail ?? "Could not discharge this admission.")
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1.5">Doctor progress notes</div>
        <div className="space-y-1.5 mb-1.5">
          {progressNotesQuery.data?.results.map((n) => (
            <div key={n.id} className="text-[12.5px] flex items-start justify-between gap-2">
              <span>{n.note}</span>
              {n.finalized_at ? (
                <span className="text-[11px] text-success font-semibold shrink-0">Finalized</span>
              ) : (
                <button className="text-[11px] text-brand font-semibold shrink-0" onClick={() => finalizeProgressNoteMutation.mutate(n.id)}>
                  Finalize
                </button>
              )}
            </div>
          ))}
        </div>
        {!isDischarged && (
          <div className="flex gap-1.5">
            <textarea rows={2} placeholder="Add a progress note" className={textareaClass} value={progressNoteText} onChange={(e) => setProgressNoteText(e.target.value)} />
            <Button size="sm" variant="secondary" onClick={() => addProgressNoteMutation.mutate()} disabled={!progressNoteText || addProgressNoteMutation.isPending}>
              Add
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1.5">Nursing notes</div>
        <div className="space-y-1 mb-1.5">
          {nursingNotesQuery.data?.results.map((n) => (
            <div key={n.id} className="text-[12.5px]">{n.note}</div>
          ))}
          {nursingNotesQuery.data?.results.length === 0 && <div className="text-[12px] text-ink-5">No nursing notes yet.</div>}
        </div>
        {!isDischarged && (
          <div className="flex gap-1.5">
            <input placeholder="Add a nursing note" className={`${inputClass} flex-1`} value={nursingNoteText} onChange={(e) => setNursingNoteText(e.target.value)} />
            <Button size="sm" variant="secondary" onClick={() => addNursingNoteMutation.mutate()} disabled={!nursingNoteText || addNursingNoteMutation.isPending}>
              Add
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1.5">Medication administration</div>
        <div className="space-y-1 mb-1.5">
          {medsQuery.data?.results.map((m) => (
            <div key={m.id} className="text-[12.5px]">{m.medication_name} {m.dose && <span className="text-ink-5">({m.dose})</span>}</div>
          ))}
          {medsQuery.data?.results.length === 0 && <div className="text-[12px] text-ink-5">Nothing recorded yet.</div>}
        </div>
        {!isDischarged && (
          <div className="flex gap-1.5">
            <input placeholder="Medication" className={inputClass} value={medDraft.medication_name} onChange={(e) => setMedDraft({ ...medDraft, medication_name: e.target.value })} />
            <input placeholder="Dose" className={inputClass} value={medDraft.dose} onChange={(e) => setMedDraft({ ...medDraft, dose: e.target.value })} />
            <Button size="sm" variant="secondary" onClick={() => recordMedMutation.mutate()} disabled={!medDraft.medication_name || recordMedMutation.isPending}>
              Add
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-border-soft pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4">Discharge summary</div>
          {summary?.finalized_at && <span className="text-[11px] text-success font-semibold">Finalized</span>}
        </div>
        {!summary && !isDischarged && (
          <>
            <textarea rows={2} placeholder="Final diagnosis" className={textareaClass} value={summaryDraft.final_diagnosis} onChange={(e) => setSummaryDraft({ ...summaryDraft, final_diagnosis: e.target.value })} />
            <textarea rows={2} placeholder="Treatment summary" className={`${textareaClass} mt-1.5`} value={summaryDraft.treatment_summary} onChange={(e) => setSummaryDraft({ ...summaryDraft, treatment_summary: e.target.value })} />
            <textarea rows={2} placeholder="Follow-up instructions" className={`${textareaClass} mt-1.5`} value={summaryDraft.follow_up_instructions} onChange={(e) => setSummaryDraft({ ...summaryDraft, follow_up_instructions: e.target.value })} />
            <Button size="sm" variant="secondary" className="mt-1.5" onClick={() => saveSummaryMutation.mutate()} disabled={!summaryDraft.final_diagnosis || saveSummaryMutation.isPending}>
              Save discharge summary
            </Button>
          </>
        )}
        {summary && (
          <div className="text-[12.5px] text-ink-3 space-y-1">
            {summary.final_diagnosis && <div><span className="text-ink-5">Diagnosis: </span>{summary.final_diagnosis}</div>}
            {summary.treatment_summary && <div><span className="text-ink-5">Treatment: </span>{summary.treatment_summary}</div>}
            {summary.follow_up_instructions && <div><span className="text-ink-5">Follow-up: </span>{summary.follow_up_instructions}</div>}
            {!summary.finalized_at && (
              <Button size="sm" variant="primary" className="mt-1" onClick={() => finalizeSummaryMutation.mutate()} disabled={finalizeSummaryMutation.isPending}>
                Finalize summary
              </Button>
            )}
          </div>
        )}
      </div>

      {!isDischarged && (
        <div className="border-t border-border-soft pt-3">
          {dischargeError && <div className="text-[12px] text-danger-text mb-1.5">{dischargeError}</div>}
          <Button variant="primary" onClick={() => dischargeMutation.mutate()} disabled={dischargeMutation.isPending}>
            Discharge patient
          </Button>
        </div>
      )}
    </div>
  )
}
