import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../../shared/utils/api'

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.get('/admin/analytics')
      setAnalytics(response.data)
    } catch (err) {
      setError(err.message || 'Failed to load analytics.')
    } finally {
      setIsLoading(false)
    }
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
      <div className="max-w-6xl mx-auto p-6 mt-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded shadow-sm">
          <p className="font-semibold">Error Loading Admin Dashboard</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const statCards = [
    { title: 'Total Users', value: analytics?.totalUsers || 0 },
    { title: 'Total Doctors', value: analytics?.totalDoctors || 0 },
    { title: 'Total Appointments', value: analytics?.totalAppointments || 0 },
    { title: 'Total Revenue', value: `₹${analytics?.totalRevenue || 0}` }
  ]

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-500">{stat.title}</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => navigate('/admin/doctors/pending')}>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Pending Approvals</h3>
          <p className="text-gray-600">Review doctor registrations.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => navigate('/admin/analytics')}>
          <h3 className="text-lg font-bold text-gray-900 mb-2">User Management</h3>
          <p className="text-gray-600">Manage user accounts and status.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => navigate('/admin/users')}>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Detailed Analytics</h3>
          <p className="text-gray-600">View performance insights.</p>
        </div>
      </div>
    </div>
  )
}
