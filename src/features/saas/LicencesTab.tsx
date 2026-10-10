import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/QueryStates"
import type { Tone } from "../../components/ui/tone"
import { ApiError, triggerBlobDownload } from "../../api/client"
import { downloadLicense, listAllLicenses, revokeLicense, uploadUsageReport } from "../../api/saas"
import type { OnPremiseLicense } from "../../types/api"

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
  { key: "revoked", label: "Revoked" },
]

function expiryTone(lic: OnPremiseLicense): Tone {
  if (lic.status !== "active") return lic.status === "revoked" ? "neutral" : "bad"
  if (lic.days_left < 30) return "bad"
  if (lic.days_left < 60) return "warn"
  return "ok"
}

function expiryText(lic: OnPremiseLicense) {
  if (lic.status === "revoked") return "Revoked"
  if (lic.days_left < 0) return `Expired ${-lic.days_left} days ago`
  return `${lic.days_left} days left`
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

/** SaaS console → Licences: every on-premise licence, renewals due first,
 *  with real usage from the reports hospitals send in. */
export function LicencesTab() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState("")
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [search, setSearch] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploadMessage, setUploadMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const params = { status, expiring_within: expiringSoon ? "60" : "", search: search.trim() }
  const licences = useQuery({ queryKey: ["saas-all-licences", params], queryFn: () => listAllLicenses(params) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["saas-all-licences"] })

  const upload = useMutation({
    mutationFn: async (file: File) => uploadUsageReport(await file.text()),
    onSuccess: (r) => {
      setUploadMessage(r.seal_ok
        ? { ok: true, text: `Usage report added: ${r.active_users} active users, ${r.beds} beds (version ${r.app_version}).` }
        : { ok: false, text: "Report added, but it was EDITED after the product created it — don't rely on its numbers." })
      refresh()
    },
    onError: (err) => {
      const body = err instanceof ApiError ? (err.body as { report?: string[] } | null) : null
      setUploadMessage({ ok: false, text: body?.report?.[0] ?? "Couldn't read that file." })
    },
  })
  const revoke = useMutation({ mutationFn: (lic: OnPremiseLicense) => revokeLicense(lic.id, "Revoked from Licences tab"), onSuccess: refresh })

  const rows = licences.data?.results ?? []

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="text-[13px] font-semibold">On-premise licences</div>
          <div className="text-[12px] text-ink-4">Renewals due first. Usage comes from the reports hospitals send (Settings → License → Download usage report).</div>
        </div>
        <Button size="sm" variant="primary" onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Reading…" : "Upload usage report"}
        </Button>
        <input ref={fileInput} type="file" accept=".json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setUploadMessage(null); upload.mutate(f) } e.target.value = "" }} />
      </CardHeader>

      <div className="px-3.5 pt-3 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={status === f.key ? "primary" : "secondary"} onClick={() => setStatus(f.key)}>{f.label}</Button>
        ))}
        <Button size="sm" variant={expiringSoon ? "primary" : "secondary"} onClick={() => setExpiringSoon((v) => !v)}>Expiring in 60 days</Button>
        <input
          type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search hospital or licence ID"
          className="ml-auto min-w-56 rounded-control border border-border bg-page px-3 py-1.5 text-[13px]"
        />
      </div>
      {uploadMessage && (
        <div className={`mx-3.5 mt-3 rounded-control px-3 py-2 text-[12px] font-semibold ${uploadMessage.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
          {uploadMessage.text}
        </div>
      )}

      <div className="p-3.5 overflow-x-auto">
        {licences.isLoading ? <LoadingState /> : licences.isError ? <ErrorState message="Couldn't load licences." /> : rows.length === 0 ? (
          <EmptyState message="No licences match." />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-ink-4 border-b border-border">
                <th className="py-2 pr-3 font-semibold">Hospital</th>
                <th className="py-2 pr-3 font-semibold">Licence</th>
                <th className="py-2 pr-3 font-semibold">Expires</th>
                <th className="py-2 pr-3 font-semibold">Users</th>
                <th className="py-2 pr-3 font-semibold">Last usage report</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((lic) => {
                const usage = lic.latest_usage
                const limit = lic.max_active_users || null
                const overLimit = usage && limit !== null && usage.active_users > limit
                return (
                  <tr key={lic.id} className="border-b border-border-soft align-top">
                    <td className="py-2.5 pr-3 font-semibold">{lic.hospital_name}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-mono text-[12px]">{lic.license_id}</div>
                      <div className="text-[11px] text-ink-4">{lic.features?.length ?? 0} features · {lic.tier || "—"}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div>{date(lic.expires_at)}</div>
                      <Pill tone={expiryTone(lic)}>{expiryText(lic)}</Pill>
                    </td>
                    <td className="py-2.5 pr-3">
                      {usage ? <span className={overLimit ? "font-semibold text-rose-600" : ""}>{usage.active_users}</span> : <span className="text-ink-4">?</span>}
                      <span className="text-ink-4"> / {limit ?? "∞"}</span>
                      {overLimit && <div className="text-[11px] text-rose-600">over the limit</div>}
                    </td>
                    <td className="py-2.5 pr-3">
                      {usage ? (
                        <>
                          <div>{date(usage.generated_at)} · v{usage.app_version}</div>
                          <Pill tone={usage.seal_ok ? "ok" : "bad"}>{usage.seal_ok ? "Verified" : "Edited — unreliable"}</Pill>
                        </>
                      ) : <span className="text-ink-4">None received</span>}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {lic.status !== "revoked" && (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={async () => triggerBlobDownload(await downloadLicense(lic.id), `${lic.license_id}.lic`)}>Download</Button>
                          <Button size="sm" variant="secondary" disabled={revoke.isPending}
                            onClick={() => window.confirm(`Revoke ${lic.license_id}? Re-downloads stop; an offline server keeps it until it expires or is replaced.`) && revoke.mutate(lic)}>
                            Revoke
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}
