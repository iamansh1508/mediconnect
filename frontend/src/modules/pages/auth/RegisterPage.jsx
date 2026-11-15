import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import apiClient from '../../../shared/utils/api.js'

export function RegisterPage() {
  const navigate = useNavigate()

  const [nameValue, setNameValue] = useState('')
  const [emailValue, setEmailValue] = useState('')
  const [usernameValue, setUsernameValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('')
  const [roleValue, setRoleValue] = useState('patient')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleFormSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (nameValue.trim() === '') {
      setErrorMessage('Full Name is required.')
      return
    }

    if (emailValue.trim() === '') {
      setErrorMessage('Email address is required.')
      return
    }

    if (usernameValue.trim() === '') {
      setErrorMessage('Username is required.')
      return
    }

    if (passwordValue.trim() === '') {
      setErrorMessage('Password is required.')
      return
    }

    if (passwordValue !== confirmPasswordValue) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      const payload = {
        name: nameValue,
        email: emailValue,
        username: usernameValue,
        password: passwordValue,
        role: roleValue
      }

      await apiClient.post('/auth/register', payload)
      
      setSuccessMessage('Registration successful! Redirecting to login page...')
      
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (error) {
      if (error && error.message) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('An unexpected error occurred during registration.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create an Account
          </h2>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleFormSubmit}>
          {errorMessage !== '' && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage !== '' && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded text-sm text-green-700">
              {successMessage}
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-3">
            <div>
              <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                id="full-name"
                name="name"
                type="text"
                disabled={isLoading}
                value={nameValue}
                onChange={(event) => setNameValue(event.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                disabled={isLoading}
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                disabled={isLoading}
                value={usernameValue}
                onChange={(event) => setUsernameValue(event.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="johndoe123"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                I am a...
              </label>
              <select
                id="role"
                name="role"
                disabled={isLoading}
                value={roleValue}
                onChange={(event) => setRoleValue(event.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
              >
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                disabled={isLoading}
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Choose a strong password"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                disabled={isLoading}
                value={confirmPasswordValue}
                onChange={(event) => setConfirmPasswordValue(event.target.value)}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Re-enter password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Register
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
