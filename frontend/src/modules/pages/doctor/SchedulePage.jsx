import React, { useState, useEffect } from 'react'
import apiClient from '../../../shared/utils/api'

function ScheduleForm({ onSubmit, initialData }) {
  const today = new Date().toISOString().split('T')[0]

  const [date, setDate] = useState(initialData?.date || today)
  const [startTime, setStartTime] = useState(initialData?.startTime || '09:00')
  const [endTime, setEndTime] = useState(initialData?.endTime || '17:00')
  const [slotDuration, setSlotDuration] = useState(initialData?.slotDuration || 30)
  const [error, setError] = useState(null)

  const validateForm = () => {
    if (date < today) {
      setError('Cannot set schedule for past dates.')
      return false
    }

    if (startTime >= endTime) {
      setError('End time must be after start time.')
      return false
    }

    setError(null)
    return true
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (validateForm()) {
      onSubmit({ date, startTime, endTime, slotDuration })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={today}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Slot Duration (minutes)</label>
        <select
          value={slotDuration}
          onChange={(e) => setSlotDuration(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
        >
          <option value={30}>30 minutes</option>
          <option value={60}>60 minutes</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
      >
        {initialData ? 'Update Schedule' : 'Create Schedule'}
      </button>
    </form>
  )
}

function ScheduleList({ schedules, onDelete }) {
  if (!schedules || schedules.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No schedules set yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <div key={schedule._id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-gray-900">{schedule.date}</h3>
              <p className="text-sm text-gray-500">
                {schedule.startTime} - {schedule.endTime} ({schedule.slotDuration} min slots)
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onDelete(schedule._id)}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SchedulePage() {
  const [schedules, setSchedules] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    try {
      const response = await apiClient.get('/doctors/me/schedule')
      setSchedules(response.data.schedules || [])
    } catch (err) {
      setError(err.message || 'Failed to load schedules.')
    }
  }

  const handleSubmit = async (scheduleData) => {
    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await apiClient.post('/doctors/schedule', scheduleData)
      setSuccessMessage('Schedule created successfully!')
      fetchSchedules()
    } catch (err) {
      setError(err.message || 'Failed to create schedule.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (scheduleId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this schedule?')
    if (!confirmDelete) {
      return
    }

    try {
      await apiClient.delete(`/doctors/schedule/${scheduleId}`)
      fetchSchedules()
    } catch (err) {
      setError(err.message || 'Failed to delete schedule.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Manage Your Schedule</h1>

        {successMessage && (
          <div className="p-3 bg-green-50 border-l-4 border-green-500 text-green-700 mb-4">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 mb-4">
            {error}
          </div>
        )}

        <ScheduleForm onSubmit={handleSubmit} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Schedules</h2>
        <ScheduleList schedules={schedules} onDelete={handleDelete} />
      </div>
    </div>
  )
}
