import { Navigate, Outlet, Route, Routes, useLocation, Link } from 'react-router-dom'
import { homeFor, useAuth } from './lib/auth'
import { Loading } from './components/ui'
import Layout from './components/Layout'
import Home from './pages/public/Home'
import Login from './pages/public/Login'
import Register from './pages/public/Register'
import { ForgotPassword, ResetPassword, VerifyEmail } from './pages/public/AccountLinks'
import Doctors from './pages/public/Doctors'
import DoctorProfile from './pages/public/DoctorProfile'
import Appointments from './pages/patient/Appointments'
import AppointmentDetail from './pages/patient/AppointmentDetail'
import Account from './pages/Account'
import Dashboard from './pages/doctor/Dashboard'
import Schedule from './pages/doctor/Schedule'
import ClinicProfile from './pages/doctor/ClinicProfile'
import PatientHistory from './pages/doctor/PatientHistory'
import Overview from './pages/admin/Overview'
import AdminDoctors from './pages/admin/Doctors'
import Users from './pages/admin/Users'
import Notifications from './pages/admin/Notifications'

function RequireRole({ roles }) {
  const { user } = useAuth()
  const location = useLocation()
  if (user === undefined) return <Loading />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

function GuestOnly() {
  const { user } = useAuth()
  if (user === undefined) return <Loading />
  return user ? <Navigate to={homeFor(user)} replace /> : <Outlet />
}

const NotFound = () => (
  <div className="py-20 text-center">
    <h1 className="text-2xl font-semibold">Page not found</h1>
    <Link to="/" className="mt-4 inline-block text-teal-700 underline">Go to the home page</Link>
  </div>
)

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="doctors/:id" element={<DoctorProfile />} />
        <Route path="reset-password/:token" element={<ResetPassword />} />
        <Route path="verify-email/:token" element={<VerifyEmail />} />

        <Route element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>

        <Route element={<RequireRole roles={['patient', 'doctor', 'admin']} />}>
          <Route path="profile" element={<Account />} />
        </Route>
        <Route element={<RequireRole roles={['patient']} />}>
          <Route path="appointments" element={<Appointments />} />
          <Route path="appointments/:id" element={<AppointmentDetail />} />
        </Route>
        <Route element={<RequireRole roles={['doctor']} />}>
          <Route path="doctor" element={<Dashboard />} />
          <Route path="doctor/schedule" element={<Schedule />} />
          <Route path="doctor/profile" element={<ClinicProfile />} />
          <Route path="doctor/patients/:patientId" element={<PatientHistory />} />
        </Route>
        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="admin" element={<Overview />} />
          <Route path="admin/doctors" element={<AdminDoctors />} />
          <Route path="admin/users" element={<Users />} />
          <Route path="admin/notifications" element={<Notifications />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
