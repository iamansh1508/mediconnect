import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../shared/context/AuthContext'

function HomePage() {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Your Health, Our Priority
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Book appointments with top doctors, get prescriptions, and manage your health all in one place.
        </p>
        <div className="flex justify-center space-x-4">
          {isAuthenticated ? (
            <Link
              to="/patient/doctors"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Find a Doctor
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="px-8 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Find Doctors</h3>
          <p className="text-gray-600">Search by specialty, location, and rating to find the perfect doctor for your needs.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Booking</h3>
          <p className="text-gray-600">Book appointments instantly with real-time slot availability and secure payments.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Digital Prescriptions</h3>
          <p className="text-gray-600">Get digital prescriptions after your consultation, stored securely and accessible anytime.</p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 text-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold">500+</div>
            <div className="text-blue-200 mt-1">Verified Doctors</div>
          </div>
          <div>
            <div className="text-3xl font-bold">10,000+</div>
            <div className="text-blue-200 mt-1">Happy Patients</div>
          </div>
          <div>
            <div className="text-3xl font-bold">50+</div>
            <div className="text-blue-200 mt-1">Specialties</div>
          </div>
          <div>
            <div className="text-3xl font-bold">24/7</div>
            <div className="text-blue-200 mt-1">Support</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
