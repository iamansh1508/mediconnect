import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../../shared/utils/api'

function DoctorCard({ doctor, onApprove, onReject, onViewDetails }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{doctor.name}</h3>
          <p className="text-blue-600 font-medium">{doctor.specialty || 'Specialty'}</p>
          <p className="text-gray-600 mt-1">{doctor.email}</p>
          <p className="text-gray-500 text-sm mt-2">NMC Reg: {doctor.nmcRegistrationNumber || 'Not provided'}</p>
        </div>
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Pending Approval
        </span>
      </div>

      <div className="mt-4 flex space-x-2">
        <button
          onClick={() => onViewDetails(doctor._id)}
          className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-medium transition-colors"
        >
          View Details
        </button>
        <button
          onClick={() => onApprove(doctor._id)}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => onReject(doctor._id)}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  )
}

export function PendingDoctorsPage() {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPendingDoctors()
  }, [])

  const fetchPendingDoctors = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.get('/admin/doctors/pending')
      setDoctors(response.data.doctors || [])
    } catch (err) {
      setError(err.message || 'Failed to load pending doctors.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (doctorId) => {
    const confirmApprove = window.confirm('Are you sure you want to approve this doctor?')
    if (!confirmApprove) {
      return
    }

    try {
      await apiClient.put(`/admin/doctors/${doctorId}/approve`)
      fetchPendingDoctors()
    } catch (err) {
      alert(err.message || 'Approval failed.')
    }
  }

  const handleReject = async (doctorId) => {
    const reason = window.prompt('Please provide a reason for rejection:')
    if (reason === null) {
      return
    }

    try {
      await apiClient.put(`/admin/doctors/${doctorId}/reject`, {
        reason: reason.trim()
      })
      fetchPendingDoctors()
    } catch (err) {
      alert(err.message || 'Rejection failed.')
    }
  }

  const handleViewDetails = (doctorId) => {
    navigate(`/admin/doctors/${doctorId}`)
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
      <div className="max-w-4xl mx-auto p-6 mt-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded shadow-sm">
          <p className="font-semibold">Error Loading Pending Doctors</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchPendingDoctors}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pending Doctor Approvals</h1>
        <button
          onClick={() => navigate('/admin')}
          className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-medium transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {doctors.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No pending doctor approvals at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {doctors.map((doctor) => (
            <DoctorCard
              key={doctor._id}
              doctor={doctor}
              onApprove={handleApprove}
              onReject={handleReject}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  )
}
