import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { Spinner } from '../ui/Spinner.jsx'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

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

  if (children) {
    return children
  }

  return <Outlet />
}
