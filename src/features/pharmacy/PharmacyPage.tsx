import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"
import { ApiError, extractApiError } from "../../api/client"
import { billDispense, dispenseMedicine, listDispenseRecords, listMedicineBatches, listMedicines, type Medicine, type MedicineBatch } from "../../api/pharmacy"
import { FieldInput } from "../../components/resource/ResourceTable"
import { patientField } from "../nabh/fields"
import { viewRecord } from "../../store/recordViewer"
import { BillHoldBadge } from "../billing/BillHoldBadge"

const inputClass = "h-8 px-2.5 border border-border-strong rounded-control text-[12.5px]"

// One screen for the pharmacy counter's two jobs: see what's low on stock
// (Medicine.reorder_level vs the total across its batches), and dispense
// against a specific batch (FEFO batch choice is the pharmacist's call —
// this doesn't auto-pick a batch for them).
export function PharmacyPage() {
  const queryClient = useQueryClient()
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null)

  const medicinesQuery = useQuery({ queryKey: ["medicines"], queryFn: () => listMedicines() })
  const recentDispensesQuery = useQuery({ queryKey: ["dispense-records"], queryFn: () => listDispenseRecords() })
  const medicines = medicinesQuery.data?.results ?? []
  const recentDispenses = recentDispensesQuery.data?.results ?? []

  const lowStock = medicines.filter((m) => m.reorder_level > 0 && m.total_available <= m.reorder_level)

  if (medicinesQuery.isLoading) return <LoadingState />

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <div className="text-[15px] font-semibold">Pharmacy</div>
        <div className="text-[12.5px] text-ink-4">{medicines.length} medicines · {lowStock.length} at or below reorder level</div>
      </div>

      {lowStock.length > 0 && (
        <Card padded>
          <CardHeader><Eyebrow>Low stock</Eyebrow></CardHeader>
          <div className="flex flex-wrap gap-1.5">
            {lowStock.map((m) => (
              <Pill key={m.id} tone="bad">{m.name} · {m.total_available} left</Pill>
            ))}
          </div>
        </Card>
      )}

      <Card padded>
        <CardHeader><Eyebrow>Medicine catalogue</Eyebrow></CardHeader>
        <div className="flex flex-col gap-1.5">
          {medicines.map((m) => (
            <button key={m.id} className="flex items-center justify-between text-left px-2.5 py-2 rounded-control hover:bg-page text-[12.5px]" onClick={() => setSelectedMedicine(m)}>
              <span>{m.name} {m.generic_name && <span className="text-ink-5">({m.generic_name})</span>}</span>
              <Pill tone={m.reorder_level > 0 && m.total_available <= m.reorder_level ? "bad" : "ok"}>{m.total_available} available</Pill>
            </button>
          ))}
          {medicines.length === 0 && <div className="text-[12.5px] text-ink-4">No medicines configured yet.</div>}
        </div>
      </Card>

      <Card padded>
        <CardHeader><Eyebrow>Recent dispensing</Eyebrow></CardHeader>
        <div className="flex flex-col gap-1.5">
          {recentDispenses.slice(0, 10).map((d) => (
            <div onClick={(ev) => viewRecord(ev, d, { subtitle: "Dispense" })} title="Click to view details" key={d.id} className="text-[12.5px] flex items-center justify-between gap-3 cursor-pointer hover:bg-page/60">
              <span>
                {d.quantity} × {d.medicine_name}
                <span className="block text-[11.5px] text-ink-4">
                  {d.bill_number ? `Bill ${d.bill_number} · ₹${Number(d.amount ?? 0).toLocaleString("en-IN")}` : d.billing_note || "Not billed"}
                </span>
              </span>
              <span className="flex items-center gap-2 text-ink-5 shrink-0">
                {!d.bill && d.patient && !d.billing_note?.startsWith("Issued without charge") && (
                  <button className="text-[11.5px] font-semibold text-brand" onClick={() => billDispense(d.id).then(() => queryClient.invalidateQueries({ queryKey: ["dispense-records"] })).catch((e) => alert(extractApiError(e)))}>Bill now</button>
                )}
                {new Date(d.dispensed_at).toLocaleString()}
              </span>
            </div>
          ))}
          {recentDispenses.length === 0 && <div className="text-[12.5px] text-ink-4">Nothing dispensed yet.</div>}
        </div>
      </Card>

      {selectedMedicine && (
        <DispenseModal medicine={selectedMedicine} onClose={() => setSelectedMedicine(null)} onDispensed={() => {
          setSelectedMedicine(null)
          queryClient.invalidateQueries({ queryKey: ["medicines"] })
          queryClient.invalidateQueries({ queryKey: ["dispense-records"] })
        }} />
      )}
    </div>
  )
}

function DispenseModal({ medicine, onClose, onDispensed }: { medicine: Medicine; onClose: () => void; onDispensed: () => void }) {
  const batchesQuery = useQuery({ queryKey: ["medicine-batches", medicine.id], queryFn: () => listMedicineBatches(medicine.id) })
  const batches = (batchesQuery.data?.results ?? []).filter((b) => b.quantity_available > 0)

  const [batchId, setBatchId] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [patient, setPatient] = useState<unknown>(null)
  const [free, setFree] = useState(false)
  const [freeReason, setFreeReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  // NABH MOM safety rules enforced by the server: high-risk drugs need an
  // independent second check, critical allergy/interaction alerts an override reason
  const [needsVerifier, setNeedsVerifier] = useState(Boolean(medicine.is_high_risk))
  const [verifier, setVerifier] = useState<unknown>(null)
  const [alerts, setAlerts] = useState<{ message?: string; title?: string; severity?: string }[] | null>(null)
  const [overrideReason, setOverrideReason] = useState("")

  const dispenseMutation = useMutation({
    mutationFn: () =>
      dispenseMedicine({
        batch: batchId,
        quantity,
        patient: patient ? Number(patient) : null,
        ...(free ? { bill: false, no_charge_reason: freeReason } : {}),
        ...(needsVerifier && verifier ? { verified_by: Number(verifier) } : {}),
        ...(alerts && overrideReason.trim() ? { override_reason: overrideReason.trim() } : {}),
      }),
    onSuccess: onDispensed,
    onError: (err: unknown) => {
      const body = err instanceof ApiError ? (err.body as { code?: string; alerts?: { message?: string }[] } | null) : null
      if (body?.code === "double_check_required") setNeedsVerifier(true)
      if (body?.code === "safety_alert") setAlerts(body.alerts ?? [])
      setError(extractApiError(err, "Could not dispense."))
    },
  })

  const selectedBatch: MedicineBatch | undefined = batches.find((b) => b.id === batchId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-surface rounded-card p-5 w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold mb-3">Dispense {medicine.name}</div>
        <div className="space-y-2.5">
          {error && <div className="text-[12px] text-danger-text">{error}</div>}
          <select className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]" value={batchId} onChange={(e) => setBatchId(Number(e.target.value))}>
            <option value={0}>Select batch…</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.batch_number} · exp {b.expiry_date} · {b.quantity_available} available</option>
            ))}
          </select>
          <input
            type="number" min={1} max={selectedBatch?.quantity_available ?? undefined}
            className={`${inputClass} w-full`} value={quantity} aria-label="Quantity"
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />
          <div>
            <div className="text-[11.5px] font-semibold text-ink-3 mb-1">Patient (charged to their bill; blank = counter sale)</div>
            <FieldInput field={patientField(false)} value={patient} onChange={setPatient} />
            <BillHoldBadge patientId={patient ? Number(patient) : null} className="mt-1.5" />
          </div>
          {selectedBatch && (
            <div className="text-[12px] text-ink-3">MRP ₹{Number(selectedBatch.mrp ?? 0).toLocaleString("en-IN")} each · ₹{(Number(selectedBatch.mrp ?? 0) * quantity).toLocaleString("en-IN")} incl. GST</div>
          )}
          {Boolean(patient) && (
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Issue without charge
            </label>
          )}
          {free && <input className={`${inputClass} w-full`} placeholder="Why (e.g. part of the package)" aria-label="No-charge reason" value={freeReason} onChange={(e) => setFreeReason(e.target.value)} />}
          {needsVerifier && (
            <div className="p-2.5 rounded-control border border-warning/40 bg-warning-bg/50">
              <div className="text-[11.5px] font-semibold text-warning-text mb-1">High-risk medicine: verified by (a second pharmacist or nurse) *</div>
              <FieldInput
                field={{ key: "verified_by", label: "Verified by", type: "fk", source: "/users/?is_active=true", sourceLabel: (u) => `${[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}${u.role_name ? ` · ${u.role_name}` : ""}` }}
                value={verifier}
                onChange={setVerifier}
              />
            </div>
          )}
          {alerts && (
            <div className="p-2.5 rounded-control border border-danger/40 bg-danger-bg/60 space-y-1.5">
              <div className="text-[11.5px] font-semibold text-danger-text">Safety alert for this patient</div>
              {alerts.map((a, i) => (
                <div key={i} className="text-[12px] text-ink-2">• {a.message || a.title}</div>
              ))}
              <input className={`${inputClass} w-full`} placeholder="Clinical reason to dispense anyway *" aria-label="Override reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-3.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => dispenseMutation.mutate()} disabled={!batchId || quantity < 1 || (free && !freeReason.trim()) || (needsVerifier && !verifier) || (Boolean(alerts) && !overrideReason.trim()) || dispenseMutation.isPending}>
            {dispenseMutation.isPending ? "Dispensing…" : "Dispense"}
          </Button>
        </div>
      </div>
    </div>
  )
}
