import React from 'react'

export function DoctorFilters({ specialty, setSpecialty, minRating, setMinRating }) {
  const specialties = [
    'General Medicine',
    'Cardiology',
    'Dermatology',
    'Pediatrics',
    'Orthopedics',
    'Neurology',
    'Gynecology'
  ]

  const ratings = [0, 1, 2, 3, 4, 5]

  const handleSpecialtyChange = (event) => {
    setSpecialty(event.target.value)
  }

  const handleRatingChange = (event) => {
    setMinRating(Number(event.target.value))
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
      <div>
        <h3 className="text-md font-bold text-gray-900 mb-3">Filters</h3>
        <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
        <select
          value={specialty}
          onChange={handleSpecialtyChange}
          className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="">All Specialties</option>
          {specialties.map((spec) => (
            <option key={spec} value={spec}>
              {spec}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
        <select
          value={minRating}
          onChange={handleRatingChange}
          className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          {ratings.map((rate) => (
            <option key={rate} value={rate}>
              {rate === 0 ? 'Any Rating' : `${rate} Stars & Up`}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
