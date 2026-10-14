import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"
import { uploadPatientDocument } from "../../api/patients"

export interface ChecklistItem {
  requirement: number
  name: string
  category: string
  required: boolean
  help_text: string
  valid_days: number | null
  satisfied: boolean
  document: { id: number; title: string; uploaded_at: string; via_portal: boolean } | null
}

export interface StageChecklist {
  stage: string
  stage_label: string
  items: ChecklistItem[]
  missing_required: number
  complete: boolean
  missing_names: string[]
}

const STAGES = [
  ["registration", "Registration"], ["admission", "Admission"], ["surgery", "Surgery"],
  ["radiology", "Radiology"], ["laboratory", "Laboratory"], ["insurance", "Insurance / TPA"],
] as const

/** Patient → Documents: what's required at each stage, what's in, and a
 *  one-click request to the patient (portal upload link) for what's missing. */
export function DocumentChecklistCard({ patientId }: { patientId: number }) {
  const queryClient = useQueryClient()
  const [stage, setStage] = useState<string>("registration")
  const [uploadFor, setUploadFor] = useState<ChecklistItem | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const key = ["document-checklist", patientId, stage]
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ stages: StageChecklist[] }>(`/patients/${patientId}/document-checklist/?stage=${stage}`),
  })
  const upload = useMutation({
    mutationFn: ({ item, file }: { item: ChecklistItem; file: File }) => {
      const fd = new FormData()
      fd.append("patient", String(patientId))
      fd.append("requirement", String(item.requirement))
      fd.append("category", item.category)
      fd.append("title", item.name)
      fd.append("file", file)
      return uploadPatientDocument(fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-checklist", patientId] })
      queryClient.invalidateQueries({ queryKey: ["patient-documents", patientId] })
    },
  })
  const ask = useMutation({
    mutationFn: () => api.post<{ sent: boolean; channel: string; missing: string[] }>(`/patients/${patientId}/request-documents/`, { stage }),
  })
  const list = q.data?.stages[0]

  return (
    <Card padded>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <Eyebrow>Required documents</Eyebrow>
        <div className="flex gap-1 flex-wrap">
          {STAGES.map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setStage(k); ask.reset() }}
              className={`text-[12px] px-2.5 py-1 rounded-full border ${stage === k ? "bg-brand text-white border-brand" : "border-border text-ink-3 hover:bg-page"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {q.isError && <div className="text-[12.5px] text-danger-text">{extractApiError(q.error)}</div>}
      {list && (
        <>
          <div className={`text-[12.5px] mb-2 ${list.complete ? "text-success-text" : "text-warning-text"}`}>
            {list.complete ? "✓ Everything required is in." : `${list.missing_required} required document${list.missing_required === 1 ? "" : "s"} missing.`}
          </div>
          <ul className="divide-y divide-border-faint border border-border-faint rounded-control">
            {list.items.map((item) => (
              <li key={item.requirement} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                <div className="min-w-0">
                  <div className="font-medium">
                    {item.satisfied ? "✅" : item.required ? "⬜" : "◻️"} {item.name}
                    {!item.required && <span className="text-ink-4 font-normal"> (optional)</span>}
                  </div>
                  <div className="text-[11.5px] text-ink-4">
                    {item.document
                      ? `${item.document.title} · ${new Date(item.document.uploaded_at).toLocaleDateString("en-IN")}${item.document.via_portal ? " · uploaded by the patient" : ""}`
                      : [item.help_text, item.valid_days ? `must be from the last ${item.valid_days} days` : ""].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {!item.satisfied && (
                  <Button size="sm" variant="secondary" disabled={upload.isPending} onClick={() => { setUploadFor(item); fileRef.current?.click() }}>
                    Upload
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            aria-label="Choose file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file && uploadFor) upload.mutate({ item: uploadFor, file })
              e.target.value = ""
            }}
          />
          {upload.isError && <div className="text-[12px] text-danger-text mt-2">{extractApiError(upload.error)}</div>}
          {!list.complete && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Button size="sm" disabled={ask.isPending} onClick={() => ask.mutate()}>Ask the patient to upload</Button>
              <span className="text-[12px] text-ink-4">Sends the missing list with a link to upload in the patient portal.</span>
            </div>
          )}
          {ask.isSuccess && <div className="text-[12px] text-success-text mt-2">Sent by {ask.data.channel}: {ask.data.missing.join(", ")}.</div>}
          {ask.isError && <div className="text-[12px] text-danger-text mt-2">{extractApiError(ask.error)}</div>}
        </>
      )}
    </Card>
  )
}
