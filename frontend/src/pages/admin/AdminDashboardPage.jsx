import React, { useState, useEffect } from 'react'
import apiClient from '../../shared/utils/api'

export default function AdminDashboardPage() {
  const [pendingDoctors, setPendingDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPendingDoctors()
  }, [])

  const fetchPendingDoctors = async () => {
    try {
      const response = await apiClient.get('/admin/doctors/pending')
      setPendingDoctors(response.data.doctors || [])
    } catch (err) {
      console.error('Failed to fetch pending doctors:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (id) => {
    try {
      await apiClient.put(`/admin/doctors/${id}/approve`)
      fetchPendingDoctors()
    } catch (err) {
      console.error('Approval failed:', err)
    }
  }

  const handleReject = async (id) => {
    try {
      await apiClient.put(`/admin/doctors/${id}/reject`)
      fetchPendingDoctors()
    } catch (err) {
      console.error('Rejection failed:', err)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
      <div className="bg-white p-6 rounded shadow border border-gray-200">
        <h2 className="text-xl font-bold mb-4">Pending Doctor Approvals</h2>
        {isLoading ? (
          <p className="text-gray-500">Loading pending doctors...</p>
        ) : pendingDoctors.length === 0 ? (
          <p className="text-gray-500">No doctors pending approval.</p>
        ) : (
          <div className="space-y-4">
            {pendingDoctors.map((doc) => (
              <div key={doc._id} className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="font-semibold">{doc.name}</p>
                  <p className="text-sm text-gray-500">Email: {doc.email}</p>
                  <p className="text-xs text-gray-400">Specialty: {doc.specialty || 'General'}</p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleApprove(doc._id)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(doc._id)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
