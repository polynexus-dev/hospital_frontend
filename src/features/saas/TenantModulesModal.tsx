import { useState } from "react"
import { Button } from "../../components/ui/Button"

import { Pill } from "../../components/ui/Pill"
import type { SaaSHospital } from "../../types/api"

// Licensable modules, in two suites. Keys must match ALL_MODULES in
// backend/apps/core/models.py (apps.core.test_modules checks it).
// Patients, appointments and the dashboard are shared and always on.
const CRM_MODULES = [
  { key: "telephony", name: "Telephony & Callbacks", icon: "📞", category: "Front Office", desc: "Call console with screen-pop, missed-call chase list" },
  { key: "enquiries", name: "Enquiries & Leads", icon: "📥", category: "Front Office", desc: "All-channel lead capture, SLA timers, estimates" },
  { key: "inbox", name: "Inbox & Campaigns", icon: "💬", category: "Engagement", desc: "WhatsApp, SMS, email in one thread; broadcasts" },
  { key: "referrals", name: "Referral Doctor CRM", icon: "🤝", category: "Growth", desc: "Referring doctors, commissions, field visits" },
  { key: "packages", name: "Packages & Camps", icon: "🎁", category: "Growth", desc: "Health packages, camps, campaign ROI" },
  { key: "tpa", name: "TPA & Pre-auth Desk", icon: "🧾", category: "Front Office", desc: "TPA directory, pre-authorisation, TAT tracking" },
  { key: "feedback", name: "Feedback & NPS", icon: "⭐", category: "Engagement", desc: "NPS surveys, detractor recovery, complaints" },
  { key: "workflows", name: "Workflows & Tasks", icon: "⚙️", category: "Automation", desc: "Trigger-condition-action rules, recalls, tasks" },
].map((m) => ({ ...m, suite: "crm" as const }))

const HMS_MODULES = [
  { key: "opd", name: "Outpatient (OPD)", icon: "🩺", category: "Clinical", desc: "Consultations, appointments, token display, e-Rx" },
  { key: "ipd", name: "Inpatient (IPD)", icon: "🛏️", category: "Clinical", desc: "Admissions, bed matrix, rounds, discharge summary" },
  { key: "nursing", name: "Nursing Station", icon: "👩‍⚕️", category: "Clinical", desc: "Vitals monitoring, medication administration (MAR)" },
  { key: "laboratory", name: "Pathology Laboratory", icon: "🔬", category: "Diagnostics", desc: "Diagnostic test orders, sample collection, verification" },
  { key: "radiology", name: "Radiology & Imaging", icon: "🩻", category: "Diagnostics", desc: "X-ray, CT, Ultrasound orders & PACS reports" },
  { key: "pharmacy", name: "Pharmacy & Dispensing", icon: "💊", category: "Pharmacy", desc: "Rx fulfillment, POS cashier, batch expiry management" },
  { key: "emergency", name: "Emergency & Casualty", icon: "🚨", category: "Critical Care", desc: "Red/Yellow/Green triage, rapid trauma intake" },
  { key: "ot", name: "Operation Theatre", icon: "🔪", category: "Critical Care", desc: "Surgical booking, OT roster, anaesthesia logs" },
  { key: "icu", name: "Intensive Care (ICU)", icon: "❤️‍🩹", category: "Critical Care", desc: "Critical care charts, ventilator & device monitoring" },
  { key: "bloodbank", name: "Blood Bank", icon: "🩸", category: "Diagnostics", desc: "Donor registry, component inventory, cross-matching" },
  { key: "billing", name: "Patient Billing & Cashier", icon: "🧾", category: "Financial", desc: "Itemized invoices, insurance/TPA claims, receipts" },
  { key: "inventory", name: "Hospital Inventory", icon: "📦", category: "Administrative", desc: "Stock requisitions, vendor POs, warehouse batches" },
  { key: "finance", name: "Finance & Accounts", icon: "📊", category: "Financial", desc: "General ledger, voucher entries, departmental P&L" },
  { key: "hr", name: "HR & Staff Management", icon: "👥", category: "Administrative", desc: "Doctor roster, staff shifts, biometric attendance" },
  { key: "telemedicine", name: "Telemedicine", icon: "📹", category: "Clinical", desc: "Video consultations with consent, patient join links" },
  { key: "queue", name: "Queue & Token Display", icon: "🎫", category: "Clinical", desc: "Counters, tokens, TV waiting-room screens" },
  { key: "portal", name: "Patient Portal", icon: "📱", category: "Patient Engagement", desc: "Mobile-OTP portal: bookings, reports, bills, feedback" },
  { key: "oncology", name: "Oncology", icon: "🎗️", category: "Specialty", desc: "Cancer registry, chemo & radiotherapy, tumour boards" },
  { key: "cathlab", name: "Cath Lab", icon: "🫀", category: "Specialty", desc: "PCI procedures, door-to-device, stent traceability" },
  { key: "dietary", name: "Dietary & Kitchen", icon: "🍲", category: "Clinical", desc: "Diet orders, therapeutic diets, kitchen trays" },
  { key: "infection_control", name: "Infection Control", icon: "🧼", category: "Quality & Compliance", desc: "HAI surveillance, antimicrobial stewardship, exposures" },
  { key: "quality", name: "Quality & NABH KPIs", icon: "🏅", category: "Quality & Compliance", desc: "Incident reporting, 32 NABH quality indicators" },
  { key: "mrd", name: "Medical Records (MRD)", icon: "🗂️", category: "Quality & Compliance", desc: "Record files, movement tracking, ICD-10 coding" },
  { key: "schemes", name: "Government Schemes", icon: "🏛️", category: "Financial", desc: "PM-JAY, CGHS, ECHS packages, pre-auth and claims" },
  { key: "support_services", name: "Support Services", icon: "🚑", category: "Administrative", desc: "Ambulance, CSSD, housekeeping, equipment, laundry" },
  { key: "predictive", name: "Predictive Analytics", icon: "📈", category: "Administrative", desc: "Footfall, bed and stock forecasts, no-show risk" },
  { key: "abdm", name: "ABDM / ABHA", icon: "🆔", category: "Patient Engagement", desc: "ABHA linking, health-record exchange, NHCX claims" },
].map((m) => ({ ...m, suite: "hms" as const }))

export const SYSTEM_MODULES = [...CRM_MODULES, ...HMS_MODULES]
export const MODULE_SUITES = [
  { key: "crm" as const, name: "CRM", desc: "Front office, patient acquisition and engagement", modules: CRM_MODULES },
  { key: "hms" as const, name: "HMS", desc: "Clinical, diagnostics, inpatient, finance and operations", modules: HMS_MODULES },
]


// The modules a basic hospital plan starts with.
export const CORE_MODULE_KEYS = ["opd", "ipd", "pharmacy", "laboratory", "billing"]
export const CRM_MODULE_KEYS = CRM_MODULES.map((m) => m.key)
const KNOWN_KEYS = new Set(SYSTEM_MODULES.map((m) => m.key))

export const MODULE_PRESETS = [
  { label: "Everything", keys: () => SYSTEM_MODULES.map((m) => m.key) },
  { label: "CRM only", keys: () => CRM_MODULE_KEYS },
  { label: "HMS core", keys: () => CORE_MODULE_KEYS },
  { label: "Clear", keys: () => [] as string[] },
]

/** CRM and HMS module sections with per-suite counts and All / None. */
export function ModuleSuitePicker({ selected, onChange, compact = false }: { selected: string[]; onChange: (next: string[]) => void; compact?: boolean }) {
  const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  const setSuite = (keys: string[], on: boolean) =>
    onChange(on ? Array.from(new Set([...selected, ...keys])) : selected.filter((k) => !keys.includes(k)))
  return (
    <div className="space-y-5">
      {MODULE_SUITES.map((suite) => {
        const keys = suite.modules.map((m) => m.key)
        const active = keys.filter((k) => selected.includes(k)).length
        return (
          <section key={suite.key} aria-labelledby={`suite-${suite.key}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3 id={`suite-${suite.key}`} className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">{suite.name}</h3>
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{active} / {keys.length}</span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">{suite.desc}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={() => setSuite(keys, true)} className="text-teal-600 hover:underline font-semibold">All</button>
                <span className="text-slate-300">·</span>
                <button type="button" onClick={() => setSuite(keys, false)} className="text-slate-500 hover:underline">None</button>
              </div>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
              {suite.modules.map((m) => {
                const isChecked = selected.includes(m.key)
                return (
                  <label
                    key={m.key}
                    className={`flex items-start gap-3 ${compact ? "p-3" : "p-3.5"} rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? "border-teal-500/80 bg-teal-50/50 dark:bg-teal-950/20 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(m.key)} className="mt-1 h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300" />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span aria-hidden>{m.icon}</span>
                          <span>{m.name}</span>
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap">{m.category}</span>
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">{m.desc}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Only the keys this console knows (drops legacy flags such as "crm"). */
export function knownModules(keys: string[] | null | undefined) {
  return (keys || []).filter((k) => KNOWN_KEYS.has(k))
}

interface TenantModulesModalProps {
  hospital: SaaSHospital
  onClose: () => void
  onSave: (modules: string[]) => Promise<void>
  isSaving: boolean
}

export function TenantModulesModal({
  hospital,
  onClose,
  onSave,
  isSaving,
}: TenantModulesModalProps) {
  const [selected, setSelected] = useState<string[]>(knownModules(hospital.enabled_modules))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Configure SaaS Modules
              </h2>
              <Pill tone="info">{selected.length} / {SYSTEM_MODULES.length} Active</Pill>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tenant: <span className="font-semibold text-slate-800 dark:text-slate-200">{hospital.name}</span> (<span className="font-mono text-indigo-500">{hospital.slug}.hms.polynexus.in</span>)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Quick presets toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-3 px-1 text-xs">
          <span className="text-slate-500 font-medium">Quick presets:</span>
          <div className="flex flex-wrap items-center gap-2">
            {MODULE_PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant="secondary" onClick={() => setSelected(p.keys())}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* CRM and HMS module sections */}
        <div className="flex-1 overflow-y-auto pr-1 py-2">
          <ModuleSuitePicker selected={selected} onChange={setSelected} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 mt-2">
          <span className="text-xs text-slate-500">
            Changes take effect immediately for all {hospital.name} staff users upon reload.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={isSaving}
              onClick={() => onSave(selected)}
            >
              {isSaving ? "Saving..." : "Save Module Configuration"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
