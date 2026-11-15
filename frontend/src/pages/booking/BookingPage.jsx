import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../shared/context/AuthContext'
import { bookAppointment } from '../../services/appointmentService'
import { fetchDoctorById } from '../../services/doctorService'
import { toast } from 'react-hot-toast'

function BookingPage() {
  const { id: doctorId } = useParams()
  const [searchParams] = useSearchParams()
  const selectedDate = searchParams.get('date')
  const { isAuthenticated, user } = useAuth()
  const [slot, setSlot] = useState(null)
  const [isBooking, setIsBooking] = useState(false)

  const { data: doctorData, isLoading } = useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: () => fetchDoctorById(doctorId),
    enabled: !!doctorId,
  })

  const doctor = doctorData?.doctor

  const handleSelectSlot = (timeSlot) => {
    setSlot(timeSlot)
  }

  const handleConfirmBooking = async () => {
    if (!slot) {
      toast.error('Please select a time slot')
      return
    }

    setIsBooking(true)
    const success = await bookAppointment({
      doctorId,
      date: selectedDate,
      timeSlot: slot,
    })
    setIsBooking(false)

    if (success) {
      toast.success('Appointment booked successfully!')
      // Redirect to payments or appointments page
    } else {
      toast.error('Failed to book appointment. Please try again.')
    }
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!doctor) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Doctor not found</p>
      </div>
    )
  }

  // Parse selected date
  const selectedDateObj = new Date(selectedDate)
  const formattedDate = selectedDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Sample time slots (would come from doctor's schedule in real app)
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Book Appointment</h1>
        
        <div className="space-y-4">
          {/* Doctor Info */}
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold">
              {doctor.doctorName?.[0] || 'D'}
            </div>
            <div>
              <p className="font-medium text-gray-900">Dr. {doctor.doctorName}</p>
              <p className="text-sm text-gray-600">{doctor.specialty}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-bold text-gray-900">₹{doctor.consultationFee}</p>
              <p className="text-sm text-gray-500">consultation</p>
            </div>
          </div>

          {/* Date Display */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Selected Date</p>
            <p className="font-medium text-gray-900">{formattedDate}</p>
          </div>

          {/* Time Slot Selection */}
          <div>
            <p className="font-medium text-gray-900 mb-3">Select Time Slot</p>
            <div className="grid grid-cols-3 gap-2">
              {timeSlots.map((slotTime) => (
                <button
                  key={slotTime}
                  onClick={() => handleSelectSlot(slotTime)}
                  className={`py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    slot === slotTime
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 hover:border-blue-300 text-gray-700'
                  }`}
                >
                  {slotTime}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleConfirmBooking}
          disabled={!slot || isBooking}
          className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isBooking ? 'Booking...' : `Confirm - ₹${doctor.consultationFee}`}
        </button>
      </div>
    </div>
  )
}

export default BookingPage
