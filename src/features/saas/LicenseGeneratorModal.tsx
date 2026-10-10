import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { ApiError, triggerBlobDownload } from "../../api/client"
import { downloadLicense, generateLicense, listLicenses, revokeLicense } from "../../api/saas"
import type { OnPremiseLicense, SaaSHospital } from "../../types/api"
import { LICENCE_FEATURES } from "./licenceFeatures"

const DAY = 24 * 60 * 60 * 1000
const TIERS = ["starter", "pro", "enterprise"] as const

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function errorText(err: unknown) {
  if (err instanceof ApiError && err.body && typeof err.body === "object") {
    const body = err.body as Record<string, unknown>
    if (typeof body.detail === "string") return body.detail
    return Object.entries(body).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : String(v)}`).join(" · ")
  }
  return "Something went wrong."
}

const STATUS_TONE = { active: "ok", expired: "warn", revoked: "bad" } as const

const inputClass = "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
const labelClass = "block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"

/** SaaS console: issue a signed license file for an on-premise installation,
 *  and see / re-download / revoke the ones already issued. */
export function LicenseGeneratorModal({ hospital, onClose }: { hospital: SaaSHospital; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [fingerprint, setFingerprint] = useState("")
  const [binding, setBinding] = useState(true)
  const [deploymentId, setDeploymentId] = useState("")
  const [expiresOn, setExpiresOn] = useState(isoDate(new Date(Date.now() + 365 * DAY)))
  const [graceDays, setGraceDays] = useState(14)
  const [tier, setTier] = useState<string>("enterprise")
  const [maxUsers, setMaxUsers] = useState(50)
  const [maxBeds, setMaxBeds] = useState(100)
  const [features, setFeatures] = useState<string[]>(["hms_core"])
  const toggleFeature = (key: string) => setFeatures((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]))
  const [otp, setOtp] = useState("")
  const [issued, setIssued] = useState<OnPremiseLicense | null>(null)
  const [pending, setPending] = useState(false)

  const history = useQuery({ queryKey: ["saas-licenses", hospital.id], queryFn: () => listLicenses(hospital.id) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["saas-licenses", hospital.id] })

  const download = async (lic: OnPremiseLicense) => triggerBlobDownload(await downloadLicense(lic.id), `${lic.license_id}.lic`)

  const durationDays = Math.ceil((new Date(`${expiresOn}T23:59:59`).getTime() - Date.now()) / DAY)
  const generate = useMutation({
    mutationFn: () =>
      generateLicense(hospital.id, {
        duration_days: durationDays,
        grace_period_days: graceDays,
        features,
        deployment_id: deploymentId.trim() || null,
        hardware_binding: binding,
        machine_fingerprint: binding ? fingerprint.trim() : "",
        max_users: maxUsers,
        max_beds: maxBeds,
        tier,
        otp: otp.trim(),
      }),
    onSuccess: async (result) => {
      setOtp("")
      if ("request" in result) {
        // Not an Owner: nothing is signed until a SaaS Owner approves it.
        setIssued(null)
        setPending(true)
        return
      }
      setPending(false)
      setIssued(result)
      refresh()
      await download(result)
    },
  })
  const revoke = useMutation({ mutationFn: (lic: OnPremiseLicense) => revokeLicense(lic.id, "Revoked from SaaS console"), onSuccess: refresh })

  const canGenerate = features.length > 0 && durationDays >= 1 && /^\d{6}$/.test(otp.trim())
    && (!binding || fingerprint.trim().length === 64 || fingerprint.trim() === "*")

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-gen-title"
        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-6 w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 id="license-gen-title" className="text-xl font-bold tracking-tight">On-Premise License Generator</h2>
            <p className="text-xs text-slate-500 mt-1">
              Tenant: <span className="font-semibold text-slate-800 dark:text-slate-200">{hospital.name}</span> — signs a license.lic for their own server.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-5">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass} htmlFor="lic-dep">Deployment ID</label>
              <input
                id="lic-dep"
                value={deploymentId}
                onChange={(e) => setDeploymentId(e.target.value)}
                placeholder="From the installer (install.sh / install.ps1). Leave blank to generate one."
                className={`${inputClass} font-mono`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <input type="checkbox" checked={binding} onChange={(e) => setBinding(e.target.checked)} />
                Bind to one machine (hardware binding)
              </label>
              {binding && (
                <input
                  id="lic-fp"
                  aria-label="Machine fingerprint"
                  value={fingerprint}
                  onChange={(e) => setFingerprint(e.target.value)}
                  placeholder="64-character fingerprint printed by the installer"
                  className={`${inputClass} font-mono`}
                />
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="lic-exp">Expires on</label>
              <input id="lic-exp" type="date" value={expiresOn} min={isoDate(new Date(Date.now() + DAY))} onChange={(e) => setExpiresOn(e.target.value)} className={inputClass} />
              <span className="text-[11px] text-slate-500">{durationDays > 0 ? `${durationDays} days from today` : "Pick a future date"}</span>
            </div>
            <div>
              <label className={labelClass} htmlFor="lic-grace">Grace period (days after expiry, before read-only)</label>
              <input id="lic-grace" type="number" min={0} max={90} value={graceDays} onChange={(e) => setGraceDays(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="lic-users">Max active users (0 = unlimited)</label>
              <input id="lic-users" type="number" min={0} value={maxUsers} onChange={(e) => setMaxUsers(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="lic-beds">Max beds (0 = unlimited)</label>
              <input id="lic-beds" type="number" min={0} value={maxBeds} onChange={(e) => setMaxBeds(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="lic-tier">Tier</label>
              <select id="lic-tier" value={tier} onChange={(e) => setTier(e.target.value)} className={`${inputClass} capitalize`}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </section>

          <section>
            <div className="text-sm font-bold mb-2">Licensed features</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {LICENCE_FEATURES.map((f) => (
                <label key={f.key} className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs cursor-pointer ${features.includes(f.key) ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/20" : "border-slate-200 dark:border-slate-800"}`}>
                  <input type="checkbox" checked={features.includes(f.key)} onChange={() => toggleFeature(f.key)} />
                  {f.label}
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="text-sm font-bold mb-2">Issued licenses</div>
            {history.isLoading ? (
              <p className="text-xs text-slate-500">Loading…</p>
            ) : !history.data?.results.length ? (
              <p className="text-xs text-slate-500">None yet.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                {history.data.results.map((lic) => (
                  <div key={lic.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="font-mono font-semibold">{lic.license_id}</div>
                      <div className="text-slate-500">
                        {lic.issued_by_code && <>by {lic.issued_by_code}{lic.approved_by_code && lic.approved_by_code !== lic.issued_by_code ? `, approved ${lic.approved_by_code}` : ""} · </>}
                        until {new Date(lic.expires_at).toLocaleDateString()} · {lic.max_active_users || "∞"} users · {lic.max_beds || "∞"} beds ·{" "}
                        {lic.machine_fingerprint === "*" || lic.machine_fingerprint === "-" ? "any machine" : `${lic.machine_fingerprint.slice(0, 12)}…`} · {lic.features?.length ?? 0} features
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={STATUS_TONE[lic.status]}>{lic.status}</Pill>
                      {lic.status !== "revoked" && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => download(lic)}>Download License File</Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={revoke.isPending}
                            onClick={() => window.confirm(`Revoke ${lic.license_id}? Re-downloads stop; an offline server keeps it until it expires or is replaced.`) && revoke.mutate(lic)}
                          >
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs">
            {generate.isError ? <span className="text-rose-600">{errorText(generate.error)}</span>
              : issued ? <span className="text-emerald-600 font-semibold">{issued.license_id} issued and downloaded.</span>
              : pending ? <span className="text-amber-600 font-semibold">Sent to a SaaS Owner for approval — track it under On-Premise Licences.</span>
              : <span className="text-slate-500">The hospital uploads the file in Settings → License, or places it at ./license/hospital.lic.</span>}
          </span>
          <div className="flex items-center gap-2">
            <input
              aria-label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="2FA code"
              title="A current 6-digit code from your authenticator app — required for every licence"
              className={`${inputClass} w-28 font-mono`}
            />
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button variant="primary" disabled={!canGenerate || generate.isPending} onClick={() => generate.mutate()}>
              {generate.isPending ? "Signing…" : "Request / Generate License"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
