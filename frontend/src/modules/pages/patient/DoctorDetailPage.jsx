import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDoctorDetail } from '../../../shared/queries/useDoctors'

function DoctorImage({ imageUrl, name }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`Photo of ${name}`}
        className="w-32 h-32 rounded-full object-cover border-4 border-blue-100 shadow-lg"
      />
    )
  }

  return (
    <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-4xl font-bold shadow-lg">
      {name.charAt(0)}
    </div>
  )
}

function VerificationBadge({ isVerified, isApproved }) {
  if (isVerified && isApproved) {
    return (
      <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-green-200">
        NMC Verified & Approved
      </div>
    )
  }

  if (isVerified) {
    return (
      <div className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-200">
        NMC Verified
      </div>
    )
  }

  if (isApproved) {
    return (
      <div className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-yellow-200">
        Approved
      </div>
    )
  }

  return null
}

function RatingDisplay({ rating, totalReviews }) {
  if (rating) {
    return (
      <div className="flex items-center space-x-1">
        <span className="text-yellow-500">★</span>
        <span className="font-medium">{rating}</span>
        <span className="text-gray-500">({totalReviews} reviews)</span>
      </div>
    )
  }

  return (
    <span className="text-gray-500">No ratings yet</span>
  )
}

function LocationDisplay({ location }) {
  if (location && location.coordinates) {
    return (
      <div className="flex items-center space-x-2 text-gray-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Clinic Location</span>
      </div>
    )
  }

  return null
}

export function DoctorDetailPage() {
  const { doctorId } = useParams()
  const navigate = useNavigate()

  const { data, isLoading, error } = useDoctorDetail(doctorId)

  const handleBookAppointment = () => {
    navigate(`/patient/doctors/${doctorId}/book`)
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
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <h2 className="text-lg font-medium text-red-800">Error Loading Doctor Details</h2>
          <p className="mt-2 text-sm text-red-700">{error.message || 'Please try again later.'}</p>
        </div>
      </div>
    )
  }

  const doctor = data?.doctor || {}

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
            <DoctorImage imageUrl={doctor.imageUrl} name={doctor.name || 'Doctor'} />

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">{doctor.name || 'Doctor Name'}</h1>
                <VerificationBadge
                  isVerified={doctor.isNmcVerified}
                  isApproved={doctor.isApproved}
                />
              </div>
              <p className="text-blue-600 font-semibold mt-1">{doctor.specialty || 'Specialty'}</p>
              <RatingDisplay
                rating={doctor.rating}
                totalReviews={doctor.totalReviews}
              />
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">About</h2>
            <p className="text-gray-600">{doctor.bio || 'No biography available.'}</p>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Consultation Fee</h3>
              <p className="text-xl font-bold text-gray-900 mt-1">₹{doctor.consultationFee || '0'}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Location</h3>
              <LocationDisplay location={doctor.location} />
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={handleBookAppointment}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-150 ease-in-out"
            >
              Book Appointment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
