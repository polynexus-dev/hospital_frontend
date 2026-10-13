import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { extractApiError } from "../../api/client"
import { getPaymentGateway, savePaymentGateway } from "../../api/billing"

const input = "w-full h-9 px-3 border border-border-strong rounded-control text-[13px]"

/** Settings → Online payments (NABH FPM.2.b / FPM.3.e). The hospital's own
 *  Razorpay account, so patients' UPI/card payments settle into the
 *  hospital's bank account. Shown only to hospital administrators. */
export function OnlinePaymentsCard() {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: ["payment-gateway"], queryFn: getPaymentGateway, retry: false })
  const [keyId, setKeyId] = useState("")
  const [keySecret, setKeySecret] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const save = useMutation({
    mutationFn: () => savePaymentGateway({ key_id: keyId || status.data?.key_id || "", key_secret: keySecret || undefined, webhook_secret: webhookSecret || undefined }),
    onSuccess: (data) => {
      queryClient.setQueryData(["payment-gateway"], data)
      setKeySecret("")
      setWebhookSecret("")
    },
  })

  if (status.isError || !status.data) return null
  const d = status.data
  const firstTime = d.source !== "hospital"

  return (
    <Card padded>
      <Eyebrow>Online payments</Eyebrow>
      <p className="text-[13px] mb-3">
        {d.configured
          ? <>Patients can pay bills online (UPI, cards, netbanking, wallets) through Razorpay{d.source === "server" ? " using the server's account" : ` (key ${d.key_id})`}.</>
          : <>Connect the hospital's Razorpay account so staff can send payment links and patients can pay from the portal. Money settles straight into the hospital's bank account.</>}
      </p>
      <form className="grid gap-2 max-w-[520px]" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <label className="text-[12px] text-ink-3" htmlFor="rzp-key">Key id</label>
        <input id="rzp-key" className={input} placeholder="rzp_live_…" value={keyId || d.key_id} onChange={(e) => setKeyId(e.target.value.trim())} />
        <label className="text-[12px] text-ink-3" htmlFor="rzp-secret">Key secret {firstTime ? "" : "(leave blank to keep)"}</label>
        <input id="rzp-secret" className={input} type="password" autoComplete="off" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} />
        <label className="text-[12px] text-ink-3" htmlFor="rzp-webhook">Webhook secret {firstTime ? "" : "(leave blank to keep)"}</label>
        <input id="rzp-webhook" className={input} type="password" autoComplete="off" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
        <div className="text-[12px] text-ink-4">
          In the Razorpay dashboard, add a webhook to <code className="break-all">{d.webhook_url}</code> with the same secret, for the events {d.webhook_events.join(", ")}.
        </div>
        {save.isError && <div className="text-[12px] text-danger-text">{extractApiError(save.error)}</div>}
        {save.isSuccess && <div className="text-[12px] text-success-text">Saved.</div>}
        <div><Button size="sm" type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></div>
      </form>
    </Card>
  )
}
