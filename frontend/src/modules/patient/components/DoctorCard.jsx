import React from 'react'

export function DoctorCard({ doctor, onClick }) {
  let displayBio = 'No biography provided.'
  if (doctor.bio) {
    displayBio = doctor.bio
  }

  let ratingText = 'N/A'
  if (doctor.rating) {
    ratingText = doctor.rating + ' ★'
  }

  let feeText = 'Free'
  if (doctor.consultationFee) {
    feeText = '₹' + doctor.consultationFee
  }

  return (
    <div
      onClick={onClick}
      className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{doctor.name}</h3>
            <p className="text-blue-600 text-sm font-semibold">{doctor.specialty || 'General Practitioner'}</p>
          </div>
          <div className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200">
            {ratingText}
          </div>
        </div>
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{displayBio}</p>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-100">
        <div>
          <span className="text-gray-400">Fee: </span>
          <span className="font-bold text-gray-900">{feeText}</span>
        </div>
        <div className="flex items-center space-x-2">
          {doctor.isNmcVerified && (
            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-medium border border-green-200">
              NMC Verified
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
