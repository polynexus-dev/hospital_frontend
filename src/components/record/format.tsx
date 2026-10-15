// Display helpers shared by ResourceTable and the record drawers.

export function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString()
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export function StatusPill({ value }: { value: unknown }) {
  const v = String(value ?? "")
  const tone = /critical|reject|fail|overdue|mismatch|breakdown|expired|recalled|cancel|death|severe|high|block|sentinel|wrong/i.test(v)
    ? "bg-danger-bg text-danger-text dark:bg-rose-950 dark:text-rose-300"
    : /pending|wait|draft|open|warning|moderate|partial|progress|scheduled|requested|suspected|medium|unpaid|submitted|review|escalat|hold/i.test(v)
      ? "bg-warning-bg text-warning-text dark:bg-amber-950 dark:text-amber-300"
      : /done|pass|paid|approved|complete|verified|active|granted|given|delivered|cleared|matched|eligible|success|normal|low|closed|available|in_use|settled|discharged|admitted/i.test(v)
        ? "bg-success-bg text-success-text dark:bg-emerald-950 dark:text-emerald-300"
        : "bg-chip-bg text-ink-2 dark:bg-slate-800 dark:text-slate-300"
  return <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded capitalize ${tone}`}>{v.replace(/_/g, " ") || "—"}</span>
}

export function money(v: unknown): string {
  const n = Number(v)
  if (v === null || v === undefined || v === "" || Number.isNaN(n)) return "—"
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function dateTime(v: unknown): string {
  if (!v) return "—"
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
}

const ACRONYMS = new Set(["id", "opd", "ipd", "gst", "hsn", "sac", "mrn", "uhid", "tpa", "icu", "ot", "ed", "dob", "abha", "nps", "url", "pdf", "sms", "ivr", "upi", "mrp", "bmi", "hb", "bp", "ecg", "nicu", "picu", "his", "crm", "erp", "pan", "ifsc", "otp", "mlc", "lmp", "edd", "ews", "uom", "sku", "po", "grn"])

export function humanize(key: string): string {
  const words = key.replace(/_(detail|display)$/, "").split(/[_\s]+/).filter(Boolean)
  return words
    .map((w, i) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
}

const MONEY_KEY = /(^|_)(amount|price|total|fee|fees|cost|balance|mrp|charges?|salary|gross|net|paid|due|deposit|outstanding|revenue|value|tariff_rate|rate_per_day|budget|payable|receivable|refund)(_|$)/
const NOT_MONEY_KEY = /(gst|tax)_rate|percent|pct|count|_id$|quantity|qty|days|hours|minutes|score|units|number/

export function isMoneyKey(key: string): boolean {
  return MONEY_KEY.test(key) && !NOT_MONEY_KEY.test(key)
}

export function isStatusKey(key: string): boolean {
  return /(^|_)(status|stage|priority|severity|triage|risk|outcome|result_flag|flag)$/.test(key)
}
