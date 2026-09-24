import { ModuleHub } from "../../components/resource/ModuleHub"
import { admissionField, col, opts, patientCol, patientField, userField } from "./fields"
import { BedBoard } from "./BedBoard"

const caseField = { key: "case", label: "Cancer case", type: "fk" as const, source: "/oncology/cases/", sourceLabel: (r: any) => `#${r.id} ${r.patient_name} — ${r.primary_site} ${r.tnm ?? ""}`, required: true }

export function OncologyPage() {
  return (
    <ModuleHub
      title="Oncology"
      subtitle="NABH oncology annexure — TNM staging, chemotherapy with BSA dosing & double-check, radiotherapy, tumour boards, clinical trials, BMT"
      tabs={[
        {
          key: "cases",
          label: "Cancer cases",
          resource: {
            title: "Cancer registry", endpoint: "/oncology/cases/", createLabel: "Register case",
            columns: [patientCol, col("primary_site", "Site"), col("icdo3_topography", "ICD-O-3"), col("histology", "Histology"), col("tnm", "TNM"), col("stage_group", "Stage"), col("treatment_intent", "Intent"), { key: "status", label: "Status" }],
            fields: [patientField(), { key: "primary_site", label: "Primary site", required: true }, { key: "laterality", label: "Laterality", type: "select", options: opts("left", "right", "bilateral", "na") },
              { key: "icd10_code", label: "ICD-10" }, { key: "icdo3_topography", label: "ICD-O-3 topography" }, { key: "icdo3_morphology", label: "ICD-O-3 morphology" }, { key: "histology", label: "Histology" },
              { key: "diagnosis_date", label: "Diagnosed on", type: "date" }, { key: "basis_of_diagnosis", label: "Basis", type: "select", options: opts("clinical", "imaging", "cytology", "histopathology", "molecular"), defaultValue: "histopathology" },
              { key: "t_stage", label: "T" }, { key: "n_stage", label: "N" }, { key: "m_stage", label: "M" }, { key: "stage_group", label: "Stage group" }, { key: "ecog", label: "ECOG", type: "number" },
              { key: "biomarkers", label: "Biomarkers (JSON)", type: "json", placeholder: '{"ER": "+", "HER2": "3+"}' }, { key: "treatment_intent", label: "Intent", type: "select", options: opts("curative", "palliative"), defaultValue: "curative" }],
            actions: [
              { label: "Case summary", path: "summary/", method: "get" },
              { label: "Record death", path: "record_death/", tone: "danger", prompt: [{ key: "date_of_death", label: "Date of death", type: "date", required: true }, { key: "cause_of_death", label: "Cause", required: true }, { key: "modality", label: "Related modality (if within 30 days)", type: "select", options: opts("surgery", "chemotherapy", "radiotherapy") }], show: (r) => r.status !== "deceased" },
            ],
            toolbar: [{ label: "Registry statistics", path: "registry/", method: "get" }],
          },
        },
        {
          key: "chemo",
          label: "Chemotherapy",
          resource: {
            title: "Chemotherapy cycles", endpoint: "/oncology/chemo-cycles/", createLabel: "Plan cycle",
            description: "Doses are calculated from BSA (Mosteller); a second clinician must verify before administration; low counts block administration.",
            columns: [col("patient_name", "Patient"), col("protocol_name", "Protocol"), col("cycle_number", "Cycle"), col("indication", "Indication"), col("planned_on", "Planned"), col("bsa", "BSA"),
              { key: "calculated_doses", label: "Doses", render: (r) => (r.calculated_doses ?? []).map((d: any) => `${d.drug} ${d.calculated_mg} mg`).join(", ") }, { key: "status", label: "Status" }],
            fields: [caseField, { key: "protocol", label: "Protocol", type: "fk", source: "/oncology/chemo-protocols/", required: true }, { key: "cycle_number", label: "Cycle no.", type: "number", required: true },
              { key: "indication", label: "Indication", type: "select", options: opts("neoadjuvant", "adjuvant", "concurrent", "palliative", "definitive"), required: true },
              { key: "planned_on", label: "Planned on", type: "date", required: true }, { key: "height_cm", label: "Height cm", type: "number", required: true }, { key: "weight_kg", label: "Weight kg", type: "number", required: true },
              { key: "dose_reduction_pct", label: "Dose reduction %", type: "number", defaultValue: 0 }, { key: "pre_chemo_labs", label: "Pre-chemo labs (JSON)", type: "json", placeholder: '{"ANC": 2.1, "platelets": 180}' }],
            actions: [
              { label: "Verify doses", path: "verify/", tone: "primary", show: (r) => !r.verified_by },
              { label: "Administer", path: "administer/", show: (r) => r.status === "planned" && r.verified_by, prompt: [{ key: "override", label: "Override low counts (document reason in notes)", type: "boolean" }] },
              { label: "Toxicity / response", path: "", method: "patch", prompt: [{ key: "toxicities", label: "Toxicities (JSON, CTCAE)", type: "json", placeholder: '[{"toxicity": "Neutropenia", "ctcae_grade": 3}]' }, { key: "response", label: "Response (CR/PR/SD/PD)" }] },
            ],
          },
        },
        {
          key: "rt",
          label: "Radiotherapy",
          resource: {
            title: "Radiotherapy plans", endpoint: "/oncology/radiotherapy/", createLabel: "New RT plan",
            columns: [col("site", "Site"), col("technique", "Technique"), col("total_dose_gy", "Dose Gy"), col("fractions", "Fr"), col("fractions_delivered", "Delivered"), col("dose_per_fraction", "Gy/fr"), col("start_date", "Start"), col("end_date", "End")],
            fields: [caseField, { key: "site", label: "Site", required: true }, { key: "technique", label: "Technique", required: true }, { key: "intent", label: "Intent", type: "select", options: opts("curative", "palliative"), required: true },
              { key: "total_dose_gy", label: "Total dose Gy", type: "number", required: true }, { key: "fractions", label: "Fractions", type: "number", required: true }, { key: "simulation_date", label: "Simulation", type: "date" },
              { key: "positioning", label: "Positioning" }, { key: "immobilisation", label: "Immobilisation" }, { key: "ct_scan_details", label: "Planning CT details", type: "textarea" }],
            actions: [{ label: "Deliver fraction", path: "deliver_fraction/", tone: "primary", show: (r) => (r.fractions_delivered ?? 0) < r.fractions }],
          },
        },
        {
          key: "boards",
          label: "Tumour boards",
          resource: {
            title: "Multidisciplinary tumour boards", endpoint: "/oncology/tumor-boards/", createLabel: "Schedule board",
            columns: [col("board_id", "Board ID"), col("scheduled_at", "When"), col("location", "Where"), { key: "status", label: "Status" }, { key: "patients", label: "Cases", render: (r) => (r.patients ?? []).map((p: any) => `${p.patient} (${p.site} ${p.tnm})`).join("; ") }],
            fields: [{ key: "title", label: "Title", defaultValue: "Multidisciplinary Tumour Board" }, { key: "scheduled_at", label: "When", type: "datetime", required: true }, { key: "location", label: "Room / video link" },
              { key: "members", label: "Members (notified)", type: "multifk", source: "/users/", sourceLabel: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""} ${r.email}` }],
            actions: [
              { label: "Add case", path: "add_case/", prompt: [caseField, { key: "question", label: "Question for the board", type: "textarea" }] },
              { label: "Record decision", path: "record_decision/", tone: "primary", prompt: [caseField, { key: "discussion_summary", label: "Discussion summary", type: "textarea" }, { key: "recommendation", label: "Recommendation", type: "textarea", required: true }, { key: "treatment_plan", label: "Treatment plan" }, { key: "follow_up", label: "Follow-up", type: "textarea" }] },
              { label: "Attendance", path: "record_attendance/", prompt: [{ key: "attendees", label: "Attendees (JSON)", type: "json", required: true, placeholder: '[{"member": 3, "specialty": "Medical oncology", "designation": "Consultant", "role": "Chair"}]' }] },
              { label: "Remind", path: "remind/" },
            ],
          },
        },
        {
          key: "trials",
          label: "Clinical trials",
          resource: {
            title: "Clinical & research trials", endpoint: "/oncology/trials/", createLabel: "Register trial",
            columns: [col("trial_id", "CTRI no."), col("title", "Title"), col("phase", "Phase"), col("arms", "Arms"), col("ip_stock", "IP stock"), { key: "status", label: "Status" }],
            fields: [{ key: "trial_id", label: "CTRI no.", required: true }, { key: "title", label: "Title", required: true }, { key: "phase", label: "Phase" }, { key: "sponsor", label: "Sponsor" },
              userField("principal_investigator", "Principal investigator"), { key: "arms", label: "Arms (JSON)", type: "json", placeholder: '["Arm A", "Arm B"]' }, { key: "ethics_approval_ref", label: "Ethics approval ref" },
              { key: "investigational_product", label: "Investigational product" }, { key: "ip_stock", label: "IP stock", type: "number", defaultValue: 0 }],
          },
        },
        {
          key: "enrol",
          label: "Trial enrolment",
          resource: {
            title: "Trial subjects", endpoint: "/oncology/trial-enrollments/", createLabel: "Enrol patient",
            description: "Needs a granted research consent; the arm is randomised on enrolment.",
            columns: [col("subject_id", "Subject"), col("trial_code", "Trial"), col("patient_name", "Patient"), col("arm", "Arm"), col("ip_dispensed", "IP dispensed"), { key: "status", label: "Status" }],
            fields: [{ key: "trial", label: "Trial", type: "fk", source: "/oncology/trials/", sourceLabel: "trial_id", required: true }, patientField(),
              { key: "consent", label: "Research consent", type: "fk", source: "/clinical/consents/?consent_type=research", sourceLabel: (r) => `#${r.id} ${r.patient_name}`, required: true }],
            actions: [
              { label: "Adverse event", path: "adverse_event/", tone: "danger", prompt: [{ key: "event", label: "Event", required: true }, { key: "ctcae_grade", label: "CTCAE grade", type: "number" }, { key: "serious", label: "Serious (SAE)", type: "boolean" }] },
              { label: "Dispense IP", path: "dispense_ip/", prompt: [{ key: "quantity", label: "Quantity", type: "number", defaultValue: 1 }] },
            ],
          },
        },
        {
          key: "bmt",
          label: "Bone marrow transplant",
          resource: {
            title: "BMT (donor & recipient)", endpoint: "/oncology/bmt/", createLabel: "New transplant",
            columns: [col("recipient_name", "Recipient"), col("kind", "Type"), col("donor_relation", "Donor"), col("hla_match", "HLA"), col("transplant_date", "Transplant"), col("neutrophil_engraftment_date", "Engraftment"), { key: "status", label: "Status" }],
            fields: [{ ...patientField(), key: "recipient", label: "Recipient" }, { key: "kind", label: "Type", type: "select", options: opts("autologous", "allogeneic"), required: true },
              { ...patientField(false), key: "donor", label: "Donor (allogeneic)" }, { key: "donor_relation", label: "Donor relation" }, { key: "hla_match", label: "HLA match" },
              { key: "stem_cell_source", label: "Stem cell source" }, { key: "conditioning_regimen", label: "Conditioning" }, { key: "committee_approval_ref", label: "Transplant committee approval" }, { key: "transplant_date", label: "Transplant date", type: "date" }],
          },
        },
        { key: "protocols", label: "Protocols", resource: { title: "Chemotherapy protocols", endpoint: "/oncology/chemo-protocols/", createLabel: "New protocol", columns: [col("name", "Protocol"), col("indication", "Indication"), col("cycle_length_days", "Cycle days"), col("planned_cycles", "Cycles"), { key: "drugs", label: "Drugs", render: (r) => (r.drugs ?? []).map((d: any) => `${d.drug} ${d.dose}${d.unit}`).join(", ") }], fields: [{ key: "name", label: "Name", required: true }, { key: "indication", label: "Indication" }, { key: "drugs", label: "Drugs (JSON)", type: "json", required: true, placeholder: '[{"drug": "Paclitaxel", "dose": 80, "unit": "mg/m2", "route": "IV", "day": 1}]' }, { key: "cycle_length_days", label: "Cycle length (days)", type: "number", defaultValue: 21 }, { key: "planned_cycles", label: "Planned cycles", type: "number", defaultValue: 6 }, { key: "premedications", label: "Premedications", type: "textarea" }] } },
      ]}
    />
  )
}

export function AccountsPage() {
  return (
    <ModuleHub
      title="Accounts, Tariff & Insurance"
      subtitle="NABH FPM.2–4 — payables with 3-way match, double-entry ledger, Tally export, GST reports, tariff, insurance & claim reconciliation"
      tabs={[
        {
          key: "invoices",
          label: "Vendor invoices",
          resource: {
            title: "Vendor invoices", endpoint: "/finance/vendor-invoices/", createLabel: "Record invoice",
            filters: [{ key: "status", label: "Status", type: "select", options: opts("received", "matched", "mismatch", "approved", "partially_paid", "paid", "disputed") }],
            columns: [col("vendor_name", "Vendor"), col("invoice_number", "Invoice"), col("invoice_date", "Date"), col("total_amount", "Total"), col("outstanding", "Outstanding"), col("due_date", "Due"), { key: "status", label: "Status" }, col("match_notes", "3-way match")],
            fields: [{ key: "vendor", label: "Vendor", type: "fk", source: "/finance/vendors/", required: true }, { key: "purchase_order", label: "Purchase order", type: "fk", source: "/inventory/purchase-orders/", sourceLabel: "po_number" },
              { key: "invoice_number", label: "Invoice no.", required: true }, { key: "invoice_date", label: "Invoice date", type: "date" }, { key: "taxable_amount", label: "Taxable amount", type: "number", required: true }, { key: "gst_amount", label: "GST", type: "number" }],
            actions: [
              { label: "Approve", path: "approve/", tone: "primary", prompt: [{ key: "override_reason", label: "Override reason (only if 3-way match failed)" }], show: (r) => ["received", "matched", "mismatch"].includes(r.status) },
              { label: "Pay", path: "pay/", prompt: [{ key: "amount", label: "Amount (blank = full)", type: "number" }, { key: "tds_amount", label: "TDS", type: "number" }, { key: "mode", label: "Mode", type: "select", options: opts("neft", "upi", "cheque", "cash"), defaultValue: "neft" }, { key: "reference", label: "UTR / cheque no." }], show: (r) => ["approved", "partially_paid"].includes(r.status) },
            ],
            toolbar: [{ label: "Payables aging", path: "aging/", method: "get" }, { label: "Payment schedule", path: "payment_schedule/", method: "get" }],
          },
        },
        { key: "vendors", label: "Vendors", resource: { title: "Vendors", endpoint: "/finance/vendors/", createLabel: "Add vendor", columns: [col("name", "Vendor"), col("gstin", "GSTIN"), col("credit_days", "Credit days"), col("email", "Email"), col("phone", "Phone")], fields: [{ key: "name", label: "Name", required: true }, { key: "gstin", label: "GSTIN" }, { key: "pan", label: "PAN" }, { key: "state_code", label: "GST state code" }, { key: "email", label: "Email (payment advice)" }, { key: "phone", label: "Phone" }, { key: "credit_days", label: "Credit days", type: "number", defaultValue: 30 }, { key: "bank_account", label: "Bank a/c" }, { key: "ifsc", label: "IFSC" }] } },
        { key: "notes", label: "Debit / credit notes", resource: { title: "Supplier debit & credit notes", endpoint: "/finance/supplier-notes/", createLabel: "New note", columns: [col("note_number", "Note"), col("vendor_name", "Vendor"), col("kind", "Kind"), col("amount", "Amount"), col("gst_amount", "GST"), col("reason", "Reason"), col("issued_on", "Date")], fields: [{ key: "vendor", label: "Vendor", type: "fk", source: "/finance/vendors/", required: true }, { key: "invoice", label: "Against invoice", type: "fk", source: "/finance/vendor-invoices/", sourceLabel: "invoice_number" }, { key: "kind", label: "Kind", type: "select", options: opts("debit", "credit"), required: true }, { key: "amount", label: "Amount", type: "number", required: true }, { key: "gst_amount", label: "GST", type: "number" }, { key: "reason", label: "Reason", required: true }] } },
        {
          key: "ledger",
          label: "Journal & Tally",
          resource: {
            title: "Journal vouchers (auto-posted)", endpoint: "/finance/journal/", searchable: false,
            filters: [{ key: "voucher_type", label: "Voucher", type: "select", options: opts("sales", "receipt", "purchase", "payment", "debit_note", "credit_note", "journal") }],
            columns: [col("entry_date", "Date"), col("voucher_type", "Voucher"), col("voucher_number", "No."), col("party_name", "Party"), col("narration", "Narration"),
              { key: "lines", label: "Dr / Cr", render: (r) => (r.lines ?? []).map((l: any) => `${l.account}: ${l.debit ? `Dr ${l.debit}` : `Cr ${l.credit}`}`).join(" · ") }, col("exported_to_tally_at", "Tally export")],
            toolbar: [
              { label: "Tally vouchers XML", path: "../tally-export/", method: "get", download: "tally-vouchers.xml" },
              { label: "Tally ledgers XML", path: "../tally-export/?masters=1", method: "get", download: "tally-ledgers.xml" },
              { label: "Trial balance", path: "../trial-balance/", method: "get" },
              { label: "GST outward (xlsx)", path: "../gst/?export=xlsx", method: "get", download: "gst-outward.xlsx" },
              { label: "GST HSN summary (csv)", path: "../gst/?export=csv&section=hsn", method: "get", download: "gst-hsn.csv" },
              { label: "GST inward / ITC (csv)", path: "../gst/?kind=inward&export=csv", method: "get", download: "gst-inward.csv" },
            ],
          },
        },
        { key: "tariff", label: "Tariff", resource: { title: "Service tariff (rate master)", endpoint: "/finance/tariff/", createLabel: "Add service", columns: [col("code", "Code"), col("name", "Service"), col("department", "Dept"), col("rate", "Rate"), col("category_rates", "Category rates"), col("hsn_sac", "SAC/HSN"), col("gst_rate", "GST %")], fields: [{ key: "code", label: "Code", required: true }, { key: "name", label: "Name", required: true }, { key: "department", label: "Department" }, { key: "rate", label: "Base rate", type: "number", required: true }, { key: "category_rates", label: "Rates by patient category (JSON)", type: "json", placeholder: '{"private": 1500, "insurance": 1800, "corporate": 1350}' }, { key: "hsn_sac", label: "SAC / HSN", defaultValue: "9993" }, { key: "gst_rate", label: "GST %", type: "number", defaultValue: 0 }] } },
        {
          key: "insurance",
          label: "Insurance policies",
          resource: {
            title: "Patient insurance & eligibility", endpoint: "/finance/insurance-policies/", createLabel: "Add policy",
            columns: [col("patient_name", "Patient"), col("insurer", "Insurer"), col("scheme", "Scheme"), col("policy_number", "Policy"), col("sum_insured", "Sum insured"), col("balance_available", "Balance"), col("valid_to", "Valid to"), { key: "eligibility_status", label: "Eligibility" }],
            fields: [patientField(), { key: "tpa_company", label: "TPA", type: "fk", source: "/tpa/companies/" }, { key: "insurer", label: "Insurer", required: true }, { key: "scheme", label: "Scheme" }, { key: "policy_number", label: "Policy no.", required: true }, { key: "member_id", label: "Member ID" },
              { key: "sum_insured", label: "Sum insured", type: "number" }, { key: "valid_from", label: "Valid from", type: "date" }, { key: "valid_to", label: "Valid to", type: "date" }, { key: "coverage_notes", label: "Coverage / room-rent cap / co-pay", type: "textarea" }],
            actions: [{ label: "Verify eligibility", path: "verify_eligibility/", tone: "primary", prompt: [{ key: "status", label: "Result", type: "select", options: opts("eligible", "ineligible") }, { key: "balance_available", label: "Balance available", type: "number" }] }],
          },
        },
        {
          key: "settlements",
          label: "Claim settlements",
          resource: {
            title: "Payer remittances", endpoint: "/finance/claim-settlements/", createLabel: "Record settlement",
            columns: [col("claim", "Claim"), col("utr_number", "UTR"), col("amount_received", "Received"), col("tds_deducted", "TDS"), col("disallowed_amount", "Disallowed"), col("received_on", "Date"), { key: "is_reconciled", label: "Reconciled", render: (r) => (r.is_reconciled ? "Yes" : "No — review") }],
            fields: [{ key: "claim", label: "Claim", type: "fk", source: "/tpa/claims/", sourceLabel: (r) => `${r.claim_number || "#" + r.id} ${r.patient_name ?? ""}`, required: true }, { key: "utr_number", label: "UTR", required: true },
              { key: "amount_received", label: "Amount received", type: "number", required: true }, { key: "tds_deducted", label: "TDS", type: "number" }, { key: "disallowed_amount", label: "Disallowed", type: "number" },
              { key: "disallowance_reasons", label: "Disallowance reasons", type: "textarea" }, { key: "response_to_payer", label: "Response / dispute", type: "textarea" }],
          },
        },
      ]}
    />
  )
}

export function ProcurementPage() {
  return (
    <ModuleHub
      title="Procurement & Stores"
      subtitle="NABH FPM.1 — approval rules, indents, goods receipt with discrepancy flags, inter-store transfers, supplier scorecards"
      tabs={[
        {
          key: "grn",
          label: "Goods receipt",
          resource: {
            title: "Goods receipt notes", endpoint: "/inventory/grns/", createLabel: "Receive goods",
            columns: [col("grn_number", "GRN"), col("po_number", "PO"), col("received_on", "Date"), col("vendor_invoice_number", "Invoice"), { key: "has_discrepancy", label: "Discrepancy", render: (r) => (r.has_discrepancy ? r.discrepancy_notes : "None") }],
            fields: [{ key: "purchase_order", label: "Purchase order", type: "fk", source: "/inventory/purchase-orders/", sourceLabel: "po_number", required: true }, { key: "vendor_invoice_number", label: "Vendor invoice no." },
              { key: "items", label: "Lines (JSON)", type: "json", required: true, placeholder: '[{"po_item": 12, "received_quantity": 90, "rejected_quantity": 5, "batch_number": "B1", "expiry_date": "2027-06-30", "remarks": "torn packs"}]' }],
          },
        },
        {
          key: "indents",
          label: "Store indents",
          resource: {
            title: "Department indents", endpoint: "/inventory/indents/", createLabel: "Raise indent",
            columns: [col("indent_number", "Indent"), col("department", "Department"), { key: "items", label: "Items", render: (r) => (r.items ?? []).map((i: any) => `#${i.item} × ${i.quantity}${i.issued_quantity != null ? ` (issued ${i.issued_quantity})` : ""}`).join(", ") }, { key: "status", label: "Status" }],
            fields: [{ key: "department", label: "Department", required: true }, { key: "items", label: "Items (JSON)", type: "json", required: true, placeholder: '[{"item": 3, "quantity": 20}]' }],
            actions: [{ label: "Approve", path: "approve/", show: (r) => r.status === "requested" }, { label: "Issue", path: "issue/", tone: "primary", show: (r) => r.status === "approved" }],
          },
        },
        { key: "transfers", label: "Transfers", resource: { title: "Inter-store transfers", endpoint: "/inventory/transfers/", createLabel: "Transfer stock", columns: [col("item_name", "Item"), col("from_store", "From"), col("to_store", "To"), col("quantity", "Qty"), col("transferred_at", "When")], fields: [{ key: "item", label: "Item", type: "fk", source: "/inventory/items/", required: true }, { key: "from_store", label: "From store", type: "fk", source: "/inventory/stores/", required: true }, { key: "to_store", label: "To store", type: "fk", source: "/inventory/stores/", required: true }, { key: "quantity", label: "Quantity", type: "number", required: true }, { key: "remarks", label: "Remarks" }] } },
        { key: "ratings", label: "Supplier quality", resource: { title: "Supplier quality feedback", endpoint: "/inventory/supplier-ratings/", createLabel: "Rate supplier", columns: [col("vendor_name", "Vendor"), col("quality", "Quality"), col("delivery_timeliness", "Delivery"), col("packaging", "Packaging"), col("remarks", "Remarks")], fields: [{ key: "vendor_name", label: "Vendor", required: true }, { key: "grn", label: "GRN", type: "fk", source: "/inventory/grns/", sourceLabel: "grn_number" }, { key: "quality", label: "Quality 1–5", type: "number", required: true }, { key: "delivery_timeliness", label: "Delivery 1–5", type: "number", required: true }, { key: "packaging", label: "Packaging 1–5", type: "number", defaultValue: 3 }, { key: "remarks", label: "Remarks", type: "textarea" }], toolbar: [{ label: "Scorecard", path: "scorecard/", method: "get" }] } },
        { key: "stores", label: "Stores", resource: { title: "Stores", endpoint: "/inventory/stores/", createLabel: "Add store", columns: [col("code", "Code"), col("name", "Name"), col("is_main", "Main")], fields: [{ key: "name", label: "Name", required: true }, { key: "code", label: "Code", required: true }, { key: "is_main", label: "Main store", type: "boolean" }] } },
        { key: "rules", label: "Approval rules", resource: { title: "PO approval rules", endpoint: "/inventory/approval-rules/", createLabel: "Add rule", columns: [col("min_amount", "From ₹"), col("max_amount", "To ₹"), col("approver_role", "Approver role")], fields: [{ key: "min_amount", label: "From ₹", type: "number", required: true }, { key: "max_amount", label: "To ₹ (blank = no limit)", type: "number" }, { key: "approver_role", label: "Approver role template", type: "select", options: opts("purchase_manager", "finance_manager", "hospital_administrator", "owner"), required: true }] } },
      ]}
    />
  )
}

export function HRNabhPage() {
  const emp = { key: "employee", label: "Employee", type: "fk" as const, source: "/hr/employees/", sourceLabel: (r: any) => `${r.employee_code} ${r.user_name ?? r.designation ?? ""}`, required: true }
  return (
    <ModuleHub
      title="HR — Payroll, Roster, Talent"
      subtitle="NABH HRM — payroll (PF/ESI/PT/TDS), duty rules & roster publishing, appraisals, recruitment, exit, induction & training"
      tabs={[
        {
          key: "payroll",
          label: "Payroll",
          resource: {
            title: "Payroll runs", endpoint: "/hr/payroll-runs/", createLabel: "Run payroll",
            description: "Paid days = month days − absences − unpaid leave. Approval must be by someone other than the preparer.",
            columns: [col("month", "Month"), col("total_gross", "Gross"), col("total_net", "Net"), { key: "status", label: "Status" }],
            fields: [{ key: "month", label: "Month (any date in it)", type: "date", required: true }],
            actions: [{ label: "Payslips", path: "payslips/", method: "get" }, { label: "Approve", path: "approve/", tone: "primary", show: (r) => r.status === "draft" }, { label: "Share payslips", path: "share_payslips/", show: (r) => r.status !== "draft" }],
          },
        },
        { key: "salary", label: "Salary structures", resource: { title: "Salary structures", endpoint: "/hr/salary-structures/", createLabel: "Set salary", columns: [col("employee_code", "Code"), col("employee_name", "Employee"), col("basic", "Basic"), col("hra", "HRA"), col("special_allowance", "Special"), col("monthly_tds", "TDS")], fields: [emp, { key: "basic", label: "Basic", type: "number", required: true }, { key: "hra", label: "HRA", type: "number" }, { key: "special_allowance", label: "Special allowance", type: "number" }, { key: "other_allowances", label: "Other allowances", type: "number" }, { key: "pf_applicable", label: "PF applicable", type: "boolean", defaultValue: true }, { key: "esi_applicable", label: "ESI applicable", type: "boolean", defaultValue: true }, { key: "professional_tax", label: "Monthly PT", type: "number", defaultValue: 200 }, { key: "monthly_tds", label: "Monthly TDS", type: "number" }] } },
        { key: "roster", label: "Roster publishing", resource: { title: "Published rosters", endpoint: "/hr/roster-publications/", createLabel: "Publish roster", description: "Duty rules are checked on publish; each rostered staff member is notified of their shifts.", columns: [col("period_start", "From"), col("period_end", "To"), col("published_at", "Published"), col("notified_count", "Staff notified"), { key: "violations", label: "Rule violations", render: (r) => (r.violations ?? []).length || "None" }], fields: [{ key: "department", label: "Department (blank = all)", type: "fk", source: "/departments/" }, { key: "period_start", label: "From", type: "date", required: true }, { key: "period_end", label: "To", type: "date", required: true }, { key: "override", label: "Publish despite rule violations", type: "boolean" }] } },
        { key: "duty", label: "Duty rules", resource: { title: "Duty rules", endpoint: "/hr/duty-rules/", createLabel: "Add rule", columns: [col("name", "Rule"), col("applies_to_designation", "Applies to"), col("max_shifts_per_week", "Max shifts/wk"), col("max_consecutive_nights", "Max nights"), col("min_rest_hours_between_shifts", "Min rest h")], fields: [{ key: "name", label: "Name", required: true }, { key: "applies_to_designation", label: "Designation contains" }, { key: "max_shifts_per_week", label: "Max shifts / week", type: "number", defaultValue: 6 }, { key: "max_consecutive_nights", label: "Max consecutive nights", type: "number", defaultValue: 3 }, { key: "min_rest_hours_between_shifts", label: "Min rest hours", type: "number", defaultValue: 12 }] } },
        { key: "appraisals", label: "Appraisals", resource: { title: "Performance appraisals", endpoint: "/hr/appraisals/", createLabel: "New appraisal", columns: [col("employee_name", "Employee"), col("period", "Period"), col("overall_rating", "Overall"), col("employee_acknowledged_at", "Acknowledged")], fields: [emp, { key: "period", label: "Period", required: true, placeholder: "FY2025-26" }, { key: "ratings", label: "Ratings 1–5 (JSON)", type: "json", required: true, placeholder: '{"clinical": 4, "communication": 5, "teamwork": 4}' }, { key: "strengths", label: "Strengths", type: "textarea" }, { key: "improvement_areas", label: "Improvement areas", type: "textarea" }, { key: "goals", label: "Goals", type: "textarea" }], actions: [{ label: "Acknowledge", path: "acknowledge/", show: (r) => !r.employee_acknowledged_at }] } },
        { key: "openings", label: "Recruitment", resource: { title: "Job openings", endpoint: "/hr/job-openings/", createLabel: "New opening", columns: [col("title", "Role"), col("positions", "Positions"), { key: "approval_status", label: "Approval" }, { key: "status", label: "Status" }], fields: [{ key: "title", label: "Title", required: true }, { key: "department", label: "Department", type: "fk", source: "/departments/" }, { key: "positions", label: "Positions", type: "number", defaultValue: 1 }, { key: "requirements", label: "Requirements", type: "textarea" }], actions: [{ label: "Approve", path: "approve/", tone: "primary", show: (r) => r.approval_status === "pending" }] } },
        { key: "candidates", label: "Candidates", resource: { title: "Candidates", endpoint: "/hr/candidates/", createLabel: "Add candidate", columns: [col("name", "Name"), col("opening", "Opening"), { key: "stage", label: "Stage" }, col("credentials_verified", "Credentials"), col("police_verification_done", "Police"), col("medical_fitness_done", "Medical")], fields: [{ key: "opening", label: "Opening", type: "fk", source: "/hr/job-openings/?approval_status=approved", sourceLabel: "title", required: true }, { key: "name", label: "Name", required: true }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }], actions: [{ label: "Move stage", path: "move/", prompt: [{ key: "stage", label: "Stage", type: "select", options: opts("screened", "interview", "offered", "joined", "rejected"), required: true }, { key: "feedback", label: "Interview feedback (JSON)", type: "json", placeholder: '{"rating": 4, "notes": "..."}' }] }, { label: "Verifications", path: "", method: "patch", prompt: [{ key: "credentials_verified", label: "Credentials verified", type: "boolean" }, { key: "police_verification_done", label: "Police verification", type: "boolean" }, { key: "medical_fitness_done", label: "Medical fitness", type: "boolean" }] }] } },
        { key: "exits", label: "Exit", resource: { title: "Exit process", endpoint: "/hr/exits/", createLabel: "Record resignation", columns: [col("employee_name", "Employee"), col("resignation_date", "Resigned"), col("last_working_day", "LWD"), { key: "clearances", label: "Clearances", render: (r) => Object.entries(r.clearances ?? {}).map(([k, v]) => `${k}${v ? " ✓" : ""}`).join(" · ") }, { key: "status", label: "Status" }], fields: [emp, { key: "reason", label: "Reason", type: "textarea", required: true }, { key: "last_working_day", label: "Last working day", type: "date", required: true }], actions: [{ label: "Clear dept", path: "clear/", prompt: [{ key: "department", label: "Department", type: "select", options: opts("it", "stores", "finance", "department", "hr"), required: true }], show: (r) => r.status === "initiated" }, { label: "Complete exit", path: "complete/", tone: "primary", prompt: [{ key: "exit_interview_notes", label: "Exit interview", type: "textarea" }, { key: "full_and_final_amount", label: "F&F amount", type: "number" }], show: (r) => r.status === "cleared" }] } },
        { key: "training", label: "Training calendar", resource: { title: "Training & induction", endpoint: "/hr/trainings/", createLabel: "Schedule training", columns: [col("scheduled_at", "When"), col("title", "Programme"), col("kind", "Kind"), col("trainer", "Trainer"), { key: "attendance_summary", label: "Attendance", render: (r) => `${r.attendance_summary?.attended ?? 0}/${r.attendance_summary?.invited ?? 0} · ★${r.attendance_summary?.avg_feedback ?? "—"}` }], fields: [{ key: "title", label: "Title", required: true }, { key: "kind", label: "Kind", type: "select", options: opts("induction", "in_service", "mandatory", "cme", "fire_safety", "bls"), defaultValue: "in_service" }, { key: "scheduled_at", label: "When", type: "datetime", required: true }, { key: "duration_hours", label: "Hours", type: "number", defaultValue: 1 }, { key: "trainer", label: "Trainer" }, { key: "venue", label: "Venue" }, { key: "invitees", label: "Invitees", type: "multifk", source: "/hr/employees/", sourceLabel: (r: any) => `${r.employee_code} ${r.designation}` }], actions: [{ label: "Record attendance", path: "record/", prompt: [{ key: "attendees", label: "Attendees (JSON)", type: "json", required: true, placeholder: '[{"employee": 4, "attended": true, "post_test_score": 80, "feedback_rating": 4}]' }] }], toolbar: [{ label: "Pending induction", path: "pending_induction/", method: "get" }] } },
        { key: "profiles", label: "Credentials", resource: { title: "Staff profiles & credentials", endpoint: "/hr/staff-profiles/", createLabel: "Add profile", columns: [col("employee_code", "Code"), col("employee_name", "Employee"), col("council_registration", "Registration"), col("registration_valid_until", "Valid until"), col("credentials_verified", "Verified")], fields: [emp, { key: "date_of_birth", label: "DOB", type: "date" }, { key: "phone", label: "Phone" }, { key: "council_registration", label: "Council registration no." }, { key: "registration_valid_until", label: "Registration valid until", type: "date" }, { key: "credentials_verified", label: "Credentials verified", type: "boolean" }, { key: "qualifications", label: "Qualifications (JSON)", type: "json" }, { key: "privileges", label: "Clinical privileges", type: "textarea" }, { key: "immunisation", label: "Immunisation (JSON)", type: "json" }, { key: "uan", label: "PF UAN" }, { key: "esi_number", label: "ESI no." }], toolbar: [{ label: "Registrations expiring", path: "expiring_registrations/", method: "get" }] } },
      ]}
    />
  )
}

export function PharmacyNabhPage() {
  const med = { key: "medicine", label: "Medicine", type: "fk" as const, source: "/pharmacy/medicines/", required: true }
  return (
    <ModuleHub
      title="Pharmacy — Medication Safety"
      subtitle="NABH MOM — formulary flags, reorder & expiry alerts, recalls, returns, reconciliation, ward indents, emergency drug stock"
      tabs={[
        { key: "reorder", label: "Reorder alerts", resource: { title: "At or below reorder level", endpoint: "/pharmacy/medicines/reorder_alerts/", searchable: false, columns: [col("name", "Medicine"), col("stock", "Stock"), col("reorder_level", "Reorder level"), col("is_emergency", "Emergency drug")] } },
        { key: "expiry", label: "Near expiry", resource: { title: "Expiring within 90 days", endpoint: "/pharmacy/batches/expiring/", searchable: false, columns: [col("medicine", "Medicine"), col("batch_number", "Batch"), col("expiry_date", "Expiry"), col("quantity", "Qty"), { key: "expired", label: "Status", render: (r) => (r.expired ? "EXPIRED" : "Near expiry") }] } },
        { key: "formulary", label: "Formulary flags", resource: { title: "Medicines & safety flags", endpoint: "/pharmacy/medicines/", columns: [col("name", "Medicine"), col("generic_name", "Generic"), col("strength", "Strength"), col("is_formulary", "Formulary"), col("is_high_risk", "High-risk"), col("is_lasa", "LASA"), col("is_emergency", "Emergency"), col("is_restricted_antimicrobial", "Restricted AMA"), col("drug_code", "SNOMED/NRCeS")], actions: [{ label: "Edit flags", path: "", method: "patch", prompt: [{ key: "is_formulary", label: "In formulary", type: "boolean" }, { key: "is_high_risk", label: "High-risk / high-alert", type: "boolean" }, { key: "is_lasa", label: "Look-alike/sound-alike", type: "boolean" }, { key: "lasa_pair", label: "LASA pair" }, { key: "is_emergency", label: "Emergency medicine", type: "boolean" }, { key: "is_controlled", label: "Controlled (NDPS)", type: "boolean" }, { key: "is_restricted_antimicrobial", label: "Restricted antimicrobial", type: "boolean" }, { key: "drug_code", label: "SNOMED CT / NRCeS code" }] }] } },
        { key: "recalls", label: "Recalls", resource: { title: "Recalls", endpoint: "/pharmacy/recalls/", createLabel: "Start recall", columns: [col("medicine_name", "Medicine"), col("reference", "Notice"), col("reason", "Reason"), { key: "status", label: "Status" }], fields: [med, { key: "reason", label: "Reason", type: "textarea", required: true }, { key: "reference", label: "CDSCO / manufacturer notice" }, { key: "batches", label: "Batches (blank = all)", type: "multifk", source: "/pharmacy/batches/", sourceLabel: (r: any) => `${r.medicine_name} ${r.batch_number}` }], actions: [{ label: "Affected patients", path: "affected_patients/", method: "get" }, { label: "Close", path: "close/", show: (r) => r.status === "open" }] } },
        { key: "returns", label: "Returns", resource: { title: "Returns", endpoint: "/pharmacy/returns/", createLabel: "Record return", columns: [col("medicine_name", "Medicine"), col("quantity", "Qty"), col("reason", "Reason"), col("restocked", "Restocked")], fields: [{ key: "batch", label: "Batch", type: "fk", source: "/pharmacy/batches/", sourceLabel: (r: any) => `${r.medicine_name} ${r.batch_number}`, required: true }, patientField(false), { key: "quantity", label: "Quantity", type: "number", required: true }, { key: "reason", label: "Reason", required: true }, { key: "restocked", label: "Fit to restock", type: "boolean", defaultValue: true }] } },
        { key: "recon", label: "Reconciliation", resource: { title: "Medication reconciliation", endpoint: "/pharmacy/reconciliations/", createLabel: "Reconcile", columns: [col("patient_name", "Patient"), col("stage", "Stage"), col("discrepancies_found", "Changes"), col("created_at", "When")], fields: [patientField(), admissionField(), { key: "stage", label: "Stage", type: "select", options: opts("admission", "transfer", "discharge"), required: true }, { key: "items", label: "Medicines (JSON)", type: "json", required: true, placeholder: '[{"name": "Metformin 500", "source": "home", "decision": "continue"}]' }, { key: "notes", label: "Notes", type: "textarea" }] } },
        { key: "indents", label: "Ward indents", resource: { title: "Pharmacy indents", endpoint: "/pharmacy/indents/", createLabel: "Raise indent", columns: [col("indent_number", "Indent"), col("department", "Ward"), col("priority", "Priority"), { key: "items", label: "Items", render: (r) => (r.items ?? []).map((i: any) => `#${i.medicine} × ${i.quantity} (${i.issued_quantity ?? 0})`).join(", ") }, { key: "status", label: "Status" }], fields: [{ key: "department", label: "Ward / department", required: true }, patientField(false), { key: "priority", label: "Priority", type: "select", options: opts("routine", "urgent", "stat"), defaultValue: "routine" }, { key: "items", label: "Items (JSON)", type: "json", required: true, placeholder: '[{"medicine": 5, "quantity": 10}]' }], actions: [{ label: "Issue (FEFO)", path: "issue/", tone: "primary", show: (r) => ["requested", "partial"].includes(r.status) }] } },
        { key: "emergency", label: "Emergency drugs", resource: { title: "Emergency / crash-cart stock", endpoint: "/pharmacy/emergency-stock/", createLabel: "Add location item", columns: [col("location", "Location"), col("medicine_name", "Medicine"), col("par_level", "Par"), col("current_quantity", "Current"), col("expiry_date", "Expiry"), col("last_checked_at", "Checked")], fields: [{ key: "location", label: "Location", required: true }, med, { key: "par_level", label: "Par level", type: "number", required: true }, { key: "current_quantity", label: "Current qty", type: "number" }, { key: "expiry_date", label: "Nearest expiry", type: "date" }], actions: [{ label: "Check", path: "check/", tone: "primary", prompt: [{ key: "current_quantity", label: "Current quantity", type: "number", required: true }, { key: "expiry_date", label: "Nearest expiry", type: "date" }] }], toolbar: [{ label: "Shortfalls", path: "shortfalls/", method: "get" }] } },
        { key: "stockouts", label: "Stock-outs", resource: { title: "Stock-out events", endpoint: "/pharmacy/stock-outs/", searchable: false, columns: [col("medicine_name", "Medicine"), col("location", "Location"), col("is_emergency_medication", "Emergency"), col("occurred_at", "When"), col("resolved_at", "Resolved")] } },
      ]}
    />
  )
}

export function DiagnosticsSetupPage() {
  return (
    <ModuleHub
      title="Diagnostics — Setup & Integration"
      subtitle="Report templates, outsourced tests, analyser (HL7) integration, radiology equipment slots and templates"
      tabs={[
        { key: "lab-tpl", label: "Lab report templates", resource: { title: "Lab report templates", endpoint: "/laboratory/report-templates/", createLabel: "New template", columns: [col("name", "Name"), col("department", "Dept"), col("signatory_designation", "Signatory")], fields: [{ key: "name", label: "Name", required: true }, { key: "department", label: "Department", type: "select", options: opts("hematology", "biochemistry", "microbiology", "serology", "pathology", "other") }, { key: "header_text", label: "Header", type: "textarea" }, { key: "footer_text", label: "Footer / method / interpretation", type: "textarea" }, { key: "signatory_designation", label: "Signatory", defaultValue: "Consultant Pathologist" }] } },
        { key: "outsourced", label: "Outsourced tests", resource: { title: "Tests sent to external labs", endpoint: "/laboratory/outsourced-tests/", createLabel: "Send out test", columns: [col("patient_name", "Patient"), col("test_name", "Test"), col("external_lab", "Lab"), col("external_reference", "Ref"), col("sent_at", "Sent"), { key: "status", label: "Status" }], fields: [{ key: "lab_order", label: "Lab order", type: "fk", source: "/laboratory/orders/", sourceLabel: (r: any) => `${r.order_number} ${r.patient_name}`, required: true }, { key: "lab_test", label: "Test", type: "fk", source: "/laboratory/tests/", required: true }, { key: "external_lab", label: "External lab", required: true }, { key: "expected_by", label: "Expected by", type: "datetime" }], actions: [{ label: "Mark sent", path: "mark_sent/", prompt: [{ key: "external_reference", label: "External ref" }], show: (r) => r.status === "pending" }, { label: "Record result", path: "record_result/", tone: "primary", prompt: [{ key: "result_text", label: "Result", type: "textarea", required: true }], show: (r) => r.status === "sent" }] } },
        { key: "analyzers", label: "Analysers (HL7)", resource: { title: "Lab analysers", endpoint: "/laboratory/analyzers/", createLabel: "Add analyser", description: "Analysers post HL7 v2 ORU^R01 to /api/v1/laboratory/analyzer/results/ with header X-Analyzer-Token.", columns: [col("name", "Analyser"), col("model_name", "Model"), col("protocol", "Protocol"), col("last_message_at", "Last message")], fields: [{ key: "name", label: "Name", required: true }, { key: "model_name", label: "Model" }, { key: "protocol", label: "Protocol", type: "select", options: opts("hl7", "astm"), defaultValue: "hl7" }, { key: "test_code_map", label: "Test code map (JSON)", type: "json", placeholder: '{"GLU": "RBS", "HGB": "HB"}' }], actions: [{ label: "Generate token", path: "rotate_token/", confirm: "Issue a new analyser token?" }] } },
        { key: "rad-eq", label: "Radiology equipment", resource: { title: "Imaging equipment (slot booking)", endpoint: "/radiology/equipment/", createLabel: "Add machine", columns: [col("name", "Machine"), col("modality", "Modality"), col("room", "Room"), col("start_time", "From"), col("end_time", "To"), col("slot_minutes", "Slot min")], fields: [{ key: "name", label: "Name", required: true }, { key: "modality", label: "Modality", type: "select", options: opts("xray", "ct", "mri", "usg", "other"), required: true }, { key: "room", label: "Room" }, { key: "start_time", label: "Opens", defaultValue: "08:00" }, { key: "end_time", label: "Closes", defaultValue: "20:00" }, { key: "slot_minutes", label: "Slot minutes", type: "number", defaultValue: 15 }, { key: "ae_title", label: "DICOM AE title" }], actions: [{ label: "Free slots today", path: "slots/", method: "get" }] } },
        { key: "rad-appts", label: "Imaging bookings", resource: { title: "Imaging appointments", endpoint: "/radiology/appointments/", searchable: false, columns: [col("accession_number", "Accession"), col("patient_name", "Patient"), col("procedure_name", "Study"), col("equipment", "Machine"), col("start", "Start"), col("end", "End")] } },
        { key: "rad-tpl", label: "Radiology templates", resource: { title: "Radiology report templates", endpoint: "/radiology/templates/", createLabel: "New template", columns: [col("name", "Name"), col("modality", "Modality"), col("impression", "Impression")], fields: [{ key: "name", label: "Name", required: true }, { key: "modality", label: "Modality", type: "select", options: opts("xray", "ct", "mri", "usg", "other"), required: true }, { key: "procedure", label: "Procedure", type: "fk", source: "/radiology/procedures/" }, { key: "findings", label: "Findings template", type: "textarea", required: true }, { key: "impression", label: "Impression", type: "textarea" }] } },
      ]}
    />
  )
}

export function InpatientFlowPage() {
  return (
    <ModuleHub
      title="Inpatient Flow"
      subtitle="NABH AAC.5/6 — bed board & availability forecast, discharge planning with department clearances, admission rules"
      tabs={[
        { key: "beds", label: "Bed board", render: () => <BedBoard /> },
        { key: "due", label: "Due for discharge", resource: { title: "Due for discharge", endpoint: "/ipd/admissions/due_for_discharge/", searchable: false, columns: [col("patient", "Patient"), col("uhid", "UHID"), col("ward", "Ward"), col("bed", "Bed"), col("expected_discharge_date", "Expected"), col("discharge_initiated_at", "Initiated"), col("pending_clearances", "Pending clearances")] } },
        { key: "admissions", label: "Plan discharge", resource: { title: "Current admissions", endpoint: "/ipd/admissions/?status=admitted", columns: [col("patient_name", "Patient"), col("bed_label", "Bed"), col("admitted_at", "Admitted"), col("expected_discharge_date", "Expected discharge"), col("discharge_initiated_at", "Discharge initiated")], actions: [{ label: "Expected date", path: "", method: "patch", prompt: [{ key: "expected_discharge_date", label: "Expected discharge", type: "date", required: true }] }, { label: "Initiate discharge", path: "initiate_discharge/", tone: "primary", show: (r) => !r.discharge_initiated_at }] } },
        { key: "clearances", label: "Clearances", resource: { title: "Discharge clearances", endpoint: "/ipd/discharge-clearances/?status=pending", searchable: false, filters: [{ key: "department", label: "Department", type: "select", options: opts("nursing", "pharmacy", "laboratory", "radiology", "dietary", "billing", "tpa", "medical_records") }], columns: [col("admission", "Admission"), col("department", "Department"), { key: "status", label: "Status" }], actions: [{ label: "Clear", path: "clear/", tone: "primary", prompt: [{ key: "remarks", label: "Remarks" }] }, { label: "N/A", path: "clear/", prompt: [{ key: "not_applicable", label: "Not applicable", type: "boolean", defaultValue: true }] }] } },
        { key: "rules", label: "Admission rules", resource: { title: "Admission rules", endpoint: "/ipd/admission-rules/", createLabel: "Add rule", columns: [col("admission_type", "Type"), col("checklist_items", "Checklist"), col("minimum_deposit", "Min deposit"), col("notify_departments", "Notify")], fields: [{ key: "admission_type", label: "Admission type", type: "select", options: opts("planned", "emergency"), required: true }, { key: "checklist_items", label: "Checklist (JSON)", type: "json", placeholder: '["Consent signed", "ID verified", "Deposit collected"]' }, { key: "minimum_deposit", label: "Minimum deposit", type: "number" }, { key: "requires_consent", label: "Consent required", type: "boolean", defaultValue: true }, { key: "notify_departments", label: "Notify departments (JSON)", type: "json", placeholder: '["nursing", "dietary", "billing", "pharmacy"]' }] } },
      ]}
    />
  )
}
