import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../../shared/utils/api'
import { useAuth } from '../../../shared/context/AuthContext.jsx'

function QueueItem({ patient, position, isCurrent, onCallNext }) {
  return (
    <div className={`p-4 rounded-lg shadow-sm border ${isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-gray-900">{patient.name}</h3>
          <p className="text-sm text-gray-500">Appointment at {patient.slotTime}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${isCurrent ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
          {isCurrent ? 'Your Turn' : `Position ${position}`}
        </span>
      </div>
      {isCurrent && (
        <button
          onClick={onCallNext}
          className="mt-3 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
        >
          Call Next Patient
        </button>
      )}
    </div>
  )
}

export function DoctorDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [queue, setQueue] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [profileRes, appointmentsRes, queueRes] = await Promise.all([
        apiClient.get('/doctors/me'),
        apiClient.get('/doctors/appointments/today'),
        apiClient.get('/queue/list', {
          params: {
            date: new Date().toISOString().split('T')[0]
          }
        })
      ])

      setProfile(profileRes.data)
      setAppointments(appointmentsRes.data.appointments || [])
      setQueue(queueRes.data.queue || [])
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCallNext = async () => {
    try {
      await apiClient.post('/queue/call-next')
      fetchDashboardData()
    } catch (err) {
      alert(err.message || 'Failed to call next patient.')
    }
  }

  const handleSetSchedule = () => {
    navigate('/doctor/schedule')
  }

  const handleViewPatientHistory = (patientId) => {
    navigate(`/doctor/patients/${patientId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6 mt-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded shadow-sm">
          <p className="font-semibold">Error Loading Dashboard</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const completedCount = appointments.filter(appt => appt.status === 'completed').length
  const pendingReviewsCount = appointments.filter(appt => appt.status === 'completed' && !appt.reviewSubmitted).length

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome, Dr. {profile?.name || 'Doctor'}</h1>
            <p className="text-blue-600 font-medium">{profile?.specialty || 'Specialty'}</p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-4">
            <button
              onClick={handleSetSchedule}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
            >
              Set Schedule
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-500">Appointments Today</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{appointments.length}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-500">Completed</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{completedCount}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-500">Pending Reviews</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{pendingReviewsCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Queue</h2>
            {queue.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No patients in queue for today.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {queue.map((item, index) => (
                  <QueueItem
                    key={item._id}
                    patient={item.patient}
                    position={index + 1}
                    isCurrent={index === 0}
                    onCallNext={handleCallNext}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Appointments</h2>
            {appointments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No appointments scheduled for today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.slice(0, 5).map((appt) => (
                  <div
                    key={appt._id}
                    className="p-3 rounded-lg bg-gray-50 border border-gray-200"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{appt.patientName}</p>
                        <p className="text-sm text-gray-500">at {appt.slotTime}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${appt.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {appt.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleViewPatientHistory(appt.patientId)}
                      className="mt-2 w-full text-left text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      View Patient History
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
