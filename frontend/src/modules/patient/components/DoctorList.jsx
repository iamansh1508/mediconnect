import React from 'react'
import { DoctorCard } from './DoctorCard.jsx'

export function DoctorList({ doctors, onDoctorClick, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-gray-600">Loading doctors...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border-l-4 border-red-500 text-red-700">
        <p className="font-medium">Failed to load doctors</p>
        <p className="mt-1 text-sm">{error.message || 'Please try again later.'}</p>
      </div>
    )
  }

  if (doctors.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No doctors found matching your criteria.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {doctors.map((doctor) => (
        <DoctorCard
          key={doctor._id}
          doctor={doctor}
          onClick={() => onDoctorClick(doctor._id)}
        />
      ))}
    </div>
  )
}
