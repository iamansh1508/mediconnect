import React from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, RoleRoute } from './shared/components/auth'
import Layout from './components/Layout/Layout.jsx'

import { LoginPage, RegisterPage } from './modules/pages/auth'
import PatientDashboardPage from './pages/patient/PatientDashboardPage.jsx'
import { DoctorSearchPage } from './modules/pages/patient/DoctorSearchPage.jsx'
import { DoctorDetailPage } from './modules/pages/patient/DoctorDetailPage.jsx'
import { BookingPage } from './modules/pages/patient/BookingPage.jsx'
import { AppointmentsPage } from './modules/pages/patient/AppointmentsPage.jsx'
import { AppointmentDetailPage } from './modules/pages/patient/AppointmentDetailPage.jsx'
import { PrescriptionPage } from './modules/pages/patient/PrescriptionPage.jsx'

import { DoctorDashboardPage } from './modules/pages/doctor/DoctorDashboardPage.jsx'
import { SchedulePage } from './modules/pages/doctor/SchedulePage.jsx'
import { QueuePage } from './modules/pages/doctor/QueuePage.jsx'
import { CreatePrescriptionPage } from './modules/pages/doctor/CreatePrescriptionPage.jsx'

import AdminDashboardPage from './modules/pages/admin/AdminDashboardPage.jsx'
import { PendingDoctorsPage } from './modules/pages/admin/PendingDoctorsPage.jsx'
import ProfilePage from './modules/pages/profile/ProfilePage.jsx'

function RoutePlaceholder({ title }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-gray-600">This screen is not implemented yet.</p>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-gray-600">Page not found.</p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<RoutePlaceholder title="Forgot Password" />} />
        <Route
          path="/verify-email/:verificationToken"
          element={<RoutePlaceholder title="Verify Email" />}
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route element={<RoleRoute requiredRole="patient" />}>
              <Route path="/patient" element={<PatientDashboardPage />} />
              <Route
                path="/patient/profile"
                element={<ProfilePage />}
              />
              <Route path="/patient/doctors" element={<DoctorSearchPage />} />
              <Route path="/patient/doctors/:doctorId" element={<DoctorDetailPage />} />
              <Route path="/patient/doctors/:doctorId/book" element={<BookingPage />} />
              <Route path="/patient/appointments" element={<AppointmentsPage />} />
              <Route
                path="/patient/appointments/:appointmentId"
                element={<AppointmentDetailPage />}
              />
              <Route
                path="/patient/prescriptions/:prescriptionId"
                element={<PrescriptionPage />}
              />
            </Route>

            <Route element={<RoleRoute requiredRole="doctor" />}>
              <Route path="/doctor" element={<DoctorDashboardPage />} />
              <Route
                path="/doctor/profile"
                element={<ProfilePage />}
              />
              <Route path="/doctor/schedule" element={<SchedulePage />} />
              <Route path="/doctor/queue" element={<QueuePage />} />
              <Route
                path="/doctor/patients/:patientId"
                element={<RoutePlaceholder title="Patient History" />}
              />
              <Route
                path="/doctor/prescriptions/new"
                element={<CreatePrescriptionPage />}
              />
              <Route
                path="/doctor/appointments/:appointmentId"
                element={<RoutePlaceholder title="Doctor Appointment" />}
              />
            </Route>

            <Route element={<RoleRoute requiredRole="admin" />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/doctors/pending" element={<PendingDoctorsPage />} />
              <Route
                path="/admin/users"
                element={<RoutePlaceholder title="User Management" />}
              />
              <Route
                path="/admin/analytics"
                element={<RoutePlaceholder title="Admin Analytics" />}
              />
              <Route
                path="/admin/doctors/:doctorId"
                element={<RoutePlaceholder title="Doctor Review" />}
              />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
