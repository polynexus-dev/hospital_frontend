import { ModuleHub } from "../../components/resource/ModuleHub"
import { StatusPill } from "../../components/resource/ResourceTable"
import { admissionField, col, doctorField, opts, patientCol, patientField, userField } from "./fields"
import { CDSSChecker } from "./CDSSChecker"

export function ClinicalSafetyPage() {
  return (
    <ModuleHub
      title="Clinical Safety & Documentation"
      subtitle="NABH COP / MOM — alerts, allergies, assessments, risk scores, consent, handover, care plans, CDSS and reporting"
      tabs={[
        {
          key: "alerts",
          label: "Alert inbox",
          resource: {
            title: "Clinical alerts",
            description: "Critical results, allergy / interaction / contraindication warnings, early-warning scores, notifiable diseases and referrals addressed to you or your department.",
            endpoint: "/clinical/alerts/?open=1",
            searchable: false,
            filters: [{ key: "severity", label: "Severity", type: "select", options: opts("critical", "warning", "info") }],
            columns: [
              { key: "severity", label: "Severity" }, col("alert_type", "Type"), col("title", "Alert"), patientCol, col("target_department", "Dept"), col("created_at", "Raised"),
            ],
            actions: [{ label: "Acknowledge", path: "acknowledge/", tone: "primary", prompt: [{ key: "override_reason", label: "Override / action taken (required for critical safety alerts)", type: "textarea" }] }],
          },
        },
        { key: "cdss", label: "Prescription safety check", render: () => <CDSSChecker /> },
        {
          key: "allergies",
          label: "Allergies",
          resource: {
            title: "Allergies & ADRs", endpoint: "/clinical/allergies/", createLabel: "Record allergy",
            columns: [patientCol, col("allergen", "Allergen"), col("allergen_type", "Type"), col("reaction", "Reaction"), { key: "severity", label: "Severity" }, { key: "status", label: "Status" }],
            fields: [patientField(), { key: "allergen", label: "Allergen (generic / class)", required: true }, { key: "allergen_type", label: "Type", type: "select", options: opts("drug", "food", "environmental", "other"), defaultValue: "drug" },
              { key: "reaction", label: "Reaction" }, { key: "severity", label: "Severity", type: "select", options: opts("mild", "moderate", "severe"), defaultValue: "moderate" },
              { key: "is_adverse_drug_reaction", label: "Adverse drug reaction (not true allergy)", type: "boolean" }],
          },
        },
        {
          key: "assessments",
          label: "Assessments",
          resource: {
            title: "Initial assessments & re-assessments", endpoint: "/clinical/assessments/", createLabel: "New assessment",
            description: "Category-specific templates (general, antenatal, paediatric, ophthalmology, ENT, nursing, dietary, oncology). Template-required answers are enforced.",
            filters: [{ key: "category", label: "Category", type: "select", options: opts("general", "antenatal", "obstetrics", "paediatrics", "ophthalmology", "ent", "oncology", "nursing", "dietary", "rehab") }],
            columns: [patientCol, col("category", "Category"), col("kind", "Kind"), col("chief_complaint", "Chief complaint"), col("provisional_diagnosis", "Provisional diagnosis"), col("assessed_by_name", "By"), col("assessed_at", "At")],
            fields: [patientField(), admissionField(), { key: "template", label: "Template", type: "fk", source: "/clinical/assessment-templates/" },
              { key: "kind", label: "Kind", type: "select", options: opts("initial", "reassessment"), defaultValue: "initial" },
              { key: "chief_complaint", label: "Chief complaint" }, { key: "provisional_diagnosis", label: "Provisional diagnosis" },
              { key: "history", label: "History", type: "textarea" }, { key: "examination", label: "Examination", type: "textarea" },
              { key: "data", label: "Template answers (JSON)", type: "json", help: "Keys from the chosen template, e.g. {\"lmp\": \"2026-06-01\"}" }],
          },
        },
        {
          key: "risk",
          label: "Risk scores",
          resource: {
            title: "Fall / pressure ulcer / VTE / early warning", endpoint: "/clinical/risk-assessments/", createLabel: "Score patient",
            description: "Morse, Braden, Caprini, NEWS2 and vulnerability screens are scored on the server; high risk alerts the nursing team.",
            columns: [patientCol, col("tool", "Tool"), col("score", "Score"), { key: "risk_level", label: "Risk" }, col("assessed_at", "At")],
            fields: [patientField(), admissionField(), { key: "tool", label: "Tool", type: "select", options: opts("morse_fall", "braden", "caprini", "news2", "vulnerability"), required: true },
              { key: "answers", label: "Answers (JSON)", type: "json", required: true, help: 'e.g. Morse: {"history_of_falling": true, "gait": "impaired"}; NEWS2: {"respiratory_rate": 24, "spo2": 93, "systolic_bp": 105, "heart_rate": 115, "temperature_c": 38.4}' },
              { key: "interventions", label: "Interventions", type: "textarea" }],
          },
        },
        {
          key: "consents",
          label: "Consents",
          resource: {
            title: "Patient consents", endpoint: "/clinical/consents/", createLabel: "Record consent",
            description: "Minors and patients lacking capacity require a guardian's consent — enforced on save.",
            columns: [patientCol, col("consent_type", "Type"), col("procedure_name", "Procedure"), col("given_by", "Given by"), { key: "status", label: "Status" }, col("obtained_at", "At")],
            fields: [patientField(), { key: "consent_type", label: "Consent type", type: "select", required: true,
              options: opts("general", "procedure", "anaesthesia", "blood", "high_risk", "research", "information_sharing", "telemedicine", "hiv_test", "chemotherapy", "radiotherapy", "photography") },
              { key: "procedure_name", label: "Procedure / purpose" }, { key: "language", label: "Explained in language", defaultValue: "en" },
              { key: "risks_explained", label: "Risks explained", type: "textarea" }, { key: "alternatives_explained", label: "Alternatives explained", type: "textarea" },
              { key: "patient_lacks_capacity", label: "Patient lacks capacity", type: "boolean" }, { key: "given_by", label: "Given by", type: "select", options: opts("patient", "guardian"), defaultValue: "patient" },
              { key: "guardian_name", label: "Guardian name" }, { key: "guardian_relation", label: "Guardian relation" }, { key: "witness_name", label: "Witness" }],
            actions: [{ label: "Withdraw", path: "withdraw/", tone: "danger", prompt: [{ key: "reason", label: "Reason", required: true }], show: (r) => r.status === "granted" }],
          },
        },
        {
          key: "handover",
          label: "Shift handover",
          resource: {
            title: "SBAR shift handover", endpoint: "/clinical/handovers/", createLabel: "Hand over",
            columns: [col("patient_name", "Patient"), col("shift", "Shift"), col("handover_role", "Team"), col("situation", "Situation"), col("handed_over_by_name", "From"), col("handed_over_to_name", "To"), col("acknowledged_at", "Acknowledged")],
            fields: [admissionField(true), { key: "shift", label: "Shift", type: "select", options: opts("morning", "evening", "night"), required: true },
              { key: "handover_role", label: "Team", type: "select", options: opts("nurse", "doctor"), defaultValue: "nurse" }, userField("handed_over_to", "Handing over to"),
              { key: "situation", label: "S — Situation", type: "textarea", required: true }, { key: "background", label: "B — Background", type: "textarea" },
              { key: "assessment", label: "A — Assessment", type: "textarea" }, { key: "recommendation", label: "R — Recommendation / pending tasks", type: "textarea" }],
            actions: [{ label: "Acknowledge", path: "acknowledge/", tone: "primary", show: (r) => !r.acknowledged_at }],
          },
        },
        {
          key: "careplans",
          label: "Care plans",
          resource: {
            title: "Care plans", endpoint: "/clinical/care-plans/", createLabel: "New care plan",
            columns: [patientCol, col("title", "Plan"), col("problem", "Problem"), col("review_date", "Review"), { key: "status", label: "Status" }],
            fields: [patientField(), admissionField(), { key: "title", label: "Title", required: true }, { key: "problem", label: "Problem", type: "textarea", required: true },
              { key: "goals", label: "Goals (JSON list)", type: "json", placeholder: '[{"text": "Pain score < 3", "target_date": "2026-10-01"}]' },
              { key: "interventions", label: "Interventions (JSON list)", type: "json" }, { key: "review_date", label: "Review on", type: "date" }],
          },
        },
        {
          key: "ordersets",
          label: "Order sets",
          resource: {
            title: "Order sets", endpoint: "/clinical/order-sets/", createLabel: "New order set",
            description: "Diagnosis-linked lab / radiology / medication bundles suggested at ordering (COP.1.c/i).",
            columns: [col("name", "Name"), col("kind", "Kind"), col("diagnosis_codes", "ICD codes"), { key: "items", label: "Items", render: (r) => (r.items ?? []).map((i: any) => i.name).join(", ") }],
            fields: [{ key: "name", label: "Name", required: true }, { key: "kind", label: "Kind", type: "select", options: opts("medication", "lab", "radiology", "mixed"), defaultValue: "mixed" },
              { key: "diagnosis_codes", label: "ICD-10 prefixes (JSON)", type: "json", placeholder: '["N18"]' }, { key: "diagnosis_keywords", label: "Keywords (JSON)", type: "json", placeholder: '["kidney"]' },
              { key: "items", label: "Items (JSON)", type: "json", required: true, placeholder: '[{"type": "lab", "name": "Serum creatinine"}]' }],
          },
        },
        {
          key: "referrals",
          label: "Referrals",
          resource: {
            title: "Cross-specialty referrals", endpoint: "/clinical/referrals/", createLabel: "Refer",
            filters: [{ key: "incoming", label: "Show", type: "select", options: [{ value: "1", label: "Referred to me" }] }],
            columns: [patientCol, col("to_doctor_name", "To"), col("to_department_name", "Dept"), col("reason", "Reason"), { key: "status", label: "Status" }, col("urgency", "Urgency")],
            fields: [patientField(), doctorField("to_doctor", "Refer to doctor", false), { key: "to_department", label: "or Department", type: "fk", source: "/departments/" },
              { key: "urgency", label: "Urgency", type: "select", options: opts("routine", "urgent", "emergency"), defaultValue: "routine" },
              { key: "reason", label: "Reason", type: "textarea", required: true }, { key: "clinical_summary", label: "Clinical summary", type: "textarea" }],
            actions: [{ label: "Respond", path: "respond/", tone: "primary", prompt: [{ key: "status", label: "Status", type: "select", options: opts("accepted", "seen", "declined"), required: true }, { key: "response", label: "Opinion", type: "textarea" }] }],
          },
        },
        {
          key: "notifiable",
          label: "Notifiable diseases",
          resource: {
            title: "Notifiable disease reports", endpoint: "/clinical/notifiable-reports/", searchable: false,
            description: "Opened automatically when a diagnosis matches the state notifiable list (IDSP/IHIP).",
            columns: [patientCol, col("disease_name", "Disease"), col("diagnosis_text", "Diagnosis"), col("authority", "Report to"), col("due_by", "Due by"), { key: "status", label: "Status" }, col("reference_number", "Ref")],
            actions: [{ label: "Mark reported", path: "mark_reported/", tone: "primary", prompt: [{ key: "reference_number", label: "IHIP / reference no." }], show: (r) => r.status === "pending" }],
          },
        },
        {
          key: "homecare",
          label: "Homecare",
          resource: {
            title: "Homecare bookings", endpoint: "/clinical/homecare-bookings/", createLabel: "Book homecare",
            columns: [patientCol, col("service_name", "Service"), col("scheduled_at", "When"), col("assigned_staff_name", "Staff"), { key: "status", label: "Status" }, col("feedback_score", "Feedback")],
            fields: [patientField(), { key: "service", label: "Service", type: "fk", source: "/clinical/homecare-services/", required: true }, { key: "scheduled_at", label: "When", type: "datetime", required: true },
              { key: "address", label: "Address", type: "textarea", required: true }, userField("assigned_staff", "Assign staff")],
            actions: [
              { label: "Complete & bill", path: "complete/", tone: "primary", prompt: [{ key: "visit_notes", label: "Visit notes", type: "textarea" }, { key: "vitals", label: "Vitals (JSON)", type: "json" }], show: (r) => r.status !== "completed" },
              { label: "Feedback", path: "feedback/", prompt: [{ key: "score", label: "Score 1–5", type: "number", required: true }, { key: "comment", label: "Comment" }], show: (r) => r.status === "completed" },
            ],
          },
        },
        {
          key: "rehab",
          label: "Rehab",
          resource: {
            title: "Functional assessments (rehabilitation)", endpoint: "/clinical/functional-assessments/", createLabel: "Assess",
            columns: [patientCol, col("discipline", "Discipline"), col("scale", "Scale"), col("total", "Total"), col("change_from_previous", "Δ vs previous"), col("assessed_at", "At")],
            fields: [patientField(), { key: "discipline", label: "Discipline", type: "select", options: opts("physiotherapy", "occupational", "speech", "cardiac_rehab"), required: true },
              { key: "scale", label: "Scale", type: "select", options: opts("barthel", "fim", "mrc", "rom", "pain_vas", "custom"), required: true },
              { key: "scores", label: "Item scores (JSON)", type: "json", required: true, placeholder: '{"feeding": 10, "mobility": 10}' },
              { key: "previous", label: "Previous assessment (re-assessment)", type: "fk", source: "/clinical/functional-assessments/", sourceLabel: (r) => `#${r.id} ${r.patient_name} ${r.scale} ${r.total ?? ""}` },
              { key: "goals", label: "Goals", type: "textarea" }],
          },
        },
        {
          key: "devices",
          label: "Devices",
          resource: {
            title: "Connected medical devices", endpoint: "/clinical/devices/", createLabel: "Register device",
            description: "Bedside monitors post vitals to /api/v1/clinical/device-ingest/ with their token; NEWS2 is computed on every reading.",
            columns: [col("name", "Device"), col("kind", "Kind"), col("location", "Location"), col("last_seen_at", "Last seen"), { key: "is_active", label: "Active", render: (r) => <StatusPill value={r.is_active ? "active" : "inactive"} /> }],
            fields: [{ key: "name", label: "Name", required: true }, { key: "kind", label: "Kind", type: "select", options: opts("monitor", "ventilator", "infusion_pump", "glucometer", "biometric", "barcode_scanner", "printer", "other"), required: true },
              { key: "serial_number", label: "Serial no." }, { key: "bed", label: "Bed", type: "fk", source: "/facilities/beds/", sourceLabel: "bed_number" }, { key: "location", label: "Location" }],
            actions: [{ label: "Generate token", path: "rotate_token/", method: "post", confirm: "Issue a new device token? The old one stops working." }],
          },
        },
      ]}
    />
  )
}

export function InfectionControlPage() {
  return (
    <ModuleHub
      title="Infection Prevention & Control"
      subtitle="NABH COP.8 — HAI surveillance, device days, antimicrobial stewardship, staff exposure, hand hygiene"
      tabs={[
        {
          key: "hai",
          label: "HAI cases",
          resource: {
            title: "Hospital-acquired infections", endpoint: "/infection-control/hai/", createLabel: "Report infection",
            columns: [patientCol, col("infection_type", "Type"), col("organism", "Organism"), col("ward", "Ward"), col("onset_date", "Onset"), { key: "status", label: "Status" }],
            fields: [patientField(), admissionField(), { key: "infection_type", label: "Type", type: "select", options: opts("cauti", "clabsi", "vap", "ssi", "mrsa", "cdi", "gastroenteritis", "other"), required: true },
              { key: "onset_date", label: "Onset", type: "date" }, { key: "ward", label: "Ward" }, { key: "organism", label: "Organism" }, { key: "is_mdro", label: "MDRO", type: "boolean" },
              { key: "isolation_required", label: "Isolation required", type: "boolean" }, { key: "status", label: "Status", type: "select", options: opts("suspected", "confirmed", "ruled_out", "resolved"), defaultValue: "suspected" },
              { key: "actions_taken", label: "Actions taken", type: "textarea" }],
            toolbar: [{ label: "HAI rates (30 days)", path: "rates/", method: "get" }],
          },
        },
        {
          key: "devices",
          label: "Device days",
          resource: {
            title: "Invasive device episodes", endpoint: "/infection-control/device-episodes/", createLabel: "Record insertion",
            columns: [patientCol, col("device", "Device"), col("site", "Site"), col("inserted_at", "Inserted"), col("removed_at", "Removed")],
            fields: [patientField(), admissionField(), { key: "device", label: "Device", type: "select", options: opts("urinary_catheter", "central_line", "ventilator", "peripheral_iv"), required: true },
              { key: "site", label: "Site" }, { key: "inserted_at", label: "Inserted at", type: "datetime" }, { key: "bundle_compliance", label: "Insertion bundle (JSON)", type: "json" }],
            actions: [{ label: "Remove device", path: "remove/", confirm: "Record removal now?", show: (r) => !r.removed_at }],
          },
        },
        {
          key: "abx",
          label: "Antimicrobial approvals",
          resource: {
            title: "Restricted antimicrobial approvals", endpoint: "/infection-control/antimicrobial-approvals/", createLabel: "Request approval",
            columns: [patientCol, col("drug", "Drug"), col("indication", "Indication"), col("culture_sent", "Culture sent"), { key: "status", label: "Status" }],
            fields: [patientField(), { key: "drug", label: "Drug", required: true }, { key: "indication", label: "Indication", type: "textarea", required: true },
              { key: "culture_sent", label: "Culture sent", type: "boolean" }, { key: "planned_duration_days", label: "Planned days", type: "number" }],
            actions: [
              { label: "Approve", path: "approve/", tone: "primary", prompt: [{ key: "notes", label: "Notes" }], show: (r) => r.status === "requested" },
              { label: "Reject", path: "reject/", tone: "danger", prompt: [{ key: "notes", label: "Reason", required: true }], show: (r) => r.status === "requested" },
            ],
          },
        },
        {
          key: "policy",
          label: "Antimicrobial policy",
          resource: {
            title: "Antimicrobial usage policy", endpoint: "/infection-control/antimicrobial-policies/", createLabel: "New policy version",
            columns: [col("title", "Title"), col("version", "Version"), col("effective_from", "Effective"), col("is_current", "Current"), { key: "sections", label: "Sections", render: (r) => (r.sections ?? []).map((s: any) => s.title).join(" · ") }],
            fields: [{ key: "title", label: "Title", defaultValue: "Antimicrobial Usage Policy" }, { key: "version", label: "Version", defaultValue: "1.0" }, { key: "effective_from", label: "Effective from", type: "date" },
              { key: "sections", label: "Sections (JSON)", type: "json", placeholder: '[{"title": "Indication", "body": "..."}, {"title": "Selection", "body": "..."}, {"title": "Dosing", ...}, {"title": "Route"}, {"title": "Duration"}, {"title": "Timing"}]' },
              { key: "is_current", label: "Current version", type: "boolean", defaultValue: true }],
          },
        },
        {
          key: "exposure",
          label: "Staff exposure",
          resource: {
            title: "Occupational exposure register", endpoint: "/infection-control/staff-exposures/", createLabel: "Report exposure",
            columns: [col("staff_name", "Staff"), col("exposure_type", "Type"), col("occurred_at", "When"), col("pep_given", "PEP"), { key: "status", label: "Status" }, { key: "followups", label: "Follow-ups", render: (r) => (r.followups ?? []).map((f: any) => `${f.label}: ${f.done ? "✓" : f.due}`).join(" · ") }],
            fields: [userField("staff", "Staff member", true), { key: "exposure_type", label: "Type", type: "select", options: opts("needlestick", "splash", "airborne", "other"), required: true },
              { key: "occurred_at", label: "When", type: "datetime" }, { key: "location", label: "Location" }, patientField(false),
              { key: "source_status", label: "Source status (JSON)", type: "json", placeholder: '{"hiv": "neg", "hbsag": "unknown"}' }, { key: "staff_hbv_vaccinated", label: "Staff HBV vaccinated", type: "boolean" },
              { key: "pep_given", label: "PEP given", type: "boolean" }, { key: "pep_details", label: "PEP details" }, { key: "description", label: "Description", type: "textarea" }],
          },
        },
        {
          key: "hh",
          label: "Hand hygiene",
          resource: {
            title: "Hand hygiene audits (WHO 5 moments)", endpoint: "/infection-control/hand-hygiene-audits/", createLabel: "Record audit",
            columns: [col("audit_date", "Date"), col("ward", "Ward"), col("staff_category", "Staff"), col("opportunities", "Opportunities"), col("compliant", "Compliant"),
              { key: "pct", label: "Compliance", render: (r) => (r.opportunities ? `${Math.round((r.compliant * 100) / r.opportunities)}%` : "—") }],
            fields: [{ key: "audit_date", label: "Date", type: "date" }, { key: "ward", label: "Ward", required: true }, { key: "staff_category", label: "Staff category" },
              { key: "opportunities", label: "Opportunities observed", type: "number", required: true }, { key: "compliant", label: "Compliant", type: "number", required: true }],
          },
        },
      ]}
    />
  )
}
