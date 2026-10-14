import { useEffect, useState } from "react"
import { extractApiError } from "../../api/client"
import { getLabSettings, saveLabSettings, type LabSettings } from "../../api/laboratory"
import { col, opts } from "../nabh/fields"

const inputCls = "w-full px-3 py-2 text-sm border border-border-strong dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900"
const card = "bg-white dark:bg-slate-800 rounded-xl border border-border dark:border-slate-700 p-5 space-y-4"

/** NABL accreditation, automatic report dispatch and order grouping. */
export function LabSettingsPanel() {
  const [s, setS] = useState<LabSettings | null>(null)
  const [times, setTimes] = useState("")
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    getLabSettings().then((d) => { setS(d); setTimes(d.dispatch_times.join(", ")) }).catch((e) => setError(extractApiError(e)))
  }, [])
  if (!s) return error ? <div className="text-sm text-danger-text">{error}</div> : null
  const set = (patch: Partial<LabSettings>) => setS({ ...s, ...patch })
  const toggleChannel = (c: string) => set({ dispatch_channels: s.dispatch_channels.includes(c) ? s.dispatch_channels.filter((x) => x !== c) : [...s.dispatch_channels, c] })
  const save = async () => {
    setError(null)
    setNotice(null)
    try {
      const saved = await saveLabSettings({
        nabl_certificate_number: s.nabl_certificate_number, nabl_valid_until: s.nabl_valid_until || null,
        auto_dispatch: s.auto_dispatch, dispatch_channels: s.dispatch_channels,
        dispatch_times: times.split(",").map((t) => t.trim()).filter(Boolean),
        dispatch_delay_minutes: s.dispatch_delay_minutes, merge_window_minutes: s.merge_window_minutes, split_by_department: s.split_by_department,
      })
      setS(saved)
      setTimes(saved.dispatch_times.join(", "))
      setNotice("Saved.")
    } catch (e) {
      setError(extractApiError(e))
    }
  }
  return (
    <div className="space-y-6">
      <section className={card}>
        <div>
          <h2 className="text-lg font-bold">NABL accreditation</h2>
          <p className="text-sm text-ink-4">With a valid certificate, reports that include accredited tests show the certificate number, mark those tests with *, and say the others are outside the scope. Tick “NABL accredited” on each test in the scope under Lab tests.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="text-xs font-semibold text-ink-3">Certificate number
            <input className={`${inputCls} mt-1`} placeholder="e.g. MC-1234" value={s.nabl_certificate_number} onChange={(e) => set({ nabl_certificate_number: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-ink-3">Valid until
            <input type="date" className={`${inputCls} mt-1`} value={s.nabl_valid_until ?? ""} onChange={(e) => set({ nabl_valid_until: e.target.value || null })} />
          </label>
          <div className="text-sm flex items-end pb-2">{s.nabl_active ? <span className="text-success-text font-semibold">Active on reports</span> : <span className="text-ink-4">Not shown on reports</span>}</div>
        </div>
      </section>

      <section className={card}>
        <div>
          <h2 className="text-lg font-bold">Send reports automatically</h2>
          <p className="text-sm text-ink-4">Verified reports go to the patient by email (PDF attached) and/or WhatsApp (a download link valid 30 days). A patient's reports that are due together go in one message. Every send is logged on the order.</p>
        </div>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={s.auto_dispatch} onChange={(e) => set({ auto_dispatch: e.target.checked })} /> Send verified reports automatically
        </label>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="text-xs font-semibold text-ink-3">Send by
            <div className="flex gap-4 mt-2 text-sm font-normal">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.dispatch_channels.includes("email")} onChange={() => toggleChannel("email")} /> Email</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={s.dispatch_channels.includes("whatsapp")} onChange={() => toggleChannel("whatsapp")} /> WhatsApp</label>
            </div>
          </div>
          <label className="text-xs font-semibold text-ink-3">Batch times (blank = as soon as verified)
            <input className={`${inputCls} mt-1`} placeholder="e.g. 10:00, 17:00" value={times} onChange={(e) => setTimes(e.target.value)} />
          </label>
          <label className="text-xs font-semibold text-ink-3">Wait after verification (minutes)
            <input type="number" min={0} className={`${inputCls} mt-1`} value={s.dispatch_delay_minutes} onChange={(e) => set({ dispatch_delay_minutes: Number(e.target.value) })} />
          </label>
        </div>
      </section>

      <section className={card}>
        <div>
          <h2 className="text-lg font-bold">New orders</h2>
          <p className="text-sm text-ink-4">Department-wise orders give each department its own order, samples and report. Merging adds tests to the patient's open order (no sample collected yet) instead of opening another one.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={s.split_by_department} onChange={(e) => set({ split_by_department: e.target.checked })} /> One order per lab department
          </label>
          <label className="text-xs font-semibold text-ink-3">Merge into an open order placed within (minutes, 0 = off)
            <input type="number" min={0} className={`${inputCls} mt-1`} value={s.merge_window_minutes} onChange={(e) => set({ merge_window_minutes: Number(e.target.value) })} />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} className="px-4 py-2 text-sm font-semibold rounded-lg bg-success text-white">Save lab settings</button>
        {notice && <span className="text-sm text-success-text">{notice}</span>}
        {error && <span className="text-sm text-danger-text">{error}</span>}
      </div>
    </div>
  )
}

export const labTestsResource = {
  title: "Lab tests",
  description: "The test catalogue. A calculated test fills in from the order's other results: write other tests as {CODE}, e.g. {CHOL} - {HDL} - {TG} / 5; AGE and FEMALE (1/0) come from the patient. Its value is flagged against the reference and critical limits like any result, so a critical calculated value alerts the doctor.",
  endpoint: "/laboratory/tests/", createLabel: "Add test",
  filters: [{ key: "department", label: "Department", type: "select" as const, options: opts("hematology", "biochemistry", "microbiology", "serology", "pathology", "other") }],
  columns: [col("code", "Code"), col("name", "Test"), col("department", "Dept"), col("unit", "Unit"),
    { key: "limits", label: "Ref / critical", render: (r: any) => `${r.ref_low ?? "–"}–${r.ref_high ?? "–"} / ${r.critical_low ?? "–"}–${r.critical_high ?? "–"}` },
    { key: "formula", label: "Formula", render: (r: any) => r.formula || "—" }, col("is_nabl_accredited", "NABL"), col("tat_hours", "TAT h"), col("is_active", "Active")],
  fields: [
    { key: "name", label: "Name", required: true },
    { key: "code", label: "Code (used in formulas)" },
    { key: "department", label: "Department", type: "select" as const, options: opts("hematology", "biochemistry", "microbiology", "serology", "pathology", "other"), defaultValue: "other" },
    { key: "sample_type", label: "Sample type" },
    { key: "unit", label: "Unit" },
    { key: "reference_range", label: "Reference range (text)" },
    { key: "ref_low", label: "Reference low", type: "number" as const },
    { key: "ref_high", label: "Reference high", type: "number" as const },
    { key: "critical_low", label: "Critical low", type: "number" as const },
    { key: "critical_high", label: "Critical high", type: "number" as const },
    { key: "formula", label: "Formula (calculated test)", placeholder: "{CHOL} - {HDL} - {TG} / 5" },
    { key: "tat_hours", label: "Turnaround (hours)", type: "number" as const },
    { key: "price", label: "Price (₹)", type: "number" as const },
    { key: "is_nabl_accredited", label: "NABL accredited", type: "boolean" as const, defaultValue: false },
    { key: "is_outsourced", label: "Usually outsourced", type: "boolean" as const, defaultValue: false },
    { key: "is_active", label: "Active", type: "boolean" as const, defaultValue: true },
  ],
}
