import React, { useEffect, useState } from 'react'
import { useAuth } from '../../../shared/context/AuthContext.jsx'
import apiClient from '../../../shared/utils/api'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    specialty: '',
    bio: '',
    consultationFee: '',
  })
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        specialty: '',
        bio: '',
        consultationFee: '',
      })

      if (user.role === 'doctor') {
        apiClient.get('/doctors/me')
          .then((response) => {
            const doctor = response.data.doctor || {}
            setFormData((current) => ({
              ...current,
              specialty: doctor.specialty || '',
              bio: doctor.bio || '',
              consultationFee: doctor.consultationFee || '',
            }))
          })
          .catch((requestError) => {
            setError(requestError.message || 'Doctor profile could not be loaded.')
          })
      }
    }
  }, [user])

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    })
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage('')
    setError('')

    try {
      if (user?.role === 'doctor') {
        await apiClient.put('/auth/me', {
          name: formData.name,
          phone: formData.phone,
        })
        await apiClient.put('/doctors/profile', {
          specialty: formData.specialty,
          bio: formData.bio,
          consultationFee: formData.consultationFee,
        })
      } else {
        await apiClient.put('/auth/me', {
          name: formData.name,
          phone: formData.phone,
        })
      }

      await refreshUser()
      setIsEditing(false)
      setMessage('Profile updated successfully.')
    } catch (requestError) {
      setError(requestError.message || 'Profile update failed.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return <p className="text-gray-600">Please log in to view your profile.</p>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Profile</h1>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-700">
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
            <p className="text-gray-500 capitalize">{user.role}</p>
          </div>
        </div>

        {message !== '' && <p className="mb-4 text-green-700">{message}</p>}
        {error !== '' && <p className="mb-4 text-red-700">{error}</p>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              id="profile-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={!isEditing || isLoading}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="profile-email"
              value={user.email}
              disabled
              className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="profile-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              id="profile-phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={!isEditing || isLoading}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          {user.role === 'doctor' && (
            <>
              <div>
                <label htmlFor="profile-specialty" className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <input
                  id="profile-specialty"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  disabled={!isEditing || isLoading}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="profile-bio" className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea
                  id="profile-bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  disabled={!isEditing || isLoading}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="profile-fee" className="block text-sm font-medium text-gray-700 mb-1">Consultation fee</label>
                <input
                  id="profile-fee"
                  name="consultationFee"
                  type="number"
                  value={formData.consultationFee}
                  onChange={handleChange}
                  disabled={!isEditing || isLoading}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
            </>
          )}
          <div className="flex justify-end gap-3">
            {!isEditing && (
              <button type="button" onClick={() => setIsEditing(true)} className="rounded bg-blue-600 px-4 py-2 text-white">
                Edit Profile
              </button>
            )}
            {isEditing && (
              <button type="submit" disabled={isLoading} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
