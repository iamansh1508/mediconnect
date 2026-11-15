import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDoctorDetail, useDoctorSchedule } from '../../../shared/queries/useDoctors'
import { useAuth } from '../../../shared/context/AuthContext.jsx'
import apiClient from '../../../shared/utils/api'

function DateSelector({ selectedDate, setSelectedDate, minDate }) {
  const handleDateChange = (event) => {
    setSelectedDate(event.target.value)
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">Select Appointment Date</label>
      <input
        type="date"
        value={selectedDate}
        onChange={handleDateChange}
        min={minDate}
        className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  )
}

function SlotSelector({ slots, selectedSlot, setSelectedSlot, consultationFee }) {
  if (!slots || slots.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No available slots for this date. Please select another date.</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Available Time Slots</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {slots.map((slot, index) => {
          let buttonClass = 'p-3 rounded-md text-sm font-medium transition-colors '
          if (selectedSlot === slot) {
            buttonClass += 'bg-blue-600 text-white'
          } else if (slot.isBooked) {
            buttonClass += 'bg-gray-100 text-gray-400 cursor-not-allowed'
          } else {
            buttonClass += 'bg-blue-50 text-blue-700 hover:bg-blue-100'
          }

          return (
            <button
              key={index}
              onClick={() => setSelectedSlot(slot)}
              disabled={slot.isBooked}
              className={buttonClass}
            >
              {slot.startTime} - {slot.endTime} {slot.isBooked ? '(BOOKED)' : ''}
            </button>
          )
        })}
      </div>
      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <p className="text-gray-700">Consultation Fee: <span className="font-bold">₹{consultationFee}</span></p>
      </div>
    </div>
  )
}

export function BookingPage() {
  const { doctorId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedSlot, setSelectedSlot] = useState(null)

  const [isBooking, setIsBooking] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [bookingError, setBookingError] = useState(null)
  const [appointmentId, setAppointmentId] = useState(null)
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState(null)

  const { data: doctorData, isLoading: isLoadingDoctor } = useDoctorDetail(doctorId)
  const { data: scheduleData, isLoading: isLoadingSlots } = useDoctorSchedule(doctorId, selectedDate)

  const doctor = doctorData?.doctor || {}
  const slots = scheduleData?.slots || []

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => {
        resolve(true)
      }
      script.onerror = () => {
        resolve(false)
      }
      document.body.appendChild(script)
    })
  }

  const handleBookAppointment = async () => {
    if (!selectedSlot) {
      setBookingError('Please select a time slot')
      return
    }

    setIsBooking(true)
    setBookingError(null)

    try {
      const idempotencyKey = crypto.randomUUID()
      const response = await apiClient.post('/appointments/book', {
        doctorId,
        appointmentDate: selectedDate,
        slotStartTime: selectedSlot.startTime,
        slotEndTime: selectedSlot.endTime,
        idempotencyKey
      })

      setAppointmentId(response.data.appointmentId)
    } catch (error) {
      if (error.response) {
        if (error.response.status === 409) {
          setBookingError('This slot has been booked. Please select another slot.')
        } else if (error.response.status === 401) {
          navigate('/login')
        } else {
          setBookingError(error.response.data.message || 'Failed to book appointment. Please try again.')
        }
      } else {
        setBookingError('Network error. Please check your connection and try again.')
      }
    } finally {
      setIsBooking(false)
    }
  }

  const handleProceedToPayment = async () => {
    setIsPaying(true)
    setBookingError(null)

    try {
      const isScriptLoaded = await loadRazorpayScript()
      if (!isScriptLoaded) {
        setBookingError('Razorpay SDK failed to load. Please check your internet connection.')
        setIsPaying(false)
        return
      }

      const paymentResponse = await apiClient.post('/payments/initiate', {
        appointmentId,
        amount: doctor.consultationFee || 500
      })

      const { orderId, amount, currency } = paymentResponse.data

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_dummykey',
        amount: amount,
        currency: currency,
        name: 'MediConnect',
        description: `Consultation with Dr. ${doctor.name}`,
        order_id: orderId,
        handler: async (response) => {
          setPaymentSuccessMessage('Payment successful! Confirming appointment status...')
          setTimeout(() => {
            navigate(`/patient/appointments/${appointmentId}`)
          }, 1500)
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#2563EB',
        },
      }

      const razorpayInstance = new window.Razorpay(options)
      razorpayInstance.on('payment.failed', (response) => {
        setBookingError('Payment failed: ' + response.error.description)
        setIsPaying(false)
      })
      razorpayInstance.open()
    } catch (error) {
      if (error.response) {
        setBookingError(error.response.data.message || 'Failed to initiate payment.')
      } else {
        setBookingError('Network error during payment initiation.')
      }
    } finally {
      setIsPaying(false)
    }
  }

  if (isLoadingDoctor) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Book Appointment</h1>

        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Dr. {doctor.name}</h2>
          <p className="text-blue-600">{doctor.specialty}</p>
        </div>

        {appointmentId ? (
          <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center space-y-4">
            <h3 className="text-xl font-bold text-green-800">Appointment Booked Successfully!</h3>
            <p className="text-gray-700">Appointment ID: <span className="font-mono font-semibold">{appointmentId}</span></p>
            <p className="text-gray-700">Consultation Fee: <span className="font-bold">₹{doctor.consultationFee || 0}</span></p>

            {paymentSuccessMessage ? (
              <div className="p-3 bg-blue-100 text-blue-800 rounded font-medium">
                {paymentSuccessMessage}
              </div>
            ) : (
              <button
                onClick={handleProceedToPayment}
                disabled={isPaying}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
              >
                {isPaying ? 'Processing Payment...' : 'Proceed to Payment'}
              </button>
            )}
          </div>
        ) : (
          <>
            <DateSelector
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              minDate={today}
            />

            {isLoadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-gray-600">Loading available slots...</p>
              </div>
            ) : (
              <SlotSelector
                slots={slots}
                selectedSlot={selectedSlot}
                setSelectedSlot={setSelectedSlot}
                consultationFee={doctor.consultationFee || 0}
              />
            )}

            {bookingError && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                {bookingError}
              </div>
            )}

            <button
              onClick={handleBookAppointment}
              disabled={!selectedSlot || isBooking}
              className={`mt-6 w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
                selectedSlot && !isBooking
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {isBooking ? 'Processing Booking...' : 'Confirm Appointment'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
