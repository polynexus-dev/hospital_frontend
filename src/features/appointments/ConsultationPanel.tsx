import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { LoadingState } from "../../components/ui/QueryStates"
import {
  addDiagnosis,
  createClinicalNote,
  fetchEncounterForAppointment,
  finalizeClinicalNote,
  finalizeDiagnosis,
  listClinicalNotes,
  listDiagnoses,
  listVitals,
  recordVitals,
  type Diagnosis,
} from "../../api/opd"

const inputClass = "w-full h-8 px-2.5 border border-border-strong rounded-control text-[12.5px]"
const textareaClass = "w-full border border-border rounded-control p-2 text-[12.5px] leading-relaxed outline-none focus:border-brand"

// Shown inside the appointment detail modal once a visit is checked in —
// records the clinical content Appointment itself has no room for (vitals,
// chief complaints/history/exam, diagnoses). See apps.opd.models.Encounter
// and docs/erp/04-workflows.md's OPD sub-workflow. Only rendered for
// callers with patients.access_clinical_detail — see AppointmentsPage.tsx.
export function ConsultationPanel({ appointmentId }: { appointmentId: number }) {
  const queryClient = useQueryClient()

  const encounterQuery = useQuery({
    queryKey: ["opd-encounter", appointmentId],
    queryFn: () => fetchEncounterForAppointment(appointmentId),
  })
  const encounter = encounterQuery.data

  const vitalsQuery = useQuery({
    queryKey: ["opd-vitals", encounter?.id],
    queryFn: () => listVitals(encounter!.id),
    enabled: !!encounter,
  })
  const notesQuery = useQuery({
    queryKey: ["opd-clinical-notes", encounter?.id],
    queryFn: () => listClinicalNotes(encounter!.id),
    enabled: !!encounter,
  })
  const diagnosesQuery = useQuery({
    queryKey: ["opd-diagnoses", encounter?.id],
    queryFn: () => listDiagnoses(encounter!.id),
    enabled: !!encounter,
  })

  const [vitals, setVitals] = useState({ bp_systolic: "", bp_diastolic: "", pulse: "", temperature_c: "", spo2: "" })
  const recordVitalsMutation = useMutation({
    mutationFn: () =>
      recordVitals({
        encounter: encounter!.id,
        bp_systolic: vitals.bp_systolic ? Number(vitals.bp_systolic) : null,
        bp_diastolic: vitals.bp_diastolic ? Number(vitals.bp_diastolic) : null,
        pulse: vitals.pulse ? Number(vitals.pulse) : null,
        temperature_c: vitals.temperature_c || null,
        spo2: vitals.spo2 ? Number(vitals.spo2) : null,
      }),
    onSuccess: () => {
      setVitals({ bp_systolic: "", bp_diastolic: "", pulse: "", temperature_c: "", spo2: "" })
      queryClient.invalidateQueries({ queryKey: ["opd-vitals", encounter?.id] })
    },
  })

  const note = notesQuery.data?.results[0] ?? null
  const [noteDraft, setNoteDraft] = useState({ chief_complaints: "", history: "", examination_findings: "" })
  // Only reachable while no note exists yet — the "Save note" button below
  // is hidden once `note` is set, so this always creates. There's
  // deliberately no edit-before-finalize flow in this panel: one note per
  // encounter, written once, then finalized (see ClinicalNote.finalize()
  // and docs/erp/07-audit-and-security.md §2b) — the backend still allows
  // a PATCH before finalization for a fuller editor if one gets built later.
  const saveNoteMutation = useMutation({
    mutationFn: () => createClinicalNote({ encounter: encounter!.id, ...noteDraft }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["opd-clinical-notes", encounter?.id] }),
  })
  const finalizeNoteMutation = useMutation({
    mutationFn: () => finalizeClinicalNote(note!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["opd-clinical-notes", encounter?.id] }),
  })

  const [diagnosisText, setDiagnosisText] = useState("")
  const addDiagnosisMutation = useMutation({
    mutationFn: () => addDiagnosis({ encounter: encounter!.id, description: diagnosisText }),
    onSuccess: () => {
      setDiagnosisText("")
      queryClient.invalidateQueries({ queryKey: ["opd-diagnoses", encounter?.id] })
    },
  })
  const finalizeDiagnosisMutation = useMutation({
    mutationFn: (id: number) => finalizeDiagnosis(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["opd-diagnoses", encounter?.id] }),
  })

  if (encounterQuery.isLoading) return <LoadingState />
  if (!encounter) {
    return <div className="text-[12px] text-ink-5">No consultation record yet — check the patient in to start one.</div>
  }

  const latestVitals = vitalsQuery.data?.results[0]

  return (
    <div className="space-y-4 border-t border-border-soft pt-3 mt-1">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1.5">Vitals</div>
        {latestVitals && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-3 mb-2">
            {latestVitals.bp_systolic != null && <span>BP {latestVitals.bp_systolic}/{latestVitals.bp_diastolic}</span>}
            {latestVitals.pulse != null && <span>Pulse {latestVitals.pulse}</span>}
            {latestVitals.temperature_c != null && <span>Temp {latestVitals.temperature_c}°C</span>}
            {latestVitals.spo2 != null && <span>SpO2 {latestVitals.spo2}%</span>}
          </div>
        )}
        <div className="grid grid-cols-5 gap-1.5">
          <input placeholder="Sys" className={inputClass} value={vitals.bp_systolic} onChange={(e) => setVitals({ ...vitals, bp_systolic: e.target.value })} />
          <input placeholder="Dia" className={inputClass} value={vitals.bp_diastolic} onChange={(e) => setVitals({ ...vitals, bp_diastolic: e.target.value })} />
          <input placeholder="Pulse" className={inputClass} value={vitals.pulse} onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })} />
          <input placeholder="Temp °C" className={inputClass} value={vitals.temperature_c} onChange={(e) => setVitals({ ...vitals, temperature_c: e.target.value })} />
          <input placeholder="SpO2" className={inputClass} value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} />
        </div>
        <Button size="sm" variant="secondary" className="mt-1.5" onClick={() => recordVitalsMutation.mutate()} disabled={recordVitalsMutation.isPending}>
          Record vitals
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4">Clinical note</div>
          {note?.finalized_at && <span className="text-[11px] text-success font-semibold">Finalized</span>}
        </div>
        <div className="space-y-1.5">
          <textarea
            rows={2}
            placeholder="Chief complaints"
            className={textareaClass}
            disabled={!!note?.finalized_at}
            value={note ? note.chief_complaints : noteDraft.chief_complaints}
            onChange={(e) => (note ? null : setNoteDraft({ ...noteDraft, chief_complaints: e.target.value }))}
            readOnly={!!note}
          />
        </div>
        {!note && (
          <>
            <textarea rows={2} placeholder="History" className={`${textareaClass} mt-1.5`} value={noteDraft.history} onChange={(e) => setNoteDraft({ ...noteDraft, history: e.target.value })} />
            <textarea rows={2} placeholder="Examination findings" className={`${textareaClass} mt-1.5`} value={noteDraft.examination_findings} onChange={(e) => setNoteDraft({ ...noteDraft, examination_findings: e.target.value })} />
          </>
        )}
        {note && (note.history || note.examination_findings) && (
          <div className="text-[12px] text-ink-3 mt-1.5 space-y-1">
            {note.history && <div><span className="text-ink-5">History: </span>{note.history}</div>}
            {note.examination_findings && <div><span className="text-ink-5">Examination: </span>{note.examination_findings}</div>}
          </div>
        )}
        <div className="flex gap-1.5 mt-1.5">
          {!note && (
            <Button size="sm" variant="secondary" onClick={() => saveNoteMutation.mutate()} disabled={saveNoteMutation.isPending || !noteDraft.chief_complaints}>
              Save note
            </Button>
          )}
          {note && !note.finalized_at && (
            <Button size="sm" variant="primary" onClick={() => finalizeNoteMutation.mutate()} disabled={finalizeNoteMutation.isPending}>
              Finalize note
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1.5">Diagnosis</div>
        <div className="space-y-1 mb-1.5">
          {diagnosesQuery.data?.results.map((d: Diagnosis) => (
            <div key={d.id} className="flex items-center justify-between text-[12.5px]">
              <span>{d.description} <span className="text-ink-5">({d.diagnosis_type})</span></span>
              {!d.finalized_at ? (
                <button className="text-[11px] text-brand font-semibold" onClick={() => finalizeDiagnosisMutation.mutate(d.id)}>
                  Finalize
                </button>
              ) : (
                <span className="text-[11px] text-success font-semibold">Finalized</span>
              )}
            </div>
          ))}
          {diagnosesQuery.data?.results.length === 0 && <div className="text-[12px] text-ink-5">No diagnosis recorded yet.</div>}
        </div>
        <div className="flex gap-1.5">
          <input placeholder="Add diagnosis" className={`${inputClass} flex-1`} value={diagnosisText} onChange={(e) => setDiagnosisText(e.target.value)} />
          <Button size="sm" variant="secondary" onClick={() => addDiagnosisMutation.mutate()} disabled={!diagnosisText || addDiagnosisMutation.isPending}>
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
