import React, { useState } from 'react'
import { useListDoctors, useSearchDoctors } from '../../shared/queries/useDoctors'

export default function DoctorSearchPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [specialty, setSpecialty] = useState('')

  // Fetch doctors list with specialty filter
  const { data: listData, isLoading: listLoading, error: listError } = useListDoctors({
    specialty: specialty || undefined
  })

  // Fetch search results if query is supplied
  const { data: searchData, isLoading: searchLoading, error: searchError } = useSearchDoctors(searchTerm)

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value)
  }

  const handleSpecialtyChange = (event) => {
    setSpecialty(event.target.value)
  }

  const isLoading = listLoading || searchLoading
  const error = listError || searchError

  let displayedDoctors = []
  if (searchTerm.length > 2) {
    if (searchData) {
      displayedDoctors = searchData.doctors || []
    }
  } else {
    if (listData) {
      displayedDoctors = listData.doctors || []
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Search Doctors</h1>

      <div className="flex flex-col md:flex-row md:items-center md:space-x-4 mb-6 space-y-3 md:space-y-0">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by doctor name or biography..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full px-4 py-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="w-full md:w-64">
          <select
            value={specialty}
            onChange={handleSpecialtyChange}
            className="w-full px-4 py-2 border border-gray-300 bg-white rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Specialties</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Dermatology">Dermatology</option>
            <option value="Pediatrics">Pediatrics</option>
            <option value="General Medicine">General Medicine</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded">
          Error loading doctors. Please try again.
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading verified medical professionals...</p>
        </div>
      ) : displayedDoctors.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No doctors match your query parameters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedDoctors.map((doctor) => (
            <div key={doctor._id} className="bg-white p-6 rounded shadow border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{doctor.name}</h3>
              <p className="text-blue-600 text-sm font-semibold mb-2">{doctor.specialty}</p>
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">{doctor.bio || 'No biography provided.'}</p>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Rating: {doctor.rating || 'N/A'}</span>
                <span>Fee: ₹{doctor.consultationFee || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
