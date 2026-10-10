import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Pill } from "../../components/ui/Pill"
import type { Tone } from "../../components/ui/tone"
import { ApiError } from "../../api/client"
import { downloadUsageReport, getLicenseStatus, uploadLicense } from "../../api/licensing"
import { triggerBlobDownload } from "../../api/client"
import { Button } from "../../components/ui/Button"
import type { LicenseState } from "../../types/api"
import { featureLabel } from "../saas/licenceFeatures"

const STATE: Record<LicenseState, { label: string; tone: Tone }> = {
  valid: { label: "Active", tone: "ok" },
  expiring_soon: { label: "Expiring soon", tone: "warn" },
  grace_period: { label: "Grace period", tone: "bad" },
  expired: { label: "Expired — read-only", tone: "bad" },
  tampered: { label: "Invalid", tone: "bad" },
  invalid_machine: { label: "Wrong server", tone: "bad" },
  wrong_deployment: { label: "Wrong deployment", tone: "bad" },
  not_yet_valid: { label: "Not started yet", tone: "warn" },
  missing: { label: "Not installed", tone: "bad" },
  revoked: { label: "Revoked", tone: "bad" },
}

function formatDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) : "—"
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border-faint text-[13px]">
      <span className="text-ink-4 shrink-0">{label}</span>
      <span className="font-semibold text-right min-w-0 break-all">{children}</span>
    </div>
  )
}

/** Settings → License Info. On-premise installations only; renders nothing in SaaS mode. */
export function LicenseCard() {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey: ["license-status"], queryFn: getLicenseStatus })
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [done, setDone] = useState(false)

  const upload = useMutation({
    mutationFn: async (file: File) => uploadLicense(await file.text()),
    onSuccess: (fresh) => {
      queryClient.setQueryData(["license-status"], fresh)
      setDone(true)
    },
  })

  const data = status.data
  if (!data || data.mode !== "on_premise") return null
  const isAdmin = data.machine_fingerprint !== undefined // details are only sent to hospital admins
  const state = data.state ? STATE[data.state] : null

  const take = (file?: File) => {
    if (!file) return
    setDone(false)
    upload.mutate(file)
  }
  const uploadError = upload.error instanceof ApiError ? (upload.error.body as { detail?: string } | null)?.detail : upload.isError ? "Upload failed." : null

  return (
    <Card padded>
      <div id="license" className="flex items-center justify-between mb-2">
        <Eyebrow>License</Eyebrow>
        {state && <Pill tone={state.tone}>{state.label}</Pill>}
      </div>
      {data.message && <p className="text-[13px] text-ink-3 mb-2">{data.message}</p>}

      {isAdmin && (
        <>
          <Row label="License ID">{data.license_id ?? "—"}</Row>
          <Row label="Issued to">{data.hospital_name ?? "—"}</Row>
          <Row label="Issued by">
            <span className="font-mono text-[12px]">{data.issued_by || "—"}</span>
            {data.approved_by && data.approved_by !== data.issued_by && <span className="text-ink-4 font-normal"> (approved by <span className="font-mono">{data.approved_by}</span>)</span>}
          </Row>
          <Row label="Valid until">{formatDate(data.expires_at)}{data.grace_ends_at && data.state !== "valid" ? ` (read-only after ${formatDate(data.grace_ends_at)})` : ""}</Row>
          <Row label="User limit">{data.max_active_users ? data.max_active_users : "Unlimited"}</Row>
          <Row label="Bed limit">{data.max_beds ? data.max_beds : "Unlimited"}</Row>
          <Row label="Licensed features">
            {data.features ? (data.features.length ? data.features.map(featureLabel).join(", ") : "None") : data.enabled_modules?.join(", ") || "All"}
          </Row>
          <Row label="Deployment ID"><span className="font-mono text-[11.5px]">{data.installed_deployment_id || "—"}</span></Row>
          <Row label="Hardware binding">{data.hardware_binding === false ? "Not bound to a machine" : "Bound to this server"}</Row>
          <Row label="This server's fingerprint"><span className="font-mono text-[11.5px]">{data.machine_fingerprint}</span></Row>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); take(e.dataTransfer.files[0]) }}
            className={`mt-3.5 rounded-lg border-2 border-dashed p-5 text-center text-[13px] cursor-pointer transition-colors ${
              dragging ? "border-brand bg-brand-tint/40" : "border-border hover:border-brand/60"
            }`}
          >
            <div className="font-semibold">{upload.isPending ? "Verifying…" : "Drop a new license.lic here, or click to choose"}</div>
            <div className="text-ink-4 text-[12px] mt-1">Send the deployment ID and fingerprint above to support when renewing; the new license takes effect immediately.</div>
            <input ref={fileInput} type="file" accept=".lic" className="hidden" onChange={(e) => { take(e.target.files?.[0]); e.target.value = "" }} />
          </div>
          {uploadError && <p className="mt-2 text-[12px] text-rose-600">{uploadError}</p>}
          <div className="mt-3.5 flex items-center justify-between gap-3">
            <span className="text-[12px] text-ink-4">Usage report for renewal: user, bed and patient counts only, no patient details.</span>
            <Button size="sm" variant="secondary" onClick={async () => triggerBlobDownload(await downloadUsageReport(), `usage-${data.license_id ?? "report"}-${new Date().toISOString().slice(0, 10)}.json`)}>
              Download usage report
            </Button>
          </div>
          {done && <p className="mt-2 text-[12px] text-emerald-600 font-semibold">License installed.</p>}
        </>
      )}
      {data.support && (data.support.email || data.support.phone) && (
        <p className="text-[12px] text-ink-4 mt-3">Support: {[data.support.email, data.support.phone].filter(Boolean).join(" · ")}</p>
      )}
    </Card>
  )
}
