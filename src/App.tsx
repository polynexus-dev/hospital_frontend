import { Navigate, Route, Routes } from "react-router-dom"
import { Shell } from "./app/Shell"
import { ProtectedRoute } from "./app/ProtectedRoute"
import { LoginPage } from "./features/auth/LoginPage"
import { DashboardPage } from "./features/dashboard/DashboardPage"
import { ConsolePage } from "./features/console/ConsolePage"
import { CallbacksPage } from "./features/callbacks/CallbacksPage"
import { EnquiriesPage } from "./features/enquiries/EnquiriesPage"
import { PatientsListPage } from "./features/patients/PatientsListPage"
import { PatientDetailPage } from "./features/patients/PatientDetailPage"
import { AppointmentsPage } from "./features/appointments/AppointmentsPage"
import { InboxPage } from "./features/inbox/InboxPage"
import { ReferralsPage } from "./features/referrals/ReferralsPage"
import { PackagesPage } from "./features/packages/PackagesPage"
import { TPAPage } from "./features/tpa/TPAPage"
import { FeedbackPage } from "./features/feedback/FeedbackPage"
import { WorkflowsPage } from "./features/workflows/WorkflowsPage"
import { AdminPage } from "./features/admin/AdminPage"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/console" element={<ConsolePage />} />
          <Route path="/callbacks" element={<CallbacksPage />} />
          <Route path="/enquiries" element={<EnquiriesPage />} />
          <Route path="/patients" element={<PatientsListPage />} />
          <Route path="/patients/:id" element={<PatientDetailPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/referrals" element={<ReferralsPage />} />
          <Route path="/packages" element={<PackagesPage />} />
          <Route path="/tpa" element={<TPAPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}


export default App
