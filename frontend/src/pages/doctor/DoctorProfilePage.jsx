import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDoctorDetail, useDoctorSchedule } from '../../shared/queries/useDoctors'

export default function DoctorProfilePage() {
  const { id } = useParams()
  const currentDate = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(currentDate)

  const { data: detailData, isLoading: detailLoading, error: detailError } = useDoctorDetail(id)
  const { data: scheduleData, isLoading: scheduleLoading, error: scheduleError } = useDoctorSchedule(id, selectedDate)

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value)
  }

  const isLoading = detailLoading || scheduleLoading
  const error = detailError || scheduleError

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-600">Loading doctor profile and available slots...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-12 text-center bg-red-50 text-red-700 rounded">
        Failed to load doctor details.
      </div>
    )
  }

  const doctor = detailData?.doctor || {}
  const slots = scheduleData?.slots || []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded shadow border border-gray-200 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">{doctor.name}</h1>
        <p className="text-blue-600 font-semibold mb-3">{doctor.specialty}</p>
        <p className="text-gray-700 mb-4">{doctor.bio || 'Experienced healthcare specialist ready to assist you.'}</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded text-sm text-gray-700">
          <div>
            <span className="block text-gray-400">Consultation Fee</span>
            <span className="font-bold">₹{doctor.consultationFee || 0}</span>
          </div>
          <div>
            <span className="block text-gray-400">Rating</span>
            <span className="font-bold">{doctor.rating || 'N/A'} ({doctor.totalReviews || 0} reviews)</span>
          </div>
          <div>
            <span className="block text-gray-400">NMC Verification</span>
            <span className="font-bold">{doctor.isNmcVerified ? 'Verified' : 'Pending'}</span>
          </div>
          <div>
            <span className="block text-gray-400">Approval Status</span>
            <span className="font-bold">{doctor.isApproved ? 'Approved' : 'Under Review'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Available Time Slots</h2>
          <div className="mt-2 md:mt-0">
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>

        {slots.length === 0 ? (
          <p className="text-gray-500 py-4">No available time slots found for {selectedDate}.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {slots.map((slot, index) => (
              <div
                key={index}
                className="p-3 border border-blue-200 bg-blue-50 text-blue-800 text-center rounded font-medium shadow-sm"
              >
                {slot.time || slot}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
