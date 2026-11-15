import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListDoctors } from '../../../shared/queries/useDoctors'
import { DoctorFilters } from '../../patient/components/DoctorFilters.jsx'
import { DoctorList } from '../../patient/components/DoctorList.jsx'

export function DoctorSearchPage() {
  const navigate = useNavigate()

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  // Filter state
  const [specialty, setSpecialty] = useState('')
  const [minRating, setMinRating] = useState(0)

  // Pagination state
  const [cursor, setCursor] = useState(null)
  const [page, setPage] = useState(1)

  // Debounce search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => {
      clearTimeout(timerId)
    }
  }, [searchTerm])

  // Fetch doctors with filters and pagination
  const { data, isLoading, error } = useListDoctors({
    specialty: specialty || undefined,
    minRating: minRating || undefined,
    q: debouncedSearchTerm || undefined,
    cursor: cursor || undefined,
    limit: 12
  })

  const doctors = data?.doctors || []
  const pagination = data?.pagination || {}

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value)
    setPage(1)
    setCursor(null)
  }

  const handleDoctorClick = (doctorId) => {
    navigate(`/patient/doctors/${doctorId}`)
  }

  const handleNextPage = () => {
    if (pagination.nextCursor) {
      setCursor(pagination.nextCursor)
      setPage(page + 1)
    }
  }

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1)
      // In a real app, you would need to track previous cursors
      // This is simplified for the example
      setCursor(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Find Medical Professionals</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or specialty..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-64">
          <DoctorFilters
            specialty={specialty}
            setSpecialty={setSpecialty}
            minRating={minRating}
            setMinRating={setMinRating}
          />
        </div>

        <div className="flex-1">
          <DoctorList
            doctors={doctors}
            onDoctorClick={handleDoctorClick}
            isLoading={isLoading}
            error={error}
          />

          <div className="mt-8 flex items-center justify-between">
            <div>
              {pagination.total && (
                <p className="text-sm text-gray-600">
                  Showing {(page - 1) * 12 + 1}-{Math.min(page * 12, pagination.total)} of {pagination.total} doctors
                </p>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handlePreviousPage}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={!pagination.hasNextPage}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
