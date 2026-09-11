import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { NeutralTag } from "../../components/ui/Pill"
import { ErrorState, EmptyState, LoadingState } from "../../components/ui/QueryStates"
import {
  completeDataRightsRequest,
  createDataRightsRequest,
  exportDataRightsRequest,
  listDataRightsRequests,
  rejectDataRightsRequest,
  verifyDataRightsRequest,
} from "../../api/privacy"
import { lookupPatientByMobile } from "../../api/patients"
import type { DataRightsRequest, DataRightsRequestStatus, DataRightsRequestType, PatientLookup } from "../../types/api"
import type { Tone } from "../../components/ui/tone"

const STATUS_TONE: Record<DataRightsRequestStatus, Tone> = {
  submitted: "neutral",
  verified: "info",
  in_progress: "info",
  completed: "ok",
  rejected: "bad",
}

const REQUEST_TYPE_LABEL: Record<DataRightsRequestType, string> = {
  access: "Access",
  correction: "Correction",
  erasure: "Erasure",
  nomination: "Nomination",
}

function PatientPicker({ onPick }: { onPick: (patient: PatientLookup) => void }) {
  const [mobile, setMobile] = useState("")
  const [matches, setMatches] = useState<PatientLookup[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<PatientLookup | null>(null)

  const search = async () => {
    if (!mobile.trim()) return
    setSearching(true)
    try {
      const results = await lookupPatientByMobile(mobile.trim())
      setMatches(results)
    } finally {
      setSearching(false)
    }
  }

  if (picked) {
    return (
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="font-semibold">{picked.full_name}</span>
        <span className="text-ink-4">({picked.mobile})</span>
        <button
          type="button"
          className="text-brand text-[12px] underline"
          onClick={() => {
            setPicked(null)
            setMatches([])
            onPick(undefined as unknown as PatientLookup)
          }}
        >
          change
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Patient mobile number (exact match)"
          className="flex-1 px-2 py-1.5 text-[12.5px] border border-border-strong rounded-control bg-page"
        />
        <Button size="sm" type="button" onClick={search} disabled={searching}>
          {searching ? "Searching…" : "Find"}
        </Button>
      </div>
      {matches.length > 0 && (
        <div className="border border-border rounded-control overflow-hidden">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-page border-b border-border-faint last:border-0"
              onClick={() => {
                setPicked(m)
                onPick(m)
              }}
            >
              {m.full_name} · {m.mobile}
            </button>
          ))}
        </div>
      )}
      {matches.length === 0 && mobile && !searching && <div className="text-[11.5px] text-ink-4">No match yet — press Find or Enter.</div>}
    </div>
  )
}

function NewRequestForm({ onCreated }: { onCreated: () => void }) {
  const [patient, setPatient] = useState<PatientLookup | undefined>()
  const [requestType, setRequestType] = useState<DataRightsRequestType>("access")
  const [details, setDetails] = useState("")

  const create = useMutation({
    mutationFn: () => createDataRightsRequest({ patient: patient!.id, request_type: requestType, details }),
    onSuccess: () => {
      setPatient(undefined)
      setDetails("")
      onCreated()
    },
  })

  return (
    <Card padded className="flex flex-col gap-2.5">
      <div className="text-[12.5px] font-semibold">Log a new data-rights request</div>
      <PatientPicker onPick={setPatient} />
      <div className="flex gap-2.5">
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as DataRightsRequestType)}
          className="px-2 py-1.5 text-[12.5px] border border-border-strong rounded-control bg-page"
        >
          {Object.entries(REQUEST_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="What's being requested, in the requester's own words…"
        rows={2}
        className="px-2 py-1.5 text-[12.5px] border border-border-strong rounded-control bg-page"
      />
      <div>
        <Button size="sm" variant="primary" disabled={!patient || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Submitting…" : "Submit request"}
        </Button>
      </div>
      {create.isError && <div className="text-[11.5px] text-danger-text">Could not submit the request.</div>}
    </Card>
  )
}

function ExportView({ requestId }: { requestId: number }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["data-rights-export", requestId],
    queryFn: () => exportDataRightsRequest(requestId),
    enabled: false,
  })

  if (!open) {
    return (
      <Button size="sm" onClick={() => { setOpen(true); refetch() }}>
        View export
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Hide export</Button>
      {isLoading ? <LoadingState /> : (
        <pre className="text-[11px] bg-page border border-border rounded-control p-2 max-h-64 overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

function RequestRow({ request, onChanged }: { request: DataRightsRequest; onChanged: () => void }) {
  const [notes, setNotes] = useState("")

  const verify = useMutation({ mutationFn: () => verifyDataRightsRequest(request.id), onSuccess: onChanged })
  const complete = useMutation({ mutationFn: () => completeDataRightsRequest(request.id, notes), onSuccess: onChanged })
  const reject = useMutation({ mutationFn: () => rejectDataRightsRequest(request.id, notes), onSuccess: onChanged })

  const canAct = request.status === "verified" || request.status === "in_progress"

  return (
    <div className="py-2.5 border-b border-border-faint text-[13px] flex flex-col gap-1.5">
      <div className="grid grid-cols-[1.3fr_1fr_1fr_1.1fr_2.4fr] gap-2.5 items-center min-w-[1000px]">
        <div className="font-semibold truncate">{request.patient_name || `Patient #${request.patient}`}</div>
        <div><NeutralTag>{REQUEST_TYPE_LABEL[request.request_type]}</NeutralTag></div>
        <div><Pill tone={STATUS_TONE[request.status]}>{request.status.replace("_", " ")}</Pill></div>
        <div className="font-mono text-[11.5px] text-ink-4">due {new Date(request.sla_due_at).toLocaleDateString()}</div>
        <div className="text-ink-3 truncate" title={request.details}>{request.details || "—"}</div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {request.status === "submitted" && (
          <Button size="sm" variant="primary" disabled={verify.isPending} onClick={() => verify.mutate()}>
            {verify.isPending ? "Verifying…" : "Verify identity"}
          </Button>
        )}
        {canAct && request.request_type === "access" && <ExportView requestId={request.id} />}
        {canAct && (
          <>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Resolution notes"
              className="px-2 py-1 text-[12px] border border-border-strong rounded-control bg-page"
            />
            <Button size="sm" variant="primary" disabled={complete.isPending} onClick={() => complete.mutate()}>
              {complete.isPending ? "Completing…" : "Complete"}
            </Button>
            <Button size="sm" variant="danger" disabled={reject.isPending} onClick={() => reject.mutate()}>
              Reject
            </Button>
          </>
        )}
        {(request.status === "completed" || request.status === "rejected") && request.resolution_notes && (
          <div className="text-[11.5px] text-ink-4">{request.resolution_notes}</div>
        )}
      </div>
    </div>
  )
}

export function DataRightsTab() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["data-rights-requests"],
    queryFn: () => listDataRightsRequests(),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["data-rights-requests"] })
  const requests = data?.results ?? []

  return (
    <div className="flex flex-col gap-3.5">
      <NewRequestForm onCreated={refresh} />
      <Card>
        <CardHeader>
          <div className="text-[13px] font-semibold">DPDP data-rights requests</div>
          <div className="text-[12px] text-ink-4">access · correction · erasure · nomination — verify before acting on any of them</div>
        </CardHeader>
        <div className="px-3.5">
          {isLoading && <LoadingState />}
          {isError && <ErrorState />}
          {!isLoading && !isError && requests.map((r) => <RequestRow key={r.id} request={r} onChanged={refresh} />)}
          {!isLoading && !isError && requests.length === 0 && <EmptyState message="No data-rights requests logged yet." />}
        </div>
      </Card>
    </div>
  )
}
