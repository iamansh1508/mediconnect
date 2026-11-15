import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../shared/context/AuthContext.jsx'

export function LoginPage() {
  const { login, isLoading } = useAuth()
  const navigate = useNavigate()

  const [emailValue, setEmailValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [localErrorMessage, setLocalErrorMessage] = useState('')

  const handleFormSubmit = async (event) => {
    event.preventDefault()
    setLocalErrorMessage('')

    if (emailValue.trim() === '') {
      setLocalErrorMessage('Email is a required field.')
      return
    }

    if (passwordValue.trim() === '') {
      setLocalErrorMessage('Password is a required field.')
      return
    }

    const loggedInUser = await login(emailValue.trim(), passwordValue)

    if (loggedInUser) {
      const userRole = loggedInUser.role.toLowerCase()

      if (userRole === 'admin') {
        navigate('/admin', { replace: true })
        return
      }

      if (userRole === 'doctor') {
        navigate('/doctor', { replace: true })
        return
      }

      navigate('/patient', { replace: true })
      return
    }

    setLocalErrorMessage('Invalid email or password. Check that the backend is running on port 5180.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to MediConnect
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleFormSubmit}>
          {localErrorMessage !== '' && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded text-sm text-red-700">
              {localErrorMessage}
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                disabled={isLoading}
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password-field" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password-field"
                name="password"
                type="password"
                autoComplete="current-password"
                disabled={isLoading}
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Sign In
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
