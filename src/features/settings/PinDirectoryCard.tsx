import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { api, extractApiError } from "../../api/client"

interface DirectoryStatus {
  pincodes: number
  post_offices: number
  api_key_configured: boolean
  last_refresh: null | {
    started_at: string
    finished_at: string | null
    running: boolean
    added_pincodes: number | null
    added_post_offices: number | null
    error: string
  }
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

/** Settings → PIN code directory. The bundled India Post directory answers
 *  every lookup offline; this refreshes it from data.gov.in when new PIN
 *  codes are published. Shown only to people allowed to refresh it. */
export function PinDirectoryCard() {
  const queryClient = useQueryClient()
  const status = useQuery({
    queryKey: ["pin-directory"],
    queryFn: () => api.get<DirectoryStatus>("/locations/pincode-directory/"),
    retry: false,
    refetchInterval: (q) => (q.state.data?.last_refresh?.running ? 5000 : false),
  })
  const refresh = useMutation({
    mutationFn: () => api.post<DirectoryStatus>("/locations/pincode-directory/"),
    onSuccess: (data) => queryClient.setQueryData(["pin-directory"], data),
  })

  if (status.isError || !status.data) return null // not allowed to refresh, or still loading
  const d = status.data
  const last = d.last_refresh

  return (
    <Card padded>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>PIN code directory</Eyebrow>
          <p className="text-[13px]">
            <b>{d.pincodes.toLocaleString("en-IN")}</b> PIN codes, {d.post_offices.toLocaleString("en-IN")} post offices (India Post, via data.gov.in).
            Lookups at registration work offline from this copy.
          </p>
          {last && (
            <p className="text-[12px] text-ink-4 mt-1">
              {last.running ? `Refreshing since ${when(last.started_at)}…`
                : last.error ? <span className="text-danger-text">Last refresh failed ({when(last.started_at)}): {last.error}</span>
                : `Last refreshed ${when(last.finished_at ?? last.started_at)}: ${last.added_pincodes ?? 0} new PIN codes, ${last.added_post_offices ?? 0} new post offices.`}
            </p>
          )}
          {!d.api_key_configured && <p className="text-[12px] text-warning-text mt-1">⚠ Add DATA_GOV_IN_API_KEY to the server's .env to enable refreshing.</p>}
          {refresh.isError && <p className="text-[12px] text-danger-text mt-1">{extractApiError(refresh.error)}</p>}
        </div>
        <Button size="sm" variant="secondary" disabled={!d.api_key_configured || refresh.isPending || !!last?.running} onClick={() => refresh.mutate()}>
          {last?.running ? "Refreshing…" : "Refresh PIN codes"}
        </Button>
      </div>
    </Card>
  )
}
