import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"
import { ApiError } from "../../api/client"
import { dispenseMedicine, listDispenseRecords, listMedicineBatches, listMedicines, type Medicine, type MedicineBatch } from "../../api/pharmacy"

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
            <div key={d.id} className="text-[12.5px] flex items-center justify-between">
              <span>{d.quantity} × {d.medicine_name}</span>
              <span className="text-ink-5">{new Date(d.dispensed_at).toLocaleString()}</span>
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
  const [error, setError] = useState<string | null>(null)

  const dispenseMutation = useMutation({
    mutationFn: () => dispenseMedicine({ batch: batchId, quantity }),
    onSuccess: onDispensed,
    onError: (err: unknown) => {
      const detail = err instanceof ApiError ? (err.body as { detail?: string } | null)?.detail : undefined
      setError(detail ?? "Could not dispense — check the quantity against available stock.")
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
            className={`${inputClass} w-full`} value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => dispenseMutation.mutate()} disabled={!batchId || quantity < 1 || dispenseMutation.isPending}>
            {dispenseMutation.isPending ? "Dispensing…" : "Dispense"}
          </Button>
        </div>
      </div>
    </div>
  )
}
