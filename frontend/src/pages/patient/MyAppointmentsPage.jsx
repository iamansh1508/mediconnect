import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { cancelAppointment } from '../../services/appointmentService'
import { toast } from 'react-hot-toast'

function MyAppointmentsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['myAppointments'],
    queryFn: async () => {
      const response = await fetch('/api/v1/appointments/my', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })
      return response.json()
    },
  })

  const appointments = data?.appointments || []

  const handleCancel = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return
    }

    try {
      await cancelAppointment(appointmentId)
      toast.success('Appointment cancelled successfully')
      refetch()
    } catch (error) {
      toast.error('Failed to cancel appointment')
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      booked: 'bg-blue-100 text-blue-700',
      'in-queue': 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load appointments</p>
        <button
          onClick={refetch}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No appointments yet</p>
        <a
          href="/patient/doctors"
          className="mt-4 inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Find a Doctor
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
      
      <div className="space-y-4">
        {appointments.map((appointment) => (
          <div
            key={appointment._id}
            className="bg-white rounded-xl shadow-sm border p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">
                  Dr. {appointment.doctorId?.doctorName || 'Doctor'}
                </p>
                <p className="text-sm text-gray-600">{appointment.doctorId?.specialty}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(appointment.status)}`}>
                {appointment.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium text-gray-900">
                  {new Date(appointment.date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Time</p>
                <p className="font-medium text-gray-900">{appointment.timeSlot}</p>
              </div>
              <div>
                <p className="text-gray-500">Fee</p>
                <p className="font-medium text-gray-900">₹{appointment.consultationFee}</p>
              </div>
              <div>
                <p className="text-gray-500">Status</p>
                <p className="font-medium text-gray-900 capitalize">{appointment.paymentStatus}</p>
              </div>
            </div>

            {appointment.status !== 'cancelled' && (
              <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
                {appointment.status === 'booked' && (
                  <button
                    onClick={() => handleCancel(appointment._id)}
                    className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Cancel Appointment
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MyAppointmentsPage
