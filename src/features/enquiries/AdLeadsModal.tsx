import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, extractApiError } from "../../api/client"
import { Button } from "../../components/ui/Button"
import { showToast } from "../../components/ui/Toast"
import { viewRecord } from "../../store/recordViewer"

interface AdLeadsConfig {
  meta: { enabled: boolean; webhook_url: string; verify_token: string; page_id: string; app_secret_set: boolean; page_token_set: boolean }
  google: { enabled: boolean; webhook_url: string; key: string }
  recent: { id: number; platform: "meta" | "google"; status: "created" | "test" | "failed"; campaign: string; error: string; enquiry: number | null; name: string; received_at: string }[]
}

const input = "w-full h-9 px-3 border border-border-strong rounded-control text-[13px] bg-surface"
const label = "block text-[11.5px] font-semibold text-ink-3 mb-1"

function Copy({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <div className={label}>{title}</div>
      <div className="flex gap-2">
        <input readOnly value={value} className={`${input} font-mono text-[12px]`} onFocus={(e) => e.target.select()} />
        <Button size="sm" variant="secondary" type="button" onClick={() => { void navigator.clipboard?.writeText(value); showToast("Copied", "success") }}>Copy</Button>
      </div>
    </div>
  )
}

/** Enquiries → Ad lead forms: leads from Facebook/Instagram lead ads and Google
 *  Ads lead forms arrive as enquiries within seconds, with their campaign. */
export function AdLeadsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const cfg = useQuery({ queryKey: ["ad-leads"], queryFn: () => api.get<AdLeadsConfig>("/enquiries/ad-leads/"), enabled: open, retry: false })
  const [secret, setSecret] = useState("")
  const [pageToken, setPageToken] = useState("")
  const [pageId, setPageId] = useState<string | null>(null)
  const done = (data: AdLeadsConfig) => {
    queryClient.setQueryData(["ad-leads"], data)
    setSecret("")
    setPageToken("")
  }
  const save = useMutation({ mutationFn: (body: Record<string, unknown>) => api.patch<AdLeadsConfig>("/enquiries/ad-leads/", body), onSuccess: (d) => { done(d); showToast("Saved", "success") } })
  const retry = useMutation({ mutationFn: (id: number) => api.post<AdLeadsConfig>("/enquiries/ad-leads/", { retry: id }), onSuccess: done })

  if (!open) return null
  const d = cfg.data

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-border-strong w-full max-w-[760px] max-h-[90vh] overflow-y-auto p-5 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Ad lead forms</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-4 text-lg">✕</button>
        </div>
        {cfg.isError && <div className="text-[13px] text-danger-text">{extractApiError(cfg.error)}</div>}
        {save.isError && <div className="text-[13px] text-danger-text">{extractApiError(save.error)}</div>}
        {!d && !cfg.isError && <div className="text-[13px] text-ink-4">Loading…</div>}

        {d && (
          <>
            <section className="space-y-3 border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[14px]">Facebook & Instagram lead ads (Meta)</h3>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={d.meta.enabled} disabled={save.isPending} onChange={(e) => save.mutate({ meta_enabled: e.target.checked })} /> On
                </label>
              </div>
              <ol className="text-[12.5px] text-ink-3 list-decimal pl-5 space-y-1">
                <li>In your Meta app (developers.facebook.com), add the <b>Webhooks</b> product, choose <b>Page</b>, and subscribe to the <b>leadgen</b> field with the URL and verify token below.</li>
                <li>Paste the app secret and a long-lived <b>Page access token</b> (permissions: leads_retrieval, pages_manage_metadata, pages_show_list) below, then switch it on.</li>
                <li>Send a lead with Meta's Lead Ads Testing Tool; it should appear in the list at the bottom within seconds.</li>
              </ol>
              <Copy title="Callback URL" value={d.meta.webhook_url} />
              <Copy title="Verify token" value={d.meta.verify_token} />
              <form className="grid sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate({ meta_app_secret: secret, meta_page_token: pageToken, meta_page_id: pageId ?? d.meta.page_id }) }}>
                <div>
                  <label className={label} htmlFor="meta-secret">App secret {d.meta.app_secret_set && "(saved; leave blank to keep)"}</label>
                  <input id="meta-secret" type="password" autoComplete="off" className={input} value={secret} onChange={(e) => setSecret(e.target.value)} />
                </div>
                <div>
                  <label className={label} htmlFor="meta-page-id">Facebook Page ID</label>
                  <input id="meta-page-id" className={input} value={pageId ?? d.meta.page_id} onChange={(e) => setPageId(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="meta-token">Page access token {d.meta.page_token_set && "(saved; leave blank to keep)"}</label>
                  <input id="meta-token" type="password" autoComplete="off" className={input} value={pageToken} onChange={(e) => setPageToken(e.target.value)} />
                </div>
                <div className="sm:col-span-2 flex justify-end"><Button size="sm" type="submit" disabled={save.isPending}>Save Meta details</Button></div>
              </form>
            </section>

            <section className="space-y-3 border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[14px]">Google Ads lead forms</h3>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={d.google.enabled} disabled={save.isPending} onChange={(e) => save.mutate({ google_enabled: e.target.checked })} /> On
                </label>
              </div>
              <p className="text-[12.5px] text-ink-3">
                In Google Ads, open the lead form asset → <b>Lead delivery option</b> → <b>Webhook integration</b>, paste the URL and key, and click
                <b> Send test data</b>. Test leads appear here marked "test".
              </p>
              <Copy title="Webhook URL" value={d.google.webhook_url} />
              <Copy title="Key" value={d.google.key} />
            </section>

            <section>
              <h3 className="font-semibold text-[14px] mb-2">Latest ad leads</h3>
              {d.recent.length === 0 ? (
                <p className="text-[12.5px] text-ink-4">None yet.</p>
              ) : (
                <table className="w-full text-[12.5px]">
                  <thead className="text-left text-[11px] uppercase text-ink-4"><tr><th className="py-1">When</th><th>From</th><th>Name</th><th>Campaign</th><th>Result</th></tr></thead>
                  <tbody>
                    {d.recent.map((r) => (
                      <tr key={r.id} onClick={(ev) => viewRecord(ev, r, { subtitle: "Ad lead" })} title="Click to view details" className="border-t border-border align-top cursor-pointer">
                        <td className="py-1.5">{new Date(r.received_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td>{r.platform === "meta" ? "Meta" : "Google"}</td>
                        <td>{r.name || "—"}</td>
                        <td>{r.campaign || "—"}</td>
                        <td>
                          {r.status === "failed" ? (
                            <span className="text-danger-text">
                              Couldn't fetch: {r.error}{" "}
                              <button type="button" className="underline" disabled={retry.isPending} onClick={() => retry.mutate(r.id)}>Fetch again</button>
                            </span>
                          ) : r.status === "test" ? "Test lead" : `Enquiry #${r.enquiry}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
