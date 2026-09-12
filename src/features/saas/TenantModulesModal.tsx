import { useState } from "react"
import { Button } from "../../components/ui/Button"

import { Pill } from "../../components/ui/Pill"
import type { SaaSHospital } from "../../types/api"

export const SYSTEM_MODULES = [
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
]

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
  const [selected, setSelected] = useState<string[]>(hospital.enabled_modules || [])

  const toggleModule = (key: string) => {
    if (selected.includes(key)) {
      setSelected(selected.filter((k) => k !== key))
    } else {
      setSelected([...selected, key])
    }
  }

  const selectAll = () => {
    setSelected(SYSTEM_MODULES.map((m) => m.key))
  }

  const selectCore = () => {
    setSelected(["opd", "ipd", "pharmacy", "laboratory", "billing"])
  }

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
        <div className="flex items-center justify-between py-3 px-1 text-xs">
          <span className="text-slate-500 font-medium">Quick module selection presets:</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={selectAll}>
              ✓ Select All (14)
            </Button>
            <Button size="sm" variant="secondary" onClick={selectCore}>
              🩺 Core Hospital Only (5)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelected([])}>
              ✕ Clear All
            </Button>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
          {SYSTEM_MODULES.map((m) => {
            const isChecked = selected.includes(m.key)
            return (
              <div
                key={m.key}
                onClick={() => toggleModule(m.key)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isChecked
                    ? "border-teal-500/80 bg-teal-50/50 dark:bg-teal-950/20 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40 opacity-70 hover:opacity-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // handled by parent div
                  className="mt-1 h-4 w-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 pointer-events-none"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span>{m.icon}</span>
                      <span>{m.name}</span>
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {m.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                    {m.desc}
                  </p>
                </div>
              </div>
            )
          })}
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
