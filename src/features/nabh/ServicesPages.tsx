import { ModuleHub } from "../../components/resource/ModuleHub"
import { StatusPill } from "../../components/resource/ResourceTable"
import { admissionField, col, doctorField, opts, patientCol, patientField, userField } from "./fields"

export function SupportServicesPage() {
  return (
    <ModuleHub
      title="Support Services"
      subtitle="Ambulance (with live vitals to ED), CSSD sterilisation traceability, housekeeping and biomedical equipment maintenance"
      tabs={[
        {
          key: "incoming",
          label: "Incoming ambulances",
          resource: {
            title: "Heading to the ED", endpoint: "/support-services/ambulance-trips/incoming/", searchable: false,
            description: "Live position and the latest vitals transmitted from the vehicle (COP.4.c).",
            columns: [col("vehicle_number", "Vehicle"), col("patient_name", "Patient"), col("chief_complaint", "Complaint"), { key: "status", label: "Status" }, col("eta_minutes", "ETA (min)"),
              { key: "latest_vitals", label: "Latest vitals", render: (r) => (r.latest_vitals ? `HR ${r.latest_vitals.heart_rate ?? "—"} · SpO₂ ${r.latest_vitals.spo2 ?? "—"} · BP ${r.latest_vitals.bp_systolic ?? "—"}/${r.latest_vitals.bp_diastolic ?? "—"} · GCS ${r.latest_vitals.gcs ?? "—"}` : "—") }],
          },
        },
        {
          key: "trips",
          label: "Ambulance trips",
          resource: {
            title: "Ambulance trips", endpoint: "/support-services/ambulance-trips/", createLabel: "New trip",
            columns: [col("requested_at", "Requested"), col("vehicle_number", "Vehicle"), col("patient_name", "Patient"), col("pickup_address", "Pickup"), col("trip_type", "Type"), { key: "status", label: "Status" }],
            fields: [{ key: "ambulance", label: "Ambulance", type: "fk", source: "/support-services/ambulances/?status=available", sourceLabel: "vehicle_number", required: true }, patientField(false),
              { key: "caller_name", label: "Caller" }, { key: "caller_phone", label: "Caller phone" }, { key: "pickup_address", label: "Pickup address", type: "textarea", required: true },
              { key: "chief_complaint", label: "Chief complaint" }, { key: "trip_type", label: "Type", type: "select", options: opts("emergency", "inter_facility", "discharge", "planned"), defaultValue: "emergency" }],
            actions: [
              { label: "Dispatch", path: "transition/dispatch/", tone: "primary", show: (r) => r.status === "requested" },
              { label: "At scene", path: "transition/at_scene/", show: (r) => r.status === "dispatched" },
              { label: "Leave scene", path: "transition/depart_scene/", show: (r) => r.status === "at_scene" },
              { label: "Arrived (open ED visit)", path: "transition/arrive/", tone: "primary", show: (r) => r.status === "en_route" },
              { label: "Complete", path: "transition/complete/", show: (r) => r.status === "arrived" },
              { label: "Log vitals", path: "vitals/", show: (r) => ["dispatched", "at_scene", "en_route"].includes(r.status),
                prompt: [{ key: "heart_rate", label: "HR", type: "number" }, { key: "spo2", label: "SpO₂", type: "number" }, { key: "bp_systolic", label: "SBP", type: "number" },
                  { key: "bp_diastolic", label: "DBP", type: "number" }, { key: "respiratory_rate", label: "RR", type: "number" }, { key: "gcs", label: "GCS", type: "number" }, { key: "interventions", label: "Interventions", type: "textarea" }] },
            ],
          },
        },
        {
          key: "fleet",
          label: "Fleet",
          resource: {
            title: "Ambulances", endpoint: "/support-services/ambulances/", createLabel: "Add ambulance",
            columns: [col("vehicle_number", "Vehicle"), col("kind", "Kind"), col("driver_name", "Driver"), col("fitness_valid_until", "Fitness till"), { key: "status", label: "Status" }],
            fields: [{ key: "vehicle_number", label: "Vehicle no.", required: true }, { key: "kind", label: "Kind", type: "select", options: opts("bls", "als", "transport", "neonatal"), defaultValue: "bls" },
              { key: "driver_name", label: "Driver" }, { key: "driver_phone", label: "Driver phone" }, { key: "fitness_valid_until", label: "Fitness valid until", type: "date" }],
            actions: [{ label: "Device token", path: "rotate_device_token/", confirm: "Issue a new device token for the in-vehicle monitor?" }],
          },
        },
        {
          key: "cssd-cycles",
          label: "CSSD cycles",
          resource: {
            title: "Sterilisation cycles", endpoint: "/support-services/sterilization-cycles/", createLabel: "Start cycle",
            description: "A failed biological/chemical indicator automatically recalls every pack from that load.",
            columns: [col("cycle_number", "Cycle"), col("sterilizer", "Sterilizer"), col("method", "Method"), col("started_at", "Started"), { key: "result", label: "Result" }],
            fields: [{ key: "cycle_number", label: "Cycle no.", required: true }, { key: "sterilizer", label: "Sterilizer", required: true }, { key: "method", label: "Method", type: "select", options: opts("steam", "eto", "plasma", "dry_heat"), defaultValue: "steam" },
              { key: "temperature_c", label: "Temp °C", type: "number" }, { key: "pressure_kpa", label: "Pressure kPa", type: "number" }, { key: "exposure_minutes", label: "Exposure min", type: "number" }],
            actions: [{ label: "Record indicators", path: "", method: "patch", prompt: [{ key: "bowie_dick_passed", label: "Bowie-Dick passed", type: "boolean" }, { key: "chemical_indicator_passed", label: "Chemical indicator passed", type: "boolean" }, { key: "biological_indicator_passed", label: "Biological indicator passed", type: "boolean" }], show: (r) => r.result === "pending" }],
          },
        },
        {
          key: "cssd-packs",
          label: "CSSD packs",
          resource: {
            title: "Sterile packs", endpoint: "/support-services/sterile-batches/", createLabel: "Create pack",
            columns: [col("batch_label", "Pack"), col("set_name", "Set"), { key: "cycle_result", label: "Cycle" }, col("expires_on", "Expires"), { key: "status", label: "Status" }, col("issued_to", "Issued to")],
            fields: [{ key: "instrument_set", label: "Instrument set", type: "fk", source: "/support-services/instrument-sets/", required: true }, { key: "cycle", label: "Cycle", type: "fk", source: "/support-services/sterilization-cycles/", sourceLabel: "cycle_number", required: true }],
            actions: [
              { label: "Issue", path: "issue/", tone: "primary", prompt: [{ key: "issued_to", label: "Issued to (OT / ward)", required: true }], show: (r) => r.status === "sterile" },
              { label: "Used on patient", path: "use/", prompt: [patientField(false)], show: (r) => r.status === "issued" },
              { label: "Return", path: "return/", prompt: [{ key: "count_ok", label: "Instrument count correct", type: "boolean" }, { key: "remarks", label: "Remarks" }], show: (r) => ["issued", "used"].includes(r.status) },
            ],
          },
        },
        {
          key: "cssd-sets",
          label: "Instrument sets",
          resource: {
            title: "Instrument sets", endpoint: "/support-services/instrument-sets/", createLabel: "New set",
            columns: [col("code", "Code"), col("name", "Name"), col("department", "Dept"), col("sterilisation_method", "Method"), col("shelf_life_days", "Shelf life")],
            fields: [{ key: "code", label: "Code", required: true }, { key: "name", label: "Name", required: true }, { key: "department", label: "Department" },
              { key: "items", label: "Items (JSON)", type: "json", placeholder: '[{"name": "Artery forceps", "count": 6}]' }, { key: "shelf_life_days", label: "Shelf life (days)", type: "number", defaultValue: 30 }],
          },
        },
        {
          key: "housekeeping",
          label: "Housekeeping",
          resource: {
            title: "Housekeeping tasks", endpoint: "/support-services/housekeeping-tasks/", createLabel: "New task",
            description: "Terminal-cleaning tasks are raised automatically when a patient is discharged.",
            filters: [{ key: "status", label: "Status", type: "select", options: opts("pending", "in_progress", "done", "verified") }],
            columns: [col("task_type", "Task"), col("location", "Location"), col("priority", "Priority"), col("assigned_to_name", "Assigned"), col("due_by", "Due"), { key: "status", label: "Status" }],
            fields: [{ key: "task_type", label: "Task", type: "select", options: opts("routine", "terminal", "spill", "isolation", "linen", "waste", "pest"), required: true }, { key: "location", label: "Location", required: true },
              { key: "priority", label: "Priority", type: "select", options: opts("low", "normal", "high", "stat"), defaultValue: "normal" }, userField("assigned_to", "Assign to"), { key: "due_by", label: "Due by", type: "datetime" }],
            actions: [
              { label: "Start", path: "start/", show: (r) => r.status === "pending" },
              { label: "Done", path: "complete/", tone: "primary", prompt: [{ key: "waste_bags", label: "BMW bags (JSON)", type: "json", placeholder: '{"yellow": 2, "red": 1}' }], show: (r) => r.status === "in_progress" },
              { label: "Verify", path: "verify/", show: (r) => r.status === "done" },
            ],
          },
        },
        {
          key: "equipment",
          label: "Equipment",
          resource: {
            title: "Biomedical equipment register", endpoint: "/support-services/equipment/", createLabel: "Add asset",
            columns: [col("asset_tag", "Tag"), col("name", "Name"), col("location", "Location"), col("next_pm_due", "Next PM"), col("next_calibration_due", "Calibration"), col("amc_until", "AMC till"), { key: "status", label: "Status" },
              { key: "is_critical", label: "Critical", render: (r) => (r.is_critical ? <StatusPill value="critical" /> : "") }],
            fields: [{ key: "asset_tag", label: "Asset tag", required: true }, { key: "name", label: "Name", required: true }, { key: "category", label: "Category" }, { key: "make", label: "Make" }, { key: "model_number", label: "Model" },
              { key: "serial_number", label: "Serial" }, { key: "location", label: "Location" }, { key: "purchase_date", label: "Purchased", type: "date" }, { key: "warranty_until", label: "Warranty till", type: "date" },
              { key: "amc_vendor", label: "AMC vendor" }, { key: "amc_until", label: "AMC till", type: "date" }, { key: "pm_frequency_days", label: "PM every (days)", type: "number", defaultValue: 180 },
              { key: "calibration_frequency_days", label: "Calibration every (days)", type: "number" }, { key: "is_critical", label: "Life-support / critical", type: "boolean" }],
            toolbar: [{ label: "Due in 30 days", path: "due/", method: "get" }],
          },
        },
        {
          key: "maintenance",
          label: "Maintenance",
          resource: {
            title: "Maintenance & breakdowns", endpoint: "/support-services/maintenance/", createLabel: "Log job",
            columns: [col("asset_name", "Asset"), col("kind", "Kind"), col("problem", "Problem"), col("reported_at", "Reported"), col("downtime_hours", "Downtime h"), { key: "status", label: "Status" }],
            fields: [{ key: "asset", label: "Asset", type: "fk", source: "/support-services/equipment/", required: true }, { key: "kind", label: "Kind", type: "select", options: opts("preventive", "breakdown", "calibration", "installation"), required: true },
              { key: "problem", label: "Problem", type: "textarea" }, { key: "engineer", label: "Engineer" }, { key: "cost", label: "Cost", type: "number" }],
            actions: [{ label: "Close", path: "close/", tone: "primary", prompt: [{ key: "work_done", label: "Work done", type: "textarea", required: true }], show: (r) => r.status !== "closed" }],
          },
        },
      ]}
    />
  )
}

export function QueuePage() {
  return (
    <ModuleHub
      title="Queue & Token Management"
      subtitle="NABH AAC.2.h/i — tokens for every counter, priority handling, waiting-time estimates and TV display boards"
      tabs={[
        {
          key: "points",
          label: "Counters",
          resource: {
            title: "Service points", endpoint: "/queue/service-points/", createLabel: "Add counter",
            columns: [col("name", "Counter"), col("kind", "Kind"), col("counter_label", "Display label"), col("token_prefix", "Prefix"), col("doctor_name", "Doctor")],
            fields: [{ key: "name", label: "Name", required: true }, { key: "kind", label: "Kind", type: "select", required: true, options: opts("registration", "consultation", "billing", "lab", "radiology", "pharmacy", "vaccination", "other") },
              { key: "counter_label", label: "Display label (e.g. Counter 3)" }, { key: "token_prefix", label: "Token prefix", defaultValue: "A" }, doctorField("doctor", "Doctor (consultation queues)", false),
              { key: "default_service_minutes", label: "Avg service minutes", type: "number", defaultValue: 5 }],
            actions: [{ label: "Call next", path: "call_next/", tone: "primary" }, { label: "Board", path: "board/", method: "get" }],
          },
        },
        {
          key: "tokens",
          label: "Today's tokens",
          resource: {
            title: "Tokens", endpoint: "/queue/tokens/", createLabel: "Issue token", searchable: false,
            filters: [{ key: "status", label: "Status", type: "select", options: opts("waiting", "called", "serving", "done", "skipped") }],
            columns: [col("label", "Token"), col("service_point_name", "Counter"), col("patient_name", "Patient"), col("visitor_name", "Visitor"), { key: "priority", label: "Priority", render: (r) => (r.priority ? "★" : "") }, { key: "status", label: "Status" },
              { key: "wait", label: "Est. wait", render: (r) => (r.wait ? `${r.wait.estimated_minutes} min (${r.wait.ahead} ahead)` : "—") }],
            fields: [{ key: "service_point", label: "Counter", type: "fk", source: "/queue/service-points/", required: true }, patientField(false), { key: "visitor_name", label: "Name (walk-in)" },
              { key: "priority", label: "Priority (senior / differently-abled / emergency)", type: "boolean" }],
            actions: [
              { label: "Start", path: "start/", show: (r) => r.status === "called" },
              { label: "Done", path: "complete/", tone: "primary", show: (r) => ["called", "serving"].includes(r.status) },
              { label: "Recall", path: "recall/", show: (r) => ["called", "skipped"].includes(r.status) },
              { label: "Skip", path: "skip/", tone: "danger", show: (r) => ["waiting", "called"].includes(r.status) },
            ],
          },
        },
        {
          key: "displays",
          label: "Display screens",
          resource: {
            title: "TV / kiosk displays", endpoint: "/queue/displays/", createLabel: "New display",
            description: "Open the display link on the TV browser — it needs no login and shows token numbers only (no patient names).",
            columns: [col("name", "Display"), { key: "key", label: "Screen link", render: (r) => <a className="text-emerald-700 underline" href={`/display/${r.key}`} target="_blank" rel="noreferrer">/display/{String(r.key).slice(0, 8)}…</a> }, col("announcement", "Announcement")],
            fields: [{ key: "name", label: "Name", required: true }, { key: "service_points", label: "Counters shown", type: "multifk", source: "/queue/service-points/" }, { key: "announcement", label: "Scrolling announcement" }],
          },
        },
      ]}
    />
  )
}

export function TelemedicinePage() {
  return (
    <ModuleHub
      title="Telemedicine"
      subtitle="NABH COP.10.a — video consultations with teleconsultation consent, patient join links and e-prescription"
      tabs={[
        {
          key: "today",
          label: "Consultations",
          resource: {
            title: "Video consultations", endpoint: "/telemedicine/consultations/", createLabel: "Schedule consultation",
            filters: [{ key: "status", label: "Status", type: "select", options: opts("scheduled", "waiting", "in_progress", "completed", "cancelled") }],
            columns: [col("scheduled_at", "When"), patientCol, col("doctor_name", "Doctor"), col("mode", "Mode"), { key: "status", label: "Status" }, col("consent_given", "Consent"), col("wait_minutes", "Wait (min)")],
            fields: [patientField(), doctorField(), { key: "scheduled_at", label: "When", type: "datetime", required: true }, { key: "duration_minutes", label: "Minutes", type: "number", defaultValue: 15 },
              { key: "mode", label: "Mode", type: "select", options: opts("video", "audio", "chat"), defaultValue: "video" }, { key: "reason", label: "Reason" }, { key: "is_follow_up", label: "Follow-up", type: "boolean" },
              { key: "fee", label: "Fee", type: "number" }],
            actions: [
              { label: "Send link to patient", path: "send_link/", show: (r) => ["scheduled", "waiting"].includes(r.status) },
              { label: "Join video", path: "doctor_join/", tone: "primary", openUrlFrom: "join_url", show: (r) => !["completed", "cancelled"].includes(r.status) },
              { label: "Complete", path: "complete/", prompt: [{ key: "clinical_notes", label: "Clinical notes", type: "textarea", required: true }, { key: "prescription", label: "e-Prescription", type: "fk", source: "/prescriptions/", sourceLabel: (r) => `#${r.id} ${r.patient_name ?? ""} ${r.diagnosis ?? ""}` }], show: (r) => r.status === "in_progress" },
              { label: "Cancel", path: "cancel/", tone: "danger", confirm: "Cancel this consultation?", show: (r) => ["scheduled", "waiting"].includes(r.status) },
            ],
          },
        },
      ]}
    />
  )
}

export function MRDPage() {
  return (
    <ModuleHub
      title="Medical Records (MRD)"
      subtitle="Case-file tracking, ICD-10 coding, completeness audit and retention (IMS.1.e)"
      tabs={[
        {
          key: "files",
          label: "Case files",
          resource: {
            title: "Medical record files", endpoint: "/mrd/files/", createLabel: "Open file",
            description: "A file is opened automatically on discharge; MLC files are retained 10 years, others 3.",
            filters: [{ key: "status", label: "Status", type: "select", options: opts("pending", "in_mrd", "issued", "archived", "destroyed", "missing") }],
            columns: [col("file_number", "File no."), patientCol, col("rack_location", "Rack"), { key: "status", label: "Status" }, col("is_mlc", "MLC"), col("retention_until", "Retain until")],
            fields: [patientField(), admissionField(), { key: "is_mlc", label: "Medico-legal case", type: "boolean" }, { key: "rack_location", label: "Rack location" }],
            actions: [
              { label: "Receive", path: "receive/", prompt: [{ key: "rack_location", label: "Rack location" }], show: (r) => r.status === "pending" },
              { label: "Issue", path: "issue/", prompt: [{ key: "issued_to", label: "Issued to", required: true }, { key: "department", label: "Department" }, { key: "purpose", label: "Purpose", required: true }, { key: "due_back", label: "Due back", type: "date" }], show: (r) => r.status === "in_mrd" },
              { label: "Return", path: "return_file/", show: (r) => r.status === "issued" },
              { label: "Audit", path: "audit/", method: "post" },
            ],
            toolbar: [{ label: "Overdue files", path: "overdue/", method: "get" }, { label: "Due for destruction", path: "due_for_destruction/", method: "get" }],
          },
        },
        {
          key: "coding",
          label: "ICD-10 coding",
          resource: {
            title: "Discharge coding", endpoint: "/mrd/coding/", createLabel: "Code discharge",
            columns: [col("admission", "Admission"), col("principal_code", "Principal ICD-10"), col("principal_title", "Diagnosis"), col("verified_at", "Verified")],
            fields: [admissionField(true), { key: "principal_diagnosis", label: "Principal diagnosis", type: "fk", source: "/mrd/icd10/", sourceLabel: (r) => `${r.code} ${r.title}`, required: true },
              { key: "secondary_diagnoses", label: "Secondary diagnoses", type: "multifk", source: "/mrd/icd10/", sourceLabel: (r) => `${r.code} ${r.title}` },
              { key: "procedures", label: "Procedures (JSON)", type: "json", placeholder: '[{"code": "0DTJ4ZZ", "description": "Laparoscopic appendectomy"}]' }],
            actions: [{ label: "Verify", path: "verify/", tone: "primary", show: (r) => !r.verified_at }],
            toolbar: [{ label: "Morbidity statistics", path: "morbidity/", method: "get" }],
          },
        },
        {
          key: "icd",
          label: "ICD-10 browser",
          resource: { title: "ICD-10 codes", endpoint: "/mrd/icd10/", columns: [col("code", "Code"), col("title", "Title"), col("chapter", "Chapter"), col("snomed_code", "SNOMED CT")] },
        },
      ]}
    />
  )
}

export function DietaryPage() {
  return (
    <ModuleHub
      title="Dietary & Kitchen"
      subtitle="NABH COP.7 — nutritional screening, dietitian consultation, therapeutic diet orders and meal service"
      tabs={[
        {
          key: "orders",
          label: "Diet orders",
          resource: {
            title: "Diet orders", endpoint: "/dietary/orders/", createLabel: "Order diet",
            description: "One active order per admission; food allergies are copied from the patient's allergy list.",
            filters: [{ key: "status", label: "Status", type: "select", options: opts("active", "npo", "stopped") }],
            columns: [patientCol, col("ward", "Ward"), col("bed", "Bed"), col("diet_name", "Diet"), col("texture", "Texture"), col("food_allergies", "Allergies"), { key: "status", label: "Status" }],
            fields: [patientField(), admissionField(true), { key: "diet_type", label: "Diet", type: "fk", source: "/dietary/diet-types/", required: true },
              { key: "texture", label: "Texture", type: "select", options: opts("regular", "soft", "minced", "pureed", "liquid", "rt_feed"), defaultValue: "regular" },
              { key: "preference", label: "Preference", type: "select", options: opts("veg", "non_veg", "eggetarian", "jain", "vegan") }, { key: "calories", label: "Calories", type: "number" },
              { key: "protein_g", label: "Protein g", type: "number" }, { key: "fluid_restriction_ml", label: "Fluid restriction ml", type: "number" },
              { key: "status", label: "Status", type: "select", options: opts("active", "npo"), defaultValue: "active" }, { key: "instructions", label: "Instructions", type: "textarea" }],
          },
        },
        {
          key: "meals",
          label: "Kitchen trays",
          resource: {
            title: "Meal service", endpoint: "/dietary/meals/", searchable: false,
            filters: [{ key: "meal", label: "Meal", type: "select", options: opts("early_morning", "breakfast", "mid_morning", "lunch", "evening", "dinner", "bedtime") }, { key: "service_date", label: "Date", type: "date" }],
            columns: [col("ward", "Ward"), col("bed", "Bed"), col("patient_name", "Patient"), col("diet_name", "Diet"), col("texture", "Texture"), col("items", "Items"), col("food_allergies", "Allergies"), { key: "status", label: "Status" }],
            toolbar: [{ label: "Generate trays", path: "generate/", method: "post", prompt: [{ key: "meal", label: "Meal", type: "select", required: true, options: opts("early_morning", "breakfast", "mid_morning", "lunch", "evening", "dinner", "bedtime") }, { key: "date", label: "Date", type: "date" }] },
              { label: "Kitchen summary", path: "kitchen_summary/", method: "get" }],
            actions: [
              { label: "Delivered", path: "deliver/", tone: "primary", prompt: [{ key: "consumption_pct", label: "% consumed", type: "number" }, { key: "remarks", label: "Remarks" }], show: (r) => ["planned", "prepared"].includes(r.status) },
              { label: "Refused", path: "deliver/", prompt: [{ key: "refused", label: "Refused", type: "boolean", defaultValue: true }, { key: "remarks", label: "Reason" }], show: (r) => ["planned", "prepared"].includes(r.status) },
            ],
          },
        },
        {
          key: "consults",
          label: "Dietitian consultations",
          resource: {
            title: "Dietitian consultations", endpoint: "/dietary/consultations/", createLabel: "New consultation",
            columns: [patientCol, col("bmi", "BMI"), col("nutritional_risk", "Risk"), col("plan", "Plan"), col("follow_up_on", "Follow-up")],
            fields: [patientField(), admissionField(), { key: "height_cm", label: "Height cm", type: "number" }, { key: "weight_kg", label: "Weight kg", type: "number" },
              { key: "nutritional_risk", label: "Nutritional risk", type: "select", options: opts("low", "moderate", "high") }, { key: "assessment", label: "Assessment", type: "textarea", required: true },
              { key: "plan", label: "Plan", type: "textarea", required: true }, { key: "follow_up_on", label: "Follow-up on", type: "date" }],
          },
        },
        {
          key: "menu",
          label: "Menu",
          resource: {
            title: "Menu by diet & meal", endpoint: "/dietary/menu/", createLabel: "Add menu item",
            columns: [col("diet_name", "Diet"), col("meal", "Meal"), col("weekday", "Weekday"), col("items", "Items"), col("calories", "kcal")],
            fields: [{ key: "diet_type", label: "Diet", type: "fk", source: "/dietary/diet-types/", required: true }, { key: "meal", label: "Meal", type: "select", required: true, options: opts("early_morning", "breakfast", "mid_morning", "lunch", "evening", "dinner", "bedtime") },
              { key: "weekday", label: "Weekday (0=Mon, blank=daily)", type: "number" }, { key: "items", label: "Items", required: true }, { key: "calories", label: "kcal", type: "number" }, { key: "is_veg", label: "Veg", type: "boolean", defaultValue: true }],
          },
        },
        { key: "types", label: "Diet types", resource: { title: "Diet types", endpoint: "/dietary/diet-types/", createLabel: "New diet type", columns: [col("code", "Code"), col("name", "Name"), col("default_calories", "kcal"), col("is_therapeutic", "Therapeutic")], fields: [{ key: "name", label: "Name", required: true }, { key: "code", label: "Code", required: true }, { key: "default_calories", label: "Default kcal", type: "number" }, { key: "is_therapeutic", label: "Therapeutic", type: "boolean", defaultValue: true }, { key: "description", label: "Description", type: "textarea" }] } },
      ]}
    />
  )
}
