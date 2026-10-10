import { useQuery } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import type { Tone } from "../../components/ui/tone"
import { triggerBlobDownload } from "../../api/client"
import { downloadMyInvoice, getMySubscription } from "../../api/subscription"
import { useAuthStore } from "../../store/auth"
import { SYSTEM_MODULES } from "../saas/TenantModulesModal"

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—")
const STATUS_TONE: Record<string, Tone> = { active: "ok", suspended: "bad", cancelled: "neutral", paid: "ok", unpaid: "warn", overdue: "bad" }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4 py-2.5 border-b border-border-faint text-[13px]">
      <span className="text-ink-4">{label}</span>
      <span className="font-semibold text-right">{children}</span>
    </div>
  )
}

/** Settings → Subscription: the hospital's own cloud (SaaS) plan, for its
 *  administrators. Renders nothing on-premise (the License card covers it). */
export function SubscriptionCard() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = Boolean(user?.permissions?.includes("accounts.change_user"))
  const { data } = useQuery({ queryKey: ["my-subscription"], queryFn: getMySubscription, enabled: isAdmin, retry: false })

  if (!data || data.mode !== "saas") return null
  const sub = data.subscription
  const used = data.active_users ?? 0
  const limit = sub?.max_staff_users || 0
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const moduleNames = data.enabled_modules === null
    ? "All modules"
    : (data.enabled_modules ?? []).map((k) => SYSTEM_MODULES.find((m) => m.key === k)?.name ?? k).join(", ")

  return (
    <Card padded>
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Subscription</Eyebrow>
        {sub && <Pill tone={STATUS_TONE[sub.status] ?? "neutral"}>{sub.status_label}</Pill>}
      </div>
      {!sub ? (
        <p className="text-[13px] text-ink-3">No subscription is set up for this hospital yet. Contact Polynexus support.</p>
      ) : (
        <>
          <Row label="Plan">{sub.tier_label} · {sub.billing_cycle_label}</Row>
          <Row label="Price">{INR.format(Number(sub.base_price))} / {sub.billing_cycle === "annual" ? "year" : "month"}</Row>
          <Row label="Started">{date(sub.started_at)}</Row>
          <Row label="Next billing date">{date(sub.next_billing_date)}</Row>
          <div className="py-2.5 border-b border-border-faint text-[13px]">
            <div className="flex justify-between"><span className="text-ink-4">Staff users</span><span className="font-semibold">{used} / {limit || "unlimited"}</span></div>
            {limit > 0 && (
              <div className="mt-1.5 h-1.5 rounded-full bg-page overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full ${percent >= 90 ? "bg-rose-500" : percent >= 75 ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${percent}%` }} />
              </div>
            )}
          </div>
          <Row label="Modules">{moduleNames || "—"}</Row>
        </>
      )}

      {data.invoices && data.invoices.length > 0 && (
        <div className="mt-3.5">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[12px] font-bold uppercase tracking-wider text-ink-3">Invoices</span>
            {Number(data.outstanding) > 0 && <span className="text-[12px] font-semibold text-rose-600">Outstanding {INR.format(Number(data.outstanding))}</span>}
          </div>
          <div className="divide-y divide-border-soft border border-border-soft rounded-control">
            {data.invoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                <div>
                  <div className="font-mono">{inv.invoice_number}</div>
                  <div className="text-ink-4">{date(inv.billing_period_start)} – {date(inv.billing_period_end)} · due {date(inv.due_date)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{INR.format(Number(inv.amount))}</span>
                  <Pill tone={STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Pill>
                  <Button size="sm" variant="secondary" onClick={async () => triggerBlobDownload(await downloadMyInvoice(inv.id), `${inv.invoice_number}.pdf`)}>PDF</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-[12px] text-ink-4 mt-3">To add modules or users, or change your plan, contact Polynexus support. New modules can be switched on mid-subscription.</p>
    </Card>
  )
}
