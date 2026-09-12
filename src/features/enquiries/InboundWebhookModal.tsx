import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getWebhookConfig } from "../../api/enquiries"
import { Button } from "../../components/ui/Button"
import { showToast } from "../../components/ui/Toast"

interface Props {
  open: boolean
  onClose: () => void
  onLeadCaptured?: () => void
}

export function InboundWebhookModal({ open, onClose, onLeadCaptured }: Props) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "simulator">("overview")

  // Simulator state
  const [simName, setSimName] = useState("Rajesh Sharma")
  const [simMobile, setSimMobile] = useState("+919822001122")
  const [simSource, setSimSource] = useState("meta")
  const [simCampaign, setSimCampaign] = useState("Knee Replacement Facebook Lead Ad 2026")
  const [simService, setSimService] = useState("Orthopedics / Joint Pain")
  const [simUtmSource, setSimUtmSource] = useState("meta_ads")
  const [simUtmMedium, setSimUtmMedium] = useState("cpc")
  const [simSubmitting, setSimSubmitting] = useState(false)
  const [simResult, setSimResult] = useState<any>(null)

  const { data: config, isLoading } = useQuery({
    queryKey: ["enquiries", "webhook-config"],
    queryFn: getWebhookConfig,
    enabled: open,
  })

  if (!open) return null

  const handleCopy = () => {
    if (config?.webhook_url) {
      navigator.clipboard.writeText(config.webhook_url)
      setCopied(true)
      showToast("Webhook URL copied to clipboard!", "success")
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!config?.token) return
    setSimSubmitting(true)
    setSimResult(null)

    try {
      const endpoint = `/api/v1/enquiries/lead-webhook/${config.token}/`
      const payload = {
        name: simName,
        mobile: simMobile,
        source: simSource,
        campaign: simCampaign,
        service_requested: simService,
        utm_source: simUtmSource,
        utm_medium: simUtmMedium,
        utm_campaign: simCampaign,
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (res.ok) {
        setSimResult({ success: true, id: data.id, message: `Lead successfully captured! Created Enquiry #${data.id}` })
        showToast(`Lead captured! Enquiry #${data.id} created`, "success")
        if (onLeadCaptured) onLeadCaptured()
      } else {
        setSimResult({ success: false, message: JSON.stringify(data) })
        showToast("Webhook test failed", "error")
      }
    } catch (err: any) {
      setSimResult({ success: false, message: err?.message || "Failed to reach webhook endpoint" })
      showToast("Webhook request error", "error")
    } finally {
      setSimSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>⚡</span> Inbound Lead Webhooks & Ad Integrations
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Connect Meta Lead Ads, Google Ads, Zapier, WordPress, or Elementor to automatically ingest patient enquiries
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            ✕
          </button>
        </div>

        {/* Tab Header */}
        <div className="flex border-b border-slate-100 px-6 pt-3 dark:border-slate-800 gap-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Webhook Endpoint & Guides
          </button>
          <button
            onClick={() => setActiveTab("simulator")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "simulator"
                ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span>🧪</span> Live Webhook Simulator
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading webhook configuration...</div>
          ) : activeTab === "overview" ? (
            <div className="space-y-4 text-xs">
              {/* Endpoint Card */}
              <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4 dark:border-teal-900/40 dark:bg-teal-950/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-teal-900 dark:text-teal-200 uppercase tracking-wider text-[11px]">
                    Your Dedicated Inbound Webhook URL
                  </span>
                  <span className="rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
                    HTTP POST • JSON
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-teal-300 break-all select-all">
                    {config?.webhook_url}
                  </code>
                  <Button size="sm" onClick={handleCopy}>
                    {copied ? "Copied! ✓" : "Copy URL"}
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-teal-800/80 dark:text-teal-300/80">
                  Authentication is secured via your hospital's unique token embedded in the URL path. No API key or JWT header needed.
                </p>
              </div>

              {/* Guide Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    <span>📱</span> Meta (Facebook/IG) Lead Ads
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Connect via Zapier, Make.com, or Meta Webhooks. Map Form fields:
                    <br />
                    • <code>full_name</code> ➔ <code>name</code>
                    <br />
                    • <code>phone_number</code> ➔ <code>mobile</code>
                    <br />
                    • Pass <code>source: "meta"</code>
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    <span>🌐</span> Website Forms (Elementor/WP)
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    In Elementor Form "Actions After Submit", choose <b>Webhook</b>. Paste the URL above.
                    Lead appears instantly in the CRM with full UTM source/medium attribution.
                  </p>
                </div>
              </div>

              {/* Sample Payload */}
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] mb-1.5 block">
                  Standard Inbound JSON Payload
                </span>
                <pre className="overflow-x-auto rounded bg-slate-900 p-2.5 text-[10px] text-emerald-400 font-mono">
{JSON.stringify(config?.sample_payload, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            /* Simulator Tab */
            <form onSubmit={handleSimulate} className="space-y-4 text-xs">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/20 dark:border-amber-900/40 text-amber-800 dark:text-amber-300">
                Test the ingestion pipeline in real-time. This fires an actual HTTP POST to your hospital's webhook endpoint and creates a test lead in the CRM.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lead Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={simName}
                    onChange={(e) => setSimName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={simMobile}
                    onChange={(e) => setSimMobile(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Channel / Source
                  </label>
                  <select
                    value={simSource}
                    onChange={(e) => setSimSource(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="meta">Meta (FB / Instagram)</option>
                    <option value="google">Google Ads (Search/Display)</option>
                    <option value="website">Hospital Website Form</option>
                    <option value="whatsapp">WhatsApp Inbound</option>
                    <option value="other">Third-Party Campaign</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Service Requested
                  </label>
                  <input
                    type="text"
                    value={simService}
                    onChange={(e) => setSimService(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ad Campaign Name
                </label>
                <input
                  type="text"
                  value={simCampaign}
                  onChange={(e) => setSimCampaign(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    UTM Source
                  </label>
                  <input
                    type="text"
                    value={simUtmSource}
                    onChange={(e) => setSimUtmSource(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    UTM Medium
                  </label>
                  <input
                    type="text"
                    value={simUtmMedium}
                    onChange={(e) => setSimUtmMedium(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {simResult && (

                <div
                  className={`rounded-lg p-3 text-xs font-semibold ${
                    simResult.success
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                      : "bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
                  }`}
                >
                  {simResult.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit" disabled={simSubmitting}>
                  {simSubmitting ? "Sending Webhook Payload..." : "🚀 Fire Test Webhook Ingestion"}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-3 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
