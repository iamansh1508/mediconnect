import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../../shared/utils/api'

function StatusBadge({ status }) {
  let badgeColor = 'bg-gray-100 text-gray-800'
  if (status === 'confirmed') {
    badgeColor = 'bg-green-100 text-green-800'
  } else if (status === 'in-queue') {
    badgeColor = 'bg-blue-100 text-blue-800'
  } else if (status === 'completed') {
    badgeColor = 'bg-indigo-100 text-indigo-800'
  } else if (status === 'cancelled') {
    badgeColor = 'bg-red-100 text-red-800'
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${badgeColor}`}>
      {status}
    </span>
  )
}

function PaymentStatusBadge({ paymentStatus }) {
  let badgeColor = 'bg-yellow-100 text-yellow-800'
  if (paymentStatus === 'completed' || paymentStatus === 'successful') {
    badgeColor = 'bg-green-100 text-green-800'
  } else if (paymentStatus === 'failed') {
    badgeColor = 'bg-red-100 text-red-800'
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${badgeColor}`}>
      Payment: {paymentStatus || 'pending'}
    </span>
  )
}

export function AppointmentsPage() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterType, setFilterType] = useState('all') // all, upcoming, past

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.get('/appointments/my')
      setAppointments(response.data.appointments || [])
    } catch (err) {
      setError(err.message || 'Failed to fetch appointments. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelAppointment = async (appointmentId, event) => {
    event.stopPropagation()
    const confirmCancel = window.confirm('Are you sure you want to cancel this appointment?')
    if (!confirmCancel) {
      return
    }

    try {
      await apiClient.delete(`/appointments/${appointmentId}`)
      fetchAppointments()
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment.')
    }
  }

  const handleViewDetails = (appointmentId) => {
    navigate(`/patient/appointments/${appointmentId}`)
  }

  const handleViewPrescription = (prescriptionId, event) => {
    event.stopPropagation()
    navigate(`/patient/prescriptions/${prescriptionId}`)
  }

  const filteredAppointments = appointments.filter((appt) => {
    const appointmentDate = new Date(appt.appointmentDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (filterType === 'upcoming') {
      return appointmentDate >= today && appt.status !== 'cancelled'
    } else if (filterType === 'past') {
      return appointmentDate < today || appt.status === 'completed' || appt.status === 'cancelled'
    }
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 mt-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700">
          <p className="font-semibold">Error Loading Appointments</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchAppointments}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
          >
            Retry Fetch
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 space-y-4 md:space-y-0">
        <h1 className="text-3xl font-extrabold text-gray-900">My Appointments</h1>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filterType === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('upcoming')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filterType === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilterType('past')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filterType === 'past' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Past & Cancelled
          </button>
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No appointments found matching this filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((appt) => (
            <div
              key={appt._id}
              onClick={() => handleViewDetails(appt._id)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0"
            >
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-bold text-gray-900">Dr. {appt.doctorName || 'Doctor'}</h3>
                  <StatusBadge status={appt.status} />
                </div>
                <div className="text-sm text-gray-600">
                  <p>Date: {appt.appointmentDate}</p>
                  <p>Time Slot: {appt.slotStartTime} - {appt.slotEndTime}</p>
                </div>
              </div>

              <div className="flex flex-col md:items-end space-y-2">
                <div className="flex items-center space-x-2">
                  <PaymentStatusBadge paymentStatus={appt.paymentStatus} />
                  <span className="font-semibold text-gray-900 text-sm">Fee: ₹{appt.consultationFee || 0}</span>
                </div>

                <div className="flex items-center space-x-2 pt-2 md:pt-0">
                  {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                    <button
                      onClick={(event) => handleCancelAppointment(appt._id, event)}
                      className="px-3 py-1.5 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold rounded transition-colors"
                    >
                      Cancel Appointment
                    </button>
                  )}

                  {appt.status === 'completed' && appt.prescriptionId && (
                    <button
                      onClick={(event) => handleViewPrescription(appt.prescriptionId, event)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition-colors"
                    >
                      View Prescription
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
