import React from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/context/AuthContext'

function Layout() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">MediConnect</span>
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  {user?.role === 'patient' && (
                    <>
                      <Link
                        to="/patient/doctors"
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          location.pathname.includes('/patient/doctors')
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        Find Doctors
                      </Link>
                      <Link
                        to="/patient/appointments"
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          location.pathname.includes('/patient/appointments')
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        My Appointments
                      </Link>
                      <Link
                        to="/patient/profile"
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          location.pathname.includes('/patient/profile')
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        Profile
                      </Link>
                    </>
                  )}
                  {user?.role === 'doctor' && (
                    <>
                      <Link
                        to="/doctor/schedule"
                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      >
                        Schedule
                      </Link>
                      <Link
                        to="/doctor/queue"
                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      >
                        Queue
                      </Link>
                      <Link
                        to="/doctor/profile"
                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      >
                        Profile
                      </Link>
                    </>
                  )}
                  {user?.role === 'doctor' && (
                    <Link
                      to="/doctor"
                      className="px-3 py-2 rounded-md text-sm font-medium text-blue-600 bg-blue-50"
                    >
                      Doctor Dashboard
                    </Link>
                  )}
                  {user?.role === 'admin' && (
                    <>
                      <Link
                        to="/admin/doctors/pending"
                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      >
                        Pending Doctors
                      </Link>
                      <Link
                        to="/admin/users"
                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      >
                        Users
                      </Link>
                      <Link
                        to="/admin"
                        className="px-3 py-2 rounded-md text-sm font-medium text-purple-600 bg-purple-50"
                      >
                        Admin
                      </Link>
                    </>
                  )}
                  <div className="flex items-center space-x-2 ml-4">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-sm font-medium">
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">{user?.name}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            © 2026 MediConnect. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
