import { Suspense, lazy } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { Shell } from "./app/Shell"
import { ProtectedRoute } from "./app/ProtectedRoute"
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

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={<LoadingState />}><DashboardPage /></Suspense>} />
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
          <Route path="/admin" element={<Suspense fallback={<LoadingState />}><AdminPage /></Suspense>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}


export default App
