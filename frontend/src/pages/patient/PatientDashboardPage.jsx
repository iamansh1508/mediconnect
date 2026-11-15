import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../shared/context/AuthContext.jsx'

export default function PatientDashboardPage() {
  const { user } = useAuth()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Patient Portal</h1>
      <div className="bg-white p-6 rounded shadow border border-gray-200 mb-6">
        <h2 className="text-xl font-semibold mb-2">Welcome, {user?.name}</h2>
        <p className="text-gray-600">Email: {user?.email}</p>
        <p className="text-gray-600">Username: {user?.username}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded shadow border border-gray-200">
          <h3 className="text-lg font-bold mb-2">My Appointments</h3>
          <p className="text-gray-600 mb-4">View and track your scheduled doctor visits.</p>
          <Link to="/patient/appointments" className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            View Appointments
          </Link>
        </div>
        <div className="bg-white p-6 rounded shadow border border-gray-200">
          <h3 className="text-lg font-bold mb-2">Find Doctors</h3>
          <p className="text-gray-600 mb-4">Search specialists and book new consultations.</p>
          <Link to="/patient/doctors" className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Search Doctors
          </Link>
        </div>
      </div>
    </div>
  )
}
