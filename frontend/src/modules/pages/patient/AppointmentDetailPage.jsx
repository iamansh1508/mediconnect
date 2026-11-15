import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../../../shared/utils/api'
import { useSocket } from '../../../shared/context/SocketContext.jsx'

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
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${badgeColor}`}>
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
    <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${badgeColor}`}>
      Payment: {paymentStatus || 'pending'}
    </span>
  )
}

export function AppointmentDetailPage() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const socket = useSocket()

  const [appointment, setAppointment] = useState(null)
  const [queuePosition, setQueuePosition] = useState(null)
  const [isCalled, setIsCalled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSocketConnected, setIsSocketConnected] = useState(false)

  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewSuccess, setReviewSuccess] = useState(false)

  useEffect(() => {
    fetchAppointmentDetails()
  }, [appointmentId])

  useEffect(() => {
    if (appointment && appointment.status === 'in-queue') {
      fetchQueuePosition()
    }
  }, [appointment])

  useEffect(() => {
    if (!socket) {
      return
    }

    setIsSocketConnected(true)

    socket.on('queue_updated', (data) => {
      if (data.appointmentId === appointmentId) {
        fetchQueuePosition()
      }
    })

    socket.on('patient_called', (data) => {
      if (data.appointmentId === appointmentId) {
        setIsCalled(true)
        setAppointment((prev) => {
          if (prev) {
            return { ...prev, status: 'called' }
          }
          return prev
        })
      }
    })

    return () => {
      socket.off('queue_updated')
      socket.off('patient_called')
    }
  }, [socket, appointmentId])

  const fetchAppointmentDetails = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.get('/appointments/my')
      const found = response.data.appointments.find((appt) => appt._id === appointmentId)
      if (found) {
        setAppointment(found)
      } else {
        setError('Appointment details not found in your record.')
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch details.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchQueuePosition = async () => {
    try {
      const response = await apiClient.get(`/appointments/${appointmentId}/queue`)
      setQueuePosition(response.data.position)
    } catch (err) {
      console.warn('Queue positioning not active or returned error:', err.message)
    }
  }

  const handleCancel = async () => {
    const confirmCancel = window.confirm('Are you sure you want to cancel this appointment?')
    if (!confirmCancel) {
      return
    }

    try {
      await apiClient.delete(`/appointments/${appointmentId}`)
      fetchAppointmentDetails()
    } catch (err) {
      alert(err.message || 'Cancellation failed.')
    }
  }

  const handleReviewSubmit = async (event) => {
    event.preventDefault()
    setIsSubmittingReview(true)
    try {
      await apiClient.post(`/appointments/reviews/${appointment.doctorId}`, {
        rating: reviewRating,
        comment: reviewComment,
      })
      setReviewSuccess(true)
    } catch (err) {
      alert(err.message || 'Failed to submit review.')
    } finally {
      setIsSubmittingReview(false)
    }
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
      <div className="max-w-3xl mx-auto p-6 mt-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded shadow-sm">
          <p className="font-semibold">Error Loading Appointment Details</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dr. {appointment.doctorName || 'Doctor'}</h1>
            <p className="text-blue-600 font-medium">{appointment.specialty || 'General medicine'}</p>
          </div>
          <div className="flex space-x-2 mt-4 md:mt-0">
            <StatusBadge status={appointment.status} />
            <PaymentStatusBadge paymentStatus={appointment.paymentStatus} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <p className="text-gray-400">Appointment Date</p>
            <p className="font-semibold text-gray-900 mt-1">{appointment.appointmentDate}</p>
          </div>
          <div>
            <p className="text-gray-400">Time Slot</p>
            <p className="font-semibold text-gray-900 mt-1">{appointment.slotStartTime} - {appointment.slotEndTime}</p>
          </div>
          <div>
            <p className="text-gray-400">Consultation Fee</p>
            <p className="font-semibold text-gray-900 mt-1">₹{appointment.consultationFee || 0}</p>
          </div>
          <div>
            <p className="text-gray-400">Real-time Sync status</p>
            <p className="font-semibold text-gray-900 mt-1">
              {isSocketConnected ? (
                <span className="text-green-600">Connected</span>
              ) : (
                <span className="text-gray-500">Connecting...</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {appointment.status === 'in-queue' && (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg text-center">
          <h2 className="text-xl font-bold text-blue-900">Queue Status</h2>
          {isCalled ? (
            <p className="text-green-600 font-extrabold text-2xl mt-4 animate-bounce">
              Your turn has come! Please proceed to the cabin.
            </p>
          ) : (
            <div className="mt-4">
              <p className="text-gray-600">Your Current Queue Position</p>
              <p className="text-4xl font-extrabold text-blue-800 mt-2">{queuePosition || 'Calculating...'}</p>
            </div>
          )}
        </div>
      )}

      {appointment.status === 'completed' && appointment.prescriptionId && (
        <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-lg flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-indigo-900">Prescription Available</h2>
            <p className="text-sm text-gray-600 mt-1">Your consultation is completed. View or download your prescription below.</p>
          </div>
          <button
            onClick={() => navigate(`/patient/prescriptions/${appointment.prescriptionId}`)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded shadow transition-colors"
          >
            View Prescription
          </button>
        </div>
      )}

      {appointment.status === 'completed' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Leave a Review</h2>
          {reviewSuccess ? (
            <p className="text-green-600 font-medium">Thank you for your review!</p>
          ) : (
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                >
                  <option value={5}>5 Stars (Excellent)</option>
                  <option value={4}>4 Stars (Good)</option>
                  <option value={3}>3 Stars (Average)</option>
                  <option value={2}>2 Stars (Poor)</option>
                  <option value={1}>1 Star (Very Poor)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Feedback</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={3}
                  placeholder="Share your consultation experience..."
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingReview}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
              >
                {isSubmittingReview ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          )}
        </div>
      )}

      {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
        <div className="flex justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 font-semibold rounded shadow-sm transition-colors"
          >
            Cancel Appointment
          </button>
        </div>
      )}
    </div>
  )
}
