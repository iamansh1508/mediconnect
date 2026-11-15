import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { Spinner } from '../ui/Spinner.jsx'

export function RoleRoute({ requiredRole, children }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isAuthenticated === false) {
    return <Navigate to="/login" replace />
  }

  if (user === null) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== requiredRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">403</h1>
        <p className="text-lg text-gray-600 mb-4">Access Denied: You do not have permission to view this page.</p>
        <a href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          Go Back Home
        </a>
      </div>
    )
  }

  if (children) {
    return children
  }

  return <Outlet />
}
