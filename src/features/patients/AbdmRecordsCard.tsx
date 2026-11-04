import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"
import type { Paginated } from "../../types/api"

interface AbhaLink {
  id: number
  status: "pending" | "linked" | "failed" | "revoked"
  abha_address: string
}

interface LinkableRecord {
  reference: string
  display: string
  hi_type: string
  status: "linked" | "pending" | "unlinked"
}

interface FhirResource {
  resourceType: string
  title?: string
  text?: { div?: string }
  code?: { text?: string; coding?: { display?: string }[] }
  medicationCodeableConcept?: { text?: string }
  valueQuantity?: { value?: number; unit?: string }
  vaccineCode?: { text?: string }
}

interface ReceivedRecord {
  id: number
  hip_id: string
  title: string
  checksum_ok: boolean
  care_context_reference: string
  bundle: { entry?: { resource: FhirResource }[] }
  created_at: string
}

const STATUS_LABEL: Record<LinkableRecord["status"], string> = { linked: "Linked", pending: "Linking…", unlinked: "Not linked" }

/** One line per clinical resource in a received FHIR document. */
function summarise(record: ReceivedRecord): string[] {
  const lines: string[] = []
  for (const { resource: r } of record.bundle.entry ?? []) {
    const name = r.medicationCodeableConcept?.text ?? r.vaccineCode?.text ?? r.code?.text ?? r.code?.coding?.[0]?.display
    if (!name || ["Patient", "Practitioner", "Organization", "Composition"].includes(r.resourceType)) continue
    const value = r.valueQuantity ? ` — ${r.valueQuantity.value ?? ""} ${r.valueQuantity.unit ?? ""}`.trimEnd() : ""
    lines.push(`${r.resourceType.replace(/([a-z])([A-Z])/g, "$1 $2")}: ${name}${value}`)
  }
  return lines
}

/** ABDM for one patient: which of our records are linked to their ABHA (M2),
 *  and records other providers sent with the patient's consent (M3). */
export function AbdmRecordsCard({ patientId }: { patientId: number }) {
  const queryClient = useQueryClient()
  const links = useQuery({ queryKey: ["abha-links", patientId], queryFn: () => api.get<Paginated<AbhaLink>>(`/abdm/abha-links/?patient=${patientId}`) })
  const link = links.data?.results.find((l) => l.status === "linked")
  const ours = useQuery({
    queryKey: ["abha-records", link?.id],
    queryFn: () => api.get<LinkableRecord[]>(`/abdm/abha-links/${link!.id}/records/`),
    enabled: !!link,
  })
  const received = useQuery({
    queryKey: ["abdm-received", patientId],
    queryFn: () => api.get<Paginated<ReceivedRecord>>(`/abdm/received-records/?patient=${patientId}`),
  })
  const [selected, setSelected] = useState<string[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const linkSelected = useMutation({
    mutationFn: () => api.post(`/abdm/abha-links/${link!.id}/link_records/`, { references: selected }),
    onSuccess: () => {
      setSelected([])
      queryClient.invalidateQueries({ queryKey: ["abha-records", link?.id] })
    },
  })
  const toggle = (ref: string) => setSelected((s) => (s.includes(ref) ? s.filter((r) => r !== ref) : [...s, ref]))

  return (
    <div className="grid gap-4">
      <Card padded>
        <Eyebrow>Linked to ABHA</Eyebrow>
        {!link ? (
          <p className="text-[13px] text-ink-4">No verified ABHA for this patient yet.</p>
        ) : (
          <>
            <p className="text-[13px] text-ink-4 mb-3">
              {link.abha_address}: linked records appear in the patient's PHR app, and other providers can request them with the patient's consent.
            </p>
            {(ours.data ?? []).length === 0 ? (
              <p className="text-[13px] text-ink-4">No records at this hospital yet.</p>
            ) : (
              <table className="w-full text-[13px] mb-3">
                <thead className="text-left text-[11px] uppercase text-ink-4">
                  <tr><th className="py-1 w-6" /><th>Record</th><th>Type</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {ours.data!.map((r) => (
                    <tr key={r.reference} className="border-t border-border">
                      <td className="py-1.5">
                        {r.status === "unlinked" && (
                          <input type="checkbox" aria-label={`Link ${r.display}`} checked={selected.includes(r.reference)} onChange={() => toggle(r.reference)} />
                        )}
                      </td>
                      <td>{r.display}</td>
                      <td>{r.hi_type}</td>
                      <td>{STATUS_LABEL[r.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Button size="sm" disabled={selected.length === 0 || linkSelected.isPending} onClick={() => linkSelected.mutate()}>
              Link selected to ABHA
            </Button>
            {linkSelected.isError && <p className="text-[12px] text-danger-text mt-2">{extractApiError(linkSelected.error)}</p>}
          </>
        )}
      </Card>

      <Card padded>
        <Eyebrow>Records from other providers</Eyebrow>
        {received.isError ? (
          <p className="text-[13px] text-danger-text">{extractApiError(received.error)}</p>
        ) : (received.data?.results ?? []).length === 0 ? (
          <p className="text-[13px] text-ink-4">None yet. Raise a consent request; once the patient approves it, fetch the records and they appear here.</p>
        ) : (
          <ul className="grid gap-2">
            {received.data!.results.map((r) => (
              <li key={r.id} className="border border-border rounded-control p-2.5">
                <button type="button" className="w-full text-left" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                  <div className="text-[13px] font-semibold">{r.title || r.care_context_reference || "Health record"}</div>
                  <div className="text-[11.5px] text-ink-4">
                    From {r.hip_id || "another provider"} · received {new Date(r.created_at).toLocaleDateString()}
                    {!r.checksum_ok && <span className="text-danger-text"> · checksum mismatch: verify with the provider</span>}
                  </div>
                </button>
                {open === r.id && (
                  <ul className="mt-2 text-[12.5px] list-disc pl-5">
                    {summarise(r).map((line, i) => <li key={i}>{line}</li>)}
                    {summarise(r).length === 0 && <li>No coded entries; see the provider's document.</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
