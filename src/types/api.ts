export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type Language = "mr" | "hi" | "en"

export interface Department {
  id: number
  name: string
  code: string
  is_active: boolean
}

export interface User {
  id: number
  email: string
  phone: string | null
  first_name: string
  last_name: string
  hospital: string | null
  hospital_name?: string
  hospital_address?: string
  hospital_city?: string
  hospital_state?: string
  hospital_enabled_modules?: string[]
  available_hospitals?: Array<{ id: string; name: string; slug: string; city: string }>
  department: number | null
  role: number | null
  role_name: string | null
  role_domain?: "crm" | "erp" | "both" | null
  permissions: string[]
  preferred_language: Language
  is_active: boolean
  is_staff: boolean
  is_saas_admin: boolean
  date_joined: string
}

export interface Role {
  id: number
  hospital: string
  department: number | null
  name: string
  description: string
  created_at: string
}

export interface Patient {
  id: number
  first_name: string
  last_name: string
  full_name: string
  date_of_birth: string | null
  gender: "male" | "female" | "other" | "undisclosed" | ""
  mobile: string
  alternate_mobile: string
  email: string
  address: string
  city: string
  national_id_type: string
  national_id_number: string
  insurance_provider: string
  insurance_policy_number: string
  employer: string
  attendant_name: string
  attendant_phone: string
  attendant_relation: string
  referring_doctor_name: string
  guardian: number | null
  relationship_to_guardian: string
  next_recall_due_at: string | null
  recall_reason: string
  preferred_language: Language
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PatientLookup {
  id: number
  full_name: string
  mobile: string
  preferred_language: Language
  insurance_provider: string
  referring_doctor_name: string
}

export interface Document {
  id: number
  patient: number
  category: "report" | "prescription" | "insurance_card" | "consent" | "id_proof" | "other"
  title: string
  file: string
  notes: string
  uploaded_by: number | null
  created_at: string
}

export interface TimelineEvent {
  id: number
  patient: number
  event_type: "call" | "enquiry" | "appointment" | "message" | "feedback" | "document" | "note"
  summary: string
  occurred_at: string
  created_by: number | null
}

export type CallDirection = "inbound" | "outbound"
export type CallStatus = "answered" | "missed" | "rnr" | "busy" | "failed" | "voicemail"

export interface Call {
  id: number
  direction: CallDirection
  status: CallStatus
  from_number: string
  to_number: string
  patient: number | null
  department: number | null
  operator: number | null
  started_at: string
  answered_at: string | null
  ended_at: string | null
  duration_seconds: number
  recording_url: string
  consent_recorded: boolean
  call_reason: string
  ivr_path: string
  notes: string
  provider_name: string
  provider_call_id: string
  created_at: string
}

export type CallbackStatus = "pending" | "in_progress" | "done" | "escalated"

export interface CallbackTask {
  id: number
  call: number | null
  patient: number | null
  phone_number: string
  department: number | null
  owner: number | null
  status: CallbackStatus
  sla_due_at: string
  escalation_level: number
  attempt_count: number
  ivr_path: string
  notes: string
  resolved_at: string | null
  created_at: string
}

export type EnquiryStage = "new" | "contacted" | "scheduled" | "visited" | "completed" | "follow_up" | "lost"
export type EnquirySource = "ivr" | "whatsapp" | "website" | "walk_in" | "referral" | "google" | "meta" | "other"
export type Urgency = "low" | "normal" | "high" | "urgent"

export type LostReason =
  | "cost"
  | "location"
  | "went_elsewhere"
  | "no_response"
  | "not_interested"
  | "medical_reason"
  | "duplicate"
  | "other"
  | ""

export interface Enquiry {
  id: number
  patient: number | null
  name: string
  mobile: string
  alternate_mobile: string
  email: string
  source: EnquirySource
  campaign: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
  landing_page: string
  referrer_url: string
  department: number | null
  service_requested: string
  urgency: Urgency
  score: number
  stage: EnquiryStage
  assigned_to: number | null
  duplicate_of: number | null
  sla_due_at: string | null
  escalation_level: number
  lost_reason: LostReason
  lost_notes: string
  notes: string
  estimated_value: string | null
  created_at: string
  updated_at: string
}

export interface EnquiryAssignmentChange {
  id: number
  enquiry: number
  from_owner: number | null
  to_owner: number | null
  changed_by: number | null
  reason: string
  created_at: string
}

export interface Doctor {
  id: number
  department: number | null
  name: string
  speciality: string
  phone: string
  email: string
  default_consultation_minutes: number
  is_active: boolean
}

export interface Slot {
  id: number
  doctor: number
  date: string
  start_time: string
  end_time: string
  is_blocked: boolean
  blocked_reason: string
  is_booked: boolean
}

export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "checked_in"
  | "in_consult"
  | "diagnostics"
  | "completed"
  | "no_show"
  | "cancelled"
  | "rescheduled"

export interface Appointment {
  id: number
  patient: number
  doctor: number
  slot: number
  status: AppointmentStatus
  source: "crm" | "whatsapp" | "website"
  reason: string
  consent_captured: boolean
  consent_captured_at: string | null
  registration_token: string
  queue_token: number | null
  reminder_24h_sent_at: string | null
  reminder_2h_sent_at: string | null
  checked_in_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  no_show_at: string | null
  rescheduled_from: number | null
  booked_by: number | null
  created_at: string
}

export type WaitlistStatus = "waiting" | "offered" | "booked" | "expired" | "cancelled"

export interface Waitlist {
  id: number
  patient: number
  doctor: number
  department: number | null
  preferred_date: string | null
  status: WaitlistStatus
  offered_slot: number | null
  offered_at: string | null
  resulting_appointment: number | null
  notes: string
  created_at: string
}

export interface DoctorQueue {
  now_serving: Appointment | null
  waiting: Appointment[]
}

export type Channel = "whatsapp" | "sms" | "email" | "call_note"

export interface Template {
  id: number
  name: string
  purpose: string
  channel: Channel
  language: Language
  subject: string
  body: string
  is_active: boolean
}

export interface ConsentOptOut {
  id: number
  patient: number
  channel: Channel
  purpose: "transactional" | "marketing" | "all"
  is_opted_out: boolean
  recorded_by: number | null
  updated_at: string
}

export interface Message {
  id: number
  patient: number
  channel: Channel
  direction: "inbound" | "outbound"
  template: number | null
  body: string
  status: "queued" | "sent" | "delivered" | "read" | "failed" | "received"
  is_read: boolean
  sent_by: number | null
  provider_message_id: string
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  created_at: string
}

export type ThreadStatus = "open" | "closed"

export interface Thread {
  id: number
  patient: number
  channel: Channel
  owner: number | null
  status: ThreadStatus
  unread_count: number
  last_message_at: string | null
  last_inbound_at: string | null
  sla_due_at: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackRequest {
  id: number
  patient: number
  appointment: number | null
  doctor: number | null
  department: number | null
  status: "sent" | "responded" | "expired"
  sent_at: string | null
  created_at: string
}

export interface NPSResponse {
  id: number
  feedback_request: number
  patient: number
  doctor: number | null
  department: number | null
  score: number
  category: "promoter" | "passive" | "detractor"
  comment: string
  created_at: string
}

export interface Complaint {
  id: number
  patient: number
  department: number | null
  description: string
  root_cause: string
  status: "open" | "investigating" | "closed"
  owner: number | null
  closed_at: string | null
  created_at: string
}

export interface ServiceRecoveryTask {
  id: number
  nps_response: number
  owner: number | null
  status: "pending" | "in_progress" | "resolved"
  sla_due_at: string
  resolution_notes: string
  resolved_at: string | null
}

export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled"
export type TaskPriority = "low" | "normal" | "high" | "urgent"

export interface AutomationTask {
  id: number
  title: string
  description: string
  owner: number | null
  department: number | null
  status: TaskStatus
  priority: TaskPriority
  due_at: string | null
  completed_at: string | null
  content_type: number | null
  object_id: number | null
  created_by: number | null
  created_at: string
}

export interface EscalationRule {
  id: number
  name: string
  applies_to: "enquiry" | "callback_task" | "automation_task"
  department: number | null
  escalate_after_minutes: number
  escalate_to: number | null
  is_active: boolean
}

export interface CallPerformanceReport {
  received: number
  answered: number
  missed: number
  avg_duration_seconds: number | null
}

export interface EnquiryFunnelReport {
  [stage: string]: number
}

export interface DepartmentDoctorVolumeRow {
  doctor__name: string
  doctor__department__name: string | null
  booked: number
  completed: number
  no_show: number
}

export interface NoShowEffectivenessReport {
  no_shows: number
  recall_tasks_done: number
}

export interface DailyMisPreview {
  summary: Record<string, unknown>
  text: string
}

export interface RevenueBySourceRow {
  source: EnquirySource
  enquiry_count: number
  conversion_count: number
  billed_amount: string
}

export interface RevenueBySourceReport {
  rows: RevenueBySourceRow[]
  note: string
}

export interface ReminderDeliveryRow {
  purpose: string
  channel: Channel
  count: number
}

export interface ReminderDeliveryReport {
  rows: ReminderDeliveryRow[]
}

export interface DoctorRevenueRow {
  doctor_id: number
  doctor_name: string
  completed_appointments: number
  billed_amount: string
}

export interface DoctorRevenueReport {
  rows: DoctorRevenueRow[]
  note: string
}

export interface NpsByDepartmentRow {
  department__name: string | null
  total: number
  promoters: number
  detractors: number
  avg_score: number | null
}

export interface HISVisit {
  id: number
  patient: number
  external_visit_id: string
  visit_type: "opd" | "ipd" | "diagnostic"
  visit_date: string
  department_name: string
  doctor_name: string
}

export interface HISBillingRecord {
  id: number
  patient: number
  external_bill_id: string
  bill_date: string
  total_amount: string
  paid_amount: string
  outstanding_amount: string
  status: "paid" | "partial" | "outstanding"
}

export interface AuditLog {
  id: number
  actor: number | null
  actor_email: string | null
  action: "create" | "update" | "delete" | "read" | "request"
  model_name: string
  object_id: string
  object_repr: string
  changes: Record<string, unknown>
  method: string
  path: string
  status_code: number | null
  ip_address: string | null
  created_at: string
}

export interface IntegrationHealthTask {
  name: string
  task: string
  last_run_at: string | null
  enabled: boolean | null
  total_run_count: number
}

export interface IntegrationHealth {
  his_connector: string
  his_visits: { count: number; latest_synced_at: string | null }
  his_billing: { count: number; latest_synced_at: string | null }
  celery_tasks: IntegrationHealthTask[]
  data_retention_days: number
  is_on_premise: boolean
}

// --- Emergency ---
export interface Triage {
  id: number
  ed_visit: number
  triage_category: "1_resuscitation" | "2_emergent" | "3_urgent" | "4_less_urgent" | "5_non_urgent"
  vitals_summary: string
  triaged_by: number | null
  triaged_at: string
}

export interface EDVisit {
  id: number
  patient: number
  patient_detail?: Patient
  status: "triaged" | "in_treatment" | "admitted" | "discharged" | "referred_out" | "deceased"
  chief_complaint: string
  arrived_at: string
  triage?: Triage
  created_at: string
  updated_at: string
}

// --- OT ---
export interface PreOpChecklist {
  id: number
  surgery_request: number
  consent_obtained: boolean
  fasting_confirmed: boolean
  site_marked: boolean
  completed_by: number | null
  completed_at: string | null
}

export interface OperativeNote {
  id: number
  ot_schedule: number
  procedure_performed: string
  findings: string
  surgeon: number
  started_at: string
  ended_at: string
  finalized_at: string | null
  finalized_by: number | null
}

export interface AnaesthesiaRecord {
  id: number
  ot_schedule: number
  anaesthesia_type: string
  intra_op_notes: string
  anaesthetist: number
  finalized_at: string | null
  finalized_by: number | null
}

export interface ConsumableUsage {
  id: number
  ot_schedule: number
  item_name: string
  quantity: number
}

export interface ImplantUsage {
  id: number
  ot_schedule: number
  implant_name: string
  serial_number: string
  quantity: number
}

export interface OTSchedule {
  id: number
  surgery_request: number
  operation_theatre_room: string
  surgeon: number
  surgeon_detail?: Doctor
  anaesthetist: number | null
  scheduled_start: string
  scheduled_end: string
  operative_note?: OperativeNote
  anaesthesia_record?: AnaesthesiaRecord
  consumable_usages?: ConsumableUsage[]
  implant_usages?: ImplantUsage[]
}

export interface SurgeryRequest {
  id: number
  patient: number
  patient_detail?: Patient
  admission: number | null
  requested_by: number | null
  proposed_procedure: string
  status: "requested" | "approved" | "scheduled" | "completed" | "cancelled"
  schedule?: OTSchedule
  preop_checklist?: PreOpChecklist
  created_at: string
}

// --- ICU ---
export interface VentilatorLog {
  id: number
  icu_admission: number
  mode: string
  ventilator_settings: Record<string, unknown>
  recorded_by: number | null
  recorded_at: string
}

export interface ICUDailyProgressNote {
  id: number
  icu_admission: number
  doctor: number
  doctor_detail?: Doctor
  note: string
  finalized_at: string | null
  finalized_by: number | null
  created_at: string
}

export interface ICUAdmission {
  id: number
  admission: number
  admission_detail?: Record<string, unknown>
  bed: number
  ventilator_required: boolean
  admitted_at: string
  discharged_at: string | null
  ventilator_logs?: VentilatorLog[]
  progress_notes?: ICUDailyProgressNote[]
}

// --- Blood Bank ---
export interface Donor {
  id: number
  name: string
  blood_group: string
  phone: string
  last_donation_date: string | null
}

export interface BloodUnit {
  id: number
  donor: number | null
  donor_detail?: Donor
  blood_group: string
  component: "whole_blood" | "prbc" | "ffp" | "platelets"
  collection_date: string
  expiry_date: string
  status: "available" | "reserved" | "issued" | "discarded"
}

export interface CrossMatchRequest {
  id: number
  patient: number
  patient_detail?: Patient
  blood_group_required: string
  component: "whole_blood" | "prbc" | "ffp" | "platelets"
  requested_by: number | null
  status: "pending" | "matched" | "failed"
  created_at: string
}

export interface Transfusion {
  id: number
  blood_unit: number
  blood_unit_detail?: BloodUnit
  patient: number
  patient_detail?: Patient
  admission: number | null
  issued_by: number | null
  transfused_at: string
  reaction_notes: string
}

// --- Finance ---
export interface LedgerEntry {
  id: number
  entry_type: "revenue" | "expense"
  category: string
  amount: string
  reference_type: string
  reference_id: string
  entry_date: string
}

export interface Expense {
  id: number
  category: string
  amount: string
  paid_to: string
  paid_by: number
  paid_by_name?: string
  expense_date: string
  approved_by: number | null
  approved_by_name?: string
}

export interface Receivable {
  id: number
  source_type: "insurance_claim" | "corporate_billing"
  source_id: string
  amount: string
  due_date: string
  status: "pending" | "received" | "written_off"
}

// --- HR ---
export interface Employee {
  id: number
  user: number | null
  user_detail?: User
  employee_code: string
  department: number | null
  department_detail?: Department
  designation: string
  date_of_joining: string
  employment_type: "permanent" | "contract" | "visiting"
  bank_account_number: string
  pan_number: string
}

export interface Attendance {
  id: number
  employee: number
  employee_code: string
  date: string
  check_in: string | null
  check_out: string | null
  status: "present" | "absent" | "half_day" | "leave"
}

export interface LeaveRequest {
  id: number
  employee: number
  employee_code: string
  leave_type: string
  start_date: string
  end_date: string
  status: "pending" | "approved" | "rejected"
  approved_by: number | null
  approved_by_name?: string
}

export interface Shift {
  id: number
  employee: number
  employee_code: string
  shift_date: string
  shift_type: "morning" | "evening" | "night"
}

export interface BillItem {
  id: number
  description: string
  quantity: number
  unit_price: string
  total_price: string
}

export interface Payment {
  id: number
  bill: number
  amount: string
  payment_method: "cash" | "card" | "upi" | "bank_transfer"
  transaction_id: string
  paid_at: string
}

export interface InsuranceClaim {
  id: number
  bill: number
  insurance_company: string
  policy_number: string
  claimed_amount: string
  approved_amount: string
  status: "submitted" | "under_review" | "approved" | "rejected" | "settled"
}

export interface Bill {
  id: number
  patient: number
  patient_detail?: { first_name: string; last_name: string; mobile: string }
  admission: number | null
  total_amount: string
  discount_amount: string
  net_amount: string
  status: "draft" | "unpaid" | "partially_paid" | "paid" | "cancelled"
  created_at: string
  items?: BillItem[]
  payments?: Payment[]
  insurance_claim?: InsuranceClaim
}

export interface ItemCategory {
  id: number
  name: string
  code: string
}

export interface Item {
  id: number
  category: number
  category_name?: string
  name: string
  code: string
  unit_of_measure: string
  min_stock_level: number
}

export interface StockLevel {
  id: number
  item: number
  item_name?: string
  batch_number: string
  expiry_date: string | null
  quantity_on_hand: number
  unit_cost: string
}

export interface POItem {
  id: number
  item: number
  item_name?: string
  ordered_quantity: number
  received_quantity: number
  unit_cost: string
}

export interface PurchaseOrder {
  id: number
  po_number: string
  vendor_name: string
  status: "draft" | "submitted" | "received" | "cancelled"
  ordered_at: string
  po_items?: POItem[]
}

export interface StockTransaction {
  id: number
  item: number
  item_name?: string
  transaction_type: "receipt" | "issue" | "adjustment" | "return"
  quantity: number
  reference: string
  transaction_date: string
}
