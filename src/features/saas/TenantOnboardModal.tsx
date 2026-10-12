import { useState } from "react"
import { Button } from "../../components/ui/Button"

import { Pill } from "../../components/ui/Pill"
import { MODULE_PRESETS, ModuleSuitePicker, SYSTEM_MODULES } from "./TenantModulesModal"
import type { OnboardTenantPayload, SaaSHospital } from "../../types/api"

interface TenantOnboardModalProps {
  onClose: () => void
  onSuccess: (hospital: SaaSHospital) => void
  onSubmit: (payload: OnboardTenantPayload) => Promise<SaaSHospital>
}

export function TenantOnboardModal({ onClose, onSuccess, onSubmit }: TenantOnboardModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdHospital, setCreatedHospital] = useState<SaaSHospital | null>(null)

  // Step 1: Hospital Details
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [address, setAddress] = useState("")
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  // Step 2: Modules
  const [selectedModules, setSelectedModules] = useState<string[]>(SYSTEM_MODULES.map((m) => m.key))

  // Step 3: Subscription & Owner
  const [tier, setTier] = useState<"starter" | "pro" | "enterprise">("pro")
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly")
  const [basePrice, setBasePrice] = useState("25000")
  const [maxStaff, setMaxStaff] = useState("50")

  const [ownerEmail, setOwnerEmail] = useState("")
  const [ownerFirstName, setOwnerFirstName] = useState("Dr. Hospital")
  const [ownerLastName, setOwnerLastName] = useState("Director")
  const [ownerPhone, setOwnerPhone] = useState("")
  const [ownerPassword, setOwnerPassword] = useState("Hospital@123")

  // Auto-slug generator from hospital name
  const handleNameChange = (val: string) => {
    setName(val)
    if (!slugManuallyEdited) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
      setSlug(generated)
    }
  }

  const handleTierChange = (newTier: "starter" | "pro" | "enterprise") => {
    setTier(newTier)
    if (newTier === "starter") {
      setBasePrice("10000")
      setMaxStaff("15")
    } else if (newTier === "pro") {
      setBasePrice("25000")
      setMaxStaff("50")
    } else {
      setBasePrice("60000")
      setMaxStaff("0") // unlimited
    }
  }

  const validateStep1 = () => {
    if (!name.trim()) {
      setError("Please enter a hospital name.")
      return false
    }
    if (!slug.trim()) {
      setError("Please enter a subdomain slug.")
      return false
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError("Subdomain slug can only contain lowercase letters, numbers, and hyphens.")
      return false
    }
    setError(null)
    return true
  }

  const validateStep2 = () => {
    if (selectedModules.length === 0) {
      setError("Please select at least 1 module for the hospital.")
      return false
    }
    setError(null)
    return true
  }

  const validateStep3 = () => {
    if (!ownerEmail.trim() || !ownerEmail.includes("@")) {
      setError("Please provide a valid owner email address.")
      return false
    }
    if (!ownerFirstName.trim()) {
      setError("Owner first name is required.")
      return false
    }
    setError(null)
    return true
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2)
    else if (step === 2 && validateStep2()) setStep(3)
  }

  const handleFinish = async () => {
    if (!validateStep3()) return
    setError(null)
    setLoading(true)
    try {
      const payload: OnboardTenantPayload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        city: city.trim(),
        state: state.trim(),
        address: address.trim(),
        enabled_modules: selectedModules,
        subscription: {
          tier,
          billing_cycle: billingCycle,
          base_price: Number(basePrice) || 0,
          max_staff_users: Number(maxStaff) || 15,
        },
        owner: {
          email: ownerEmail.trim().toLowerCase(),
          first_name: ownerFirstName.trim(),
          last_name: ownerLastName.trim(),
          phone: ownerPhone.trim() || undefined,
          password: ownerPassword.trim() || "Hospital@123",
        },
      }

      const result = await onSubmit(payload)
      setCreatedHospital(result)
      setStep(4)
      onSuccess(result)
    } catch (err: any) {
      console.error(err)
      const msg = err.body ? JSON.stringify(err.body) : err.message || "Failed to onboard tenant."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 text-ink dark:text-slate-100 rounded-2xl p-6 w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-border dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex justify-between items-start pb-4 border-b border-border dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink dark:text-white flex items-center gap-2">
              <span>🏥 Onboard New Hospital Tenant</span>
            </h2>
            <p className="text-xs text-ink-4 dark:text-slate-400 mt-0.5">
              Provision isolated multi-tenant database records, role templates, clinical modules & admin access.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-ink-3 dark:hover:text-slate-200 text-lg p-1">
            ✕
          </button>
        </div>

        {/* Wizard Step Progress Bar */}
        {step !== 4 && (
          <div className="py-4 border-b border-border dark:border-slate-800 flex items-center justify-between text-xs px-2">
            <div className={`flex items-center gap-2 ${step >= 1 ? "text-accent dark:text-teal-400 font-bold" : "text-slate-400"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? "bg-accent text-white" : "bg-border-soft dark:bg-slate-800 text-ink-4"}`}>
                1
              </span>
              <span>1. Hospital Profile</span>
            </div>
            <div className="h-0.5 w-12 bg-border-soft dark:bg-slate-800" />
            <div className={`flex items-center gap-2 ${step >= 2 ? "text-accent dark:text-teal-400 font-bold" : "text-slate-400"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? "bg-accent text-white" : "bg-border-soft dark:bg-slate-800 text-ink-4"}`}>
                2
              </span>
              <span>2. Module Suite ({selectedModules.length})</span>
            </div>
            <div className="h-0.5 w-12 bg-border-soft dark:bg-slate-800" />
            <div className={`flex items-center gap-2 ${step >= 3 ? "text-accent dark:text-teal-400 font-bold" : "text-slate-400"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? "bg-accent text-white" : "bg-border-soft dark:bg-slate-800 text-ink-4"}`}>
                3
              </span>
              <span>3. Subscription & Owner</span>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="my-2 p-3 rounded-lg bg-danger-bg dark:bg-red-950/40 border border-danger-border dark:border-red-900 text-danger-text dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Content Body per Step */}
        <div className="flex-1 overflow-y-auto py-3">
          {/* STEP 1: Hospital Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-3 dark:text-slate-400 block mb-1">
                  Hospital / Healthcare Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Multispeciality Hospital"
                  className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-accent outline-none"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-3 dark:text-slate-400 block mb-1">
                  Subdomain Slug *
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    placeholder="e.g. apex-hospital"
                    className="flex-1 px-3 py-2 border border-border-strong dark:border-slate-700 rounded-l-lg bg-white dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-accent outline-none"
                    value={slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true)
                      setSlug(e.target.value.toLowerCase())
                    }}
                  />
                  <span className="px-3 py-2 bg-chip-bg dark:bg-slate-800 border border-l-0 border-border-strong dark:border-slate-700 rounded-r-lg text-xs font-mono text-ink-4">
                    .hms.polynexus.in
                  </span>
                </div>
                <p className="text-[11px] text-accent dark:text-teal-400 mt-1 flex items-center gap-1">
                  🌐 Live Subdomain URL Preview:{" "}
                  <span className="font-mono font-semibold underline">
                    https://{slug || "your-slug"}.hms.polynexus.in
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-3 dark:text-slate-400 block mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pune"
                    className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-accent outline-none"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-3 dark:text-slate-400 block mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-accent outline-none"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-3 dark:text-slate-400 block mb-1">
                  Full Campus Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street, Landmark, Area, PIN Code"
                  className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-accent outline-none"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Module Selection */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-medium text-ink-4">
                  Select which modules this tenant is licensed to use:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {MODULE_PRESETS.map((p, i) => (
                    <span key={p.label} className="flex items-center gap-2">
                      {i > 0 && <span className="text-slate-300">·</span>}
                      <button type="button" onClick={() => setSelectedModules(p.keys())} className="text-xs text-accent hover:underline font-semibold">
                        {p.label}
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="max-h-[50vh] overflow-y-auto pr-1">
                <ModuleSuitePicker selected={selectedModules} onChange={setSelectedModules} compact />
              </div>
            </div>
          )}

          {/* STEP 3: Subscription & Initial Admin */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Tier Selection Radio Cards */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-3 dark:text-slate-400 block mb-2">
                  Subscription Tier & Plan *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(["starter", "pro", "enterprise"] as const).map((t) => (
                    <div
                      key={t}
                      onClick={() => handleTierChange(t)}
                      className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                        tier === t
                          ? "border-accent bg-accent-tint/50 dark:bg-teal-950/30 ring-2 ring-accent/20 shadow-sm"
                          : "border-border dark:border-slate-800 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-ink dark:text-slate-100 capitalize">
                        {t}
                      </div>
                      <div className="text-base font-extrabold text-accent dark:text-teal-400 mt-1">
                        {t === "starter" ? "₹10,000" : t === "pro" ? "₹25,000" : "₹60,000"}
                      </div>
                      <div className="text-[10px] text-ink-4 mt-0.5">
                        {t === "starter" ? "Up to 15 staff" : t === "pro" ? "Up to 50 staff" : "Unlimited staff"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-3 dark:text-slate-400 block mb-1">
                    Billing Cycle
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-accent"
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as any)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual (1 Year)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-3 dark:text-slate-400 block mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-3 dark:text-slate-400 block mb-1">
                    Max Staff Seats
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono"
                    value={maxStaff}
                    onChange={(e) => setMaxStaff(e.target.value)}
                    placeholder="0 = Unlimited"
                  />
                </div>
              </div>

              {/* Initial Hospital Admin */}
              <div className="pt-3 border-t border-border dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-2 dark:text-slate-300">
                    Primary Hospital Owner / Administrator User
                  </label>
                  <Pill tone="info">Hospital Owner / Admin Role</Pill>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="text-[11px] text-ink-4 block mb-0.5">First Name *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                      value={ownerFirstName}
                      onChange={(e) => setOwnerFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-4 block mb-0.5">Last Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                      value={ownerLastName}
                      onChange={(e) => setOwnerLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-ink-4 block mb-0.5">Admin Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="owner@hospital.com"
                      className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-4 block mb-0.5">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+91..."
                      className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-4 block mb-0.5">Initial Password</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-border-strong dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                    />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* STEP 4: Success Screen */}
          {step === 4 && createdHospital && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-success-bg dark:bg-emerald-950/40 text-success dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto">
                ✓
              </div>
              <h3 className="text-xl font-bold text-ink dark:text-white">
                Tenant Successfully Onboarded!
              </h3>
              <p className="text-xs text-ink-4 max-w-md mx-auto">
                Database records, starter departments, role templates, and initial hospital owner have been provisioned.
              </p>

              <div className="bg-page dark:bg-slate-800/60 border border-border dark:border-slate-700 rounded-xl p-4 max-w-lg mx-auto text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-ink-4">Hospital:</span>
                  <span className="font-bold text-ink dark:text-slate-100">{createdHospital.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-4">Subdomain:</span>
                  <span className="font-mono font-bold text-accent">{createdHospital.slug}.hms.polynexus.in</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-4">Modules Enabled:</span>
                  <span className="font-semibold">{createdHospital.enabled_modules?.length || 0} Modules</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-4">Admin Email:</span>
                  <span className="font-mono">{ownerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-4">Password:</span>
                  <span className="font-mono font-semibold">{ownerPassword}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-border dark:border-slate-800 mt-2">
          {step === 4 ? (
            <div className="w-full flex justify-end gap-2">
              <Button variant="primary" onClick={onClose}>
                Done & View Console
              </Button>
            </div>
          ) : (
            <>
              {step > 1 ? (
                <Button variant="secondary" onClick={() => setStep((step - 1) as any)}>
                  ← Back
                </Button>
              ) : (
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
              )}

              <div className="flex items-center gap-2">
                {step < 3 ? (
                  <Button variant="primary" onClick={handleNext}>
                    Next Step →
                  </Button>
                ) : (
                  <Button variant="primary" disabled={loading} onClick={handleFinish}>
                    {loading ? "Provisioning Tenant..." : "🚀 Launch & Onboard Hospital"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
