import { Suspense, lazy } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { Shell } from "./app/Shell"
import { ProtectedRoute } from "./app/ProtectedRoute"
import { RequireHospitalContext } from "./app/RequireHospitalContext"
import { RequirePermission } from "./app/RequirePermission"
import { LoginPage } from "./features/auth/LoginPage"
import { LoadingState } from "./components/ui/QueryStates"

// Route-level code splitting: everything past login only loads once a
// session exists, instead of shipping every feature module (patients,
// appointments, referrals, workflows, admin, ...) in the one bundle a
// first-time visitor downloads just to see the login screen.
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })))
const ConsolePage = lazy(() => import("./features/console/ConsolePage").then((m) => ({ default: m.ConsolePage })))
const CallbacksPage = lazy(() => import("./features/callbacks/CallbacksPage").then((m) => ({ default: m.CallbacksPage })))
const EnquiriesPage = lazy(() => import("./features/enquiries/EnquiriesPage").then((m) => ({ default: m.EnquiriesPage })))
const PatientsListPage = lazy(() => import("./features/patients/PatientsListPage").then((m) => ({ default: m.PatientsListPage })))
const PatientDetailPage = lazy(() => import("./features/patients/PatientDetailPage").then((m) => ({ default: m.PatientDetailPage })))
const AppointmentsPage = lazy(() => import("./features/appointments/AppointmentsPage").then((m) => ({ default: m.AppointmentsPage })))
const InboxPage = lazy(() => import("./features/inbox/InboxPage").then((m) => ({ default: m.InboxPage })))
const ReferralsPage = lazy(() => import("./features/referrals/ReferralsPage").then((m) => ({ default: m.ReferralsPage })))
const PackagesPage = lazy(() => import("./features/packages/PackagesPage").then((m) => ({ default: m.PackagesPage })))
const TPAPage = lazy(() => import("./features/tpa/TPAPage").then((m) => ({ default: m.TPAPage })))
const FeedbackPage = lazy(() => import("./features/feedback/FeedbackPage").then((m) => ({ default: m.FeedbackPage })))
const WorkflowsPage = lazy(() => import("./features/workflows/WorkflowsPage").then((m) => ({ default: m.WorkflowsPage })))
const AdminPage = lazy(() => import("./features/admin/AdminPage").then((m) => ({ default: m.AdminPage })))
const IPDPage = lazy(() => import("./features/ipd/IPDPage").then((m) => ({ default: m.IPDPage })))
const DiagnosticsPage = lazy(() => import("./features/diagnostics/DiagnosticsPage").then((m) => ({ default: m.DiagnosticsPage })))
const PharmacyPage = lazy(() => import("./features/pharmacy/PharmacyPage").then((m) => ({ default: m.PharmacyPage })))
const EmergencyPage = lazy(() => import("./features/emergency/EmergencyPage").then((m) => ({ default: m.EmergencyPage })))
const OTPage = lazy(() => import("./features/ot/OTPage").then((m) => ({ default: m.OTPage })))
const ICUPage = lazy(() => import("./features/icu/ICUPage").then((m) => ({ default: m.ICUPage })))
const BloodBankPage = lazy(() => import("./features/bloodbank/BloodBankPage").then((m) => ({ default: m.BloodBankPage })))
const FinancePage = lazy(() => import("./features/finance/FinancePage").then((m) => ({ default: m.FinancePage })))
const HRPage = lazy(() => import("./features/hr/HRPage").then((m) => ({ default: m.HRPage })))
const BillingPage = lazy(() => import("./features/billing/BillingPage").then((m) => ({ default: m.BillingPage })))
const InventoryPage = lazy(() => import("./features/inventory/InventoryPage").then((m) => ({ default: m.InventoryPage })))
const SettingsPage = lazy(() => import("./features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })))

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={<LoadingState />}><DashboardPage /></Suspense>} />
          <Route path="/admin" element={<Suspense fallback={<LoadingState />}><AdminPage /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<LoadingState />}><SettingsPage /></Suspense>} />

          {/* Hospital Clinical & Patient PHI Routes — Gated by RequireHospitalContext for DPDP Act Compliance */}
          <Route element={<RequireHospitalContext />}>
            <Route path="/console" element={<Suspense fallback={<LoadingState />}><ConsolePage /></Suspense>} />
            <Route path="/callbacks" element={<Suspense fallback={<LoadingState />}><CallbacksPage /></Suspense>} />
            <Route path="/enquiries" element={<Suspense fallback={<LoadingState />}><EnquiriesPage /></Suspense>} />
            <Route path="/patients" element={<Suspense fallback={<LoadingState />}><PatientsListPage /></Suspense>} />
            <Route path="/patients/:id" element={<Suspense fallback={<LoadingState />}><PatientDetailPage /></Suspense>} />
            <Route path="/appointments" element={<Suspense fallback={<LoadingState />}><AppointmentsPage /></Suspense>} />
            <Route path="/inbox" element={<Suspense fallback={<LoadingState />}><InboxPage /></Suspense>} />
            <Route path="/referrals" element={<Suspense fallback={<LoadingState />}><ReferralsPage /></Suspense>} />
            <Route path="/packages" element={<Suspense fallback={<LoadingState />}><PackagesPage /></Suspense>} />
            <Route path="/tpa" element={<Suspense fallback={<LoadingState />}><TPAPage /></Suspense>} />
            <Route path="/feedback" element={<Suspense fallback={<LoadingState />}><FeedbackPage /></Suspense>} />
            <Route path="/workflows" element={<Suspense fallback={<LoadingState />}><WorkflowsPage /></Suspense>} />
            <Route element={<RequirePermission permission="ipd.view_admission" />}>
              <Route path="/ipd" element={<Suspense fallback={<LoadingState />}><IPDPage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="laboratory.view_laborder" />}>
              <Route path="/diagnostics" element={<Suspense fallback={<LoadingState />}><DiagnosticsPage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="pharmacy.view_medicine" />}>
              <Route path="/pharmacy" element={<Suspense fallback={<LoadingState />}><PharmacyPage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="emergency.view_edvisit" />}>
              <Route path="/emergency" element={<Suspense fallback={<LoadingState />}><EmergencyPage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="ot.view_surgeryrequest" />}>
              <Route path="/ot" element={<Suspense fallback={<LoadingState />}><OTPage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="icu.view_icuadmission" />}>
              <Route path="/icu" element={<Suspense fallback={<LoadingState />}><ICUPage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="bloodbank.view_bloodunit" />}>
              <Route path="/bloodbank" element={<Suspense fallback={<LoadingState />}><BloodBankPage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="finance.view_ledger" />}>
              <Route path="/finance" element={<Suspense fallback={<LoadingState />}><FinancePage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="hr.view_employee" />}>
              <Route path="/hr" element={<Suspense fallback={<LoadingState />}><HRPage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="billing.view_bill" />}>
              <Route path="/billing" element={<Suspense fallback={<LoadingState />}><BillingPage /></Suspense>} />
            </Route>
            <Route element={<RequirePermission permission="inventory.view_item" />}>
              <Route path="/inventory" element={<Suspense fallback={<LoadingState />}><InventoryPage /></Suspense>} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}


export default App
