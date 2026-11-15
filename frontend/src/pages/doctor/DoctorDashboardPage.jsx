import React, { useState, useEffect } from 'react'
import apiClient from '../../shared/utils/api'
import { useAuth } from '../../shared/context/AuthContext.jsx'

export default function DoctorDashboardPage() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAppointmentsToday()
  }, [])

  const fetchAppointmentsToday = async () => {
    try {
      const response = await apiClient.get('/doctors/appointments/today')
      setAppointments(response.data.appointments || [])
    } catch (err) {
      console.error('Failed to fetch today appointments:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCallNext = async (appointmentId) => {
    try {
      await apiClient.put(`/doctors/appointments/${appointmentId}/call-next`)
      fetchAppointmentsToday()
    } catch (err) {
      console.error('Failed to call next patient:', err)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Doctor Dashboard</h1>
      <div className="bg-white p-6 rounded shadow border border-gray-200 mb-6">
        <h2 className="text-xl font-semibold mb-2">Dr. {user?.name}</h2>
        <p className="text-gray-600">Email: {user?.email}</p>
      </div>

      <div className="bg-white p-6 rounded shadow border border-gray-200">
        <h3 className="text-xl font-bold mb-4">Today's Appointments Queue</h3>
        {isLoading ? (
          <p className="text-gray-500">Loading today's schedule...</p>
        ) : appointments.length === 0 ? (
          <p className="text-gray-500">No appointments scheduled for today.</p>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <div key={appointment._id} className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="font-semibold">{appointment.patientName || 'Patient'}</p>
                  <p className="text-sm text-gray-500">Time: {appointment.slotTime || 'Scheduled'}</p>
                  <p className="text-xs text-blue-600">Status: {appointment.status}</p>
                </div>
                <button
                  onClick={() => handleCallNext(appointment._id)}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Call Next Patient
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
