import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import type { Tone } from "../../components/ui/tone"
import { LoadingState } from "../../components/ui/QueryStates"
import { listPatients } from "../../api/patients"
import { LAB_DEPARTMENTS, createLabOrder, getLabOrder, listLabOrders, listLabTests, type LabOrderStatus } from "../../api/laboratory"
import { createRadiologyOrder, listRadiologyOrders, listRadiologyProcedures, type RadiologyOrderStatus } from "../../api/radiology"
import { LabOrderDetailPanel } from "./LabOrderDetailPanel"
import { LabWorklist } from "./LabWorklist"
import { RadiologyOrderDetailPanel } from "./RadiologyOrderDetailPanel"
import { PatientLabStatusModal } from "./PatientLabStatusModal"

const LAB_STATUS_TONE: Record<LabOrderStatus, Tone> = {
  ordered: "neutral", sample_collected: "info", processing: "info", resulted: "warn", verified: "ok",
}
const RAD_STATUS_TONE: Record<RadiologyOrderStatus, Tone> = {
  ordered: "neutral", scheduled: "info", completed: "warn", reported: "ok",
}

type Tab = "lab" | "radiology"

// Diagnostics groups the two ancillary-service modules (lab + radiology)
// under one screen — they share the same order->result/report->verify
// shape and the same "which patient is this for" entry point, so a
// combined tab view avoids two near-identical sidebar links for what
// front-desk/nursing staff treat as one "send for investigations" task.
export function DiagnosticsPage() {
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  // ?tab=radiology deep-links here (e.g. from the dashboard's "Diag pending" card)
  const [tab, setTab] = useState<Tab>(() => (params.get("tab") === "radiology" ? "radiology" : "lab"))
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)
  const [selectedLabOrderId, setSelectedLabOrderId] = useState<number | null>(null)
  const [selectedRadOrderId, setSelectedRadOrderId] = useState<number | null>(null)
  const [labView, setLabView] = useState<"orders" | "worklist">("orders")
  const [labDept, setLabDept] = useState("")
  const [processing, setProcessing] = useState("")
  const [statusPatient, setStatusPatient] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const patientsQuery = useQuery({ queryKey: ["patients-dropdown"], queryFn: () => listPatients() })
  const labTestsQuery = useQuery({ queryKey: ["lab-tests"], queryFn: () => listLabTests() })
  const proceduresQuery = useQuery({ queryKey: ["radiology-procedures"], queryFn: () => listRadiologyProcedures() })
  const labOrdersQuery = useQuery({
    queryKey: ["lab-orders", labDept, processing],
    queryFn: () => listLabOrders({ ...(labDept ? { department: labDept } : {}), ...(processing ? { processing } : {}) }),
  })
  const radOrdersQuery = useQuery({ queryKey: ["radiology-orders"], queryFn: () => listRadiologyOrders() })

  const patients = patientsQuery.data?.results ?? []
  const labTests = labTestsQuery.data?.results ?? []
  const procedures = proceduresQuery.data?.results ?? []
  const labOrders = labOrdersQuery.data?.results ?? []
  const radOrders = radOrdersQuery.data?.results ?? []

  const [labDraft, setLabDraft] = useState({ patient: 0, ordered_tests: [] as number[] })
  const newLabOrderMutation = useMutation({
    mutationFn: () => createLabOrder(labDraft),
    onSuccess: (placed) => {
      setIsNewOrderOpen(false)
      setLabDraft({ patient: 0, ordered_tests: [] })
      const parts = placed.orders ?? []
      setNotice(
        parts.length > 1 ? `Split into ${parts.length} department orders: ${parts.map((p) => `${p.order_number}${p.merged ? " (added to open order)" : ""}`).join(", ")}.`
          : placed.merged ? `Added to the patient's open order ${placed.order_number}.` : null,
      )
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] })
      queryClient.invalidateQueries({ queryKey: ["lab-worklist"] })
    },
  })

  const [radDraft, setRadDraft] = useState({ patient: 0, procedure: 0 })
  const newRadOrderMutation = useMutation({
    mutationFn: () => createRadiologyOrder(radDraft),
    onSuccess: () => {
      setIsNewOrderOpen(false)
      setRadDraft({ patient: 0, procedure: 0 })
      queryClient.invalidateQueries({ queryKey: ["radiology-orders"] })
    },
  })

  const toggleLabTest = (id: number) => {
    setLabDraft((d) => ({ ...d, ordered_tests: d.ordered_tests.includes(id) ? d.ordered_tests.filter((t) => t !== id) : [...d.ordered_tests, id] }))
  }

  const selectedLabOrderQuery = useQuery({
    queryKey: ["lab-order", selectedLabOrderId],
    queryFn: () => getLabOrder(selectedLabOrderId as number),
    enabled: selectedLabOrderId !== null && !labOrders.some((o) => o.id === selectedLabOrderId),
  })
  const selectedLabOrder = labOrders.find((o) => o.id === selectedLabOrderId) ?? (selectedLabOrderQuery.data?.id === selectedLabOrderId ? selectedLabOrderQuery.data : null) ?? null
  const selectedRadOrder = radOrders.find((o) => o.id === selectedRadOrderId) ?? null

  if (labOrdersQuery.isLoading || radOrdersQuery.isLoading) return <LoadingState />

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold">Diagnostics</div>
          <div className="text-[12.5px] text-ink-4">Lab and radiology orders</div>
        </div>
        <Button variant="primary" onClick={() => setIsNewOrderOpen(true)}>New order</Button>
      </div>

      <div className="flex gap-1.5">
        <button className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-control ${tab === "lab" ? "bg-brand text-white" : "bg-surface border border-border-strong"}`} onClick={() => setTab("lab")}>
          Lab
        </button>
        <button className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-control ${tab === "radiology" ? "bg-brand text-white" : "bg-surface border border-border-strong"}`} onClick={() => setTab("radiology")}>
          Radiology
        </button>
      </div>

      {notice && <div className="text-[12.5px] text-success-text bg-success-bg rounded-control px-3 py-2" role="status">{notice}</div>}

      {tab === "lab" && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <button className={`text-[12px] font-semibold px-2.5 py-1 rounded-control ${labView === "orders" ? "bg-ink text-white" : "bg-surface border border-border-strong"}`} onClick={() => setLabView("orders")}>By order</button>
          <button className={`text-[12px] font-semibold px-2.5 py-1 rounded-control ${labView === "worklist" ? "bg-ink text-white" : "bg-surface border border-border-strong"}`} onClick={() => setLabView("worklist")}>By investigation</button>
          {labView === "orders" && (
            <select aria-label="Department" className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] bg-surface" value={labDept} onChange={(e) => setLabDept(e.target.value)}>
              <option value="">All departments</option>
              {LAB_DEPARTMENTS.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          )}
          {labView === "orders" && (
            <div className="flex gap-1" role="group" aria-label="Processing">
              {[["", "All"], ["not_started", "Not started"], ["in_process", "In process"], ["results_ready", "Results ready"]].map(([v, l]) => (
                <button key={v} className={`text-[12px] font-semibold px-2.5 py-1 rounded-control ${processing === v ? "bg-brand text-white" : "bg-surface border border-border-strong"}`} onClick={() => setProcessing(v)}>{l}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "lab" && labView === "worklist" && <LabWorklist onOpenOrder={setSelectedLabOrderId} />}

      {tab === "lab" && labView === "orders" && (
        <Card padded>
          <CardHeader><Eyebrow>Lab orders</Eyebrow></CardHeader>
          <div className="flex flex-col gap-1.5">
            {labOrders.map((order) => (
              <div key={order.id} role="button" tabIndex={0} className="flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-control hover:bg-page text-[12.5px] cursor-pointer" onClick={() => setSelectedLabOrderId(order.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedLabOrderId(order.id)}>
                <span>
                  {order.patient_name}
                  <button className="ml-1 text-[11px] font-semibold text-brand" title="Pending investigations" onClick={(e) => { e.stopPropagation(); setStatusPatient(order.patient) }}>⌕ status</button>
                  {" · "}{order.ordered_tests.length} test{order.ordered_tests.length === 1 ? "" : "s"}
                  {order.order_number && <span className="text-ink-5"> · {order.order_number}</span>}
                  {order.department && <span className="text-ink-5"> · {order.department}</span>}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {order.dispatched_at && <span className="text-[11px] text-success-text font-semibold">Sent</span>}
                  {order.processing_state && order.status !== "verified" && (
                    <span className={`text-[11px] font-semibold ${order.processing_state === "results_ready" ? "text-success-text" : order.processing_state === "in_process" ? "text-warning-text" : "text-danger-text"}`}>
                      {order.processing_state.replace("_", " ")}
                    </span>
                  )}
                  <Pill tone={LAB_STATUS_TONE[order.status]}>{order.status.replace("_", " ")}</Pill>
                </span>
              </div>
            ))}
            {labOrders.length === 0 && <div className="text-[12.5px] text-ink-4">No lab orders yet.</div>}
          </div>
        </Card>
      )}

      {tab === "radiology" && (
        <Card padded>
          <CardHeader><Eyebrow>Radiology orders</Eyebrow></CardHeader>
          <div className="flex flex-col gap-1.5">
            {radOrders.map((order) => (
              <button key={order.id} className="flex items-center justify-between text-left px-2.5 py-2 rounded-control hover:bg-page text-[12.5px]" onClick={() => setSelectedRadOrderId(order.id)}>
                <span>{order.patient_name} · {order.procedure_name}</span>
                <Pill tone={RAD_STATUS_TONE[order.status]}>{order.status}</Pill>
              </button>
            ))}
            {radOrders.length === 0 && <div className="text-[12.5px] text-ink-4">No radiology orders yet.</div>}
          </div>
        </Card>
      )}

      {isNewOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setIsNewOrderOpen(false)}>
          <div className="bg-surface rounded-card p-5 w-full max-w-[440px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-semibold mb-3">New {tab === "lab" ? "lab" : "radiology"} order</div>

            {tab === "lab" ? (
              <div className="space-y-2.5">
                <select className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]" value={labDraft.patient} onChange={(e) => setLabDraft({ ...labDraft, patient: Number(e.target.value) })}>
                  <option value={0}>Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name || `${p.first_name} ${p.last_name}`}</option>
                  ))}
                </select>
                <div className="border border-border-strong rounded-control p-2 max-h-[160px] overflow-y-auto space-y-1">
                  {labTests.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-[12.5px]">
                      <input type="checkbox" checked={labDraft.ordered_tests.includes(t.id)} onChange={() => toggleLabTest(t.id)} />
                      {t.name}
                    </label>
                  ))}
                  {labTests.length === 0 && <div className="text-[12px] text-ink-5">No lab tests configured.</div>}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <select className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]" value={radDraft.patient} onChange={(e) => setRadDraft({ ...radDraft, patient: Number(e.target.value) })}>
                  <option value={0}>Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name || `${p.first_name} ${p.last_name}`}</option>
                  ))}
                </select>
                <select className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]" value={radDraft.procedure} onChange={(e) => setRadDraft({ ...radDraft, procedure: Number(e.target.value) })}>
                  <option value={0}>Select procedure…</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3.5">
              <Button variant="secondary" onClick={() => setIsNewOrderOpen(false)}>Cancel</Button>
              {tab === "lab" ? (
                <Button variant="primary" onClick={() => newLabOrderMutation.mutate()} disabled={!labDraft.patient || labDraft.ordered_tests.length === 0 || newLabOrderMutation.isPending}>
                  {newLabOrderMutation.isPending ? "Creating…" : "Create order"}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => newRadOrderMutation.mutate()} disabled={!radDraft.patient || !radDraft.procedure || newRadOrderMutation.isPending}>
                  {newRadOrderMutation.isPending ? "Creating…" : "Create order"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedLabOrder && (
        <OrderDetailModal title={selectedLabOrder.patient_name} status={selectedLabOrder.status} onClose={() => setSelectedLabOrderId(null)}>
          <LabOrderDetailPanel order={selectedLabOrder} />
        </OrderDetailModal>
      )}

      {selectedRadOrder && (
        <OrderDetailModal title={`${selectedRadOrder.patient_name} — ${selectedRadOrder.procedure_name}`} status={selectedRadOrder.status} onClose={() => setSelectedRadOrderId(null)}>
          <RadiologyOrderDetailPanel order={selectedRadOrder} />
        </OrderDetailModal>
      )}
      {statusPatient && <PatientLabStatusModal patientId={statusPatient} onClose={() => setStatusPatient(null)} onOpenOrder={(id) => { setStatusPatient(null); setSelectedLabOrderId(id) }} />}
    </div>
  )
}

function OrderDetailModal({ title, status, onClose, children }: { title: string; status: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-surface rounded-card p-5 w-full max-w-[560px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="text-[15px] font-semibold">{title}</div>
          <Pill tone="info">{status.replace("_", " ")}</Pill>
        </div>
        {children}
        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
