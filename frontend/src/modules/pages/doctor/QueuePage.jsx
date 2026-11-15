import React, { useState, useEffect } from 'react'
import apiClient from '../../../shared/utils/api'
import { useSocket } from '../../../shared/context/SocketContext.jsx'

function QueueItem({ patient, position, isCurrent, onCallNext }) {
  let statusColor = 'bg-blue-100 text-blue-800'
  if (patient.status === 'called') {
    statusColor = 'bg-yellow-100 text-yellow-800'
  } else if (patient.status === 'completed') {
    statusColor = 'bg-green-100 text-green-800'
  }

  return (
    <div className={`p-4 rounded-lg shadow-sm border ${isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-gray-900">{patient.name}</h3>
          <p className="text-sm text-gray-500">Appointment at {patient.slotTime}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {patient.status || 'waiting'}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${isCurrent ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
            Position {position}
          </span>
        </div>
      </div>
      {isCurrent && patient.status !== 'completed' && (
        <button
          onClick={onCallNext}
          className="mt-3 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
        >
          Call Next Patient
        </button>
      )}
    </div>
  )
}

export function QueuePage() {
  const { isConnected, onQueueUpdated, onPatientCalled } = useSocket()
  const today = new Date().toISOString().split('T')[0]

  const [selectedDate, setSelectedDate] = useState(today)
  const [queue, setQueue] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isCallingNext, setIsCallingNext] = useState(false)

  useEffect(() => {
    fetchQueue()
  }, [selectedDate])

  useEffect(() => {
    const refreshQueue = (data) => {
      if (!data.date || data.date === selectedDate) {
        fetchQueue()
      }
    }

    const removeQueueUpdatedListener = onQueueUpdated(refreshQueue)
    const removePatientCalledListener = onPatientCalled(refreshQueue)

    return () => {
      if (removeQueueUpdatedListener) {
        removeQueueUpdatedListener()
      }
      if (removePatientCalledListener) {
        removePatientCalledListener()
      }
    }
  }, [isConnected, onPatientCalled, onQueueUpdated, selectedDate])

  const fetchQueue = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiClient.get('/queue/list', {
        params: {
          date: selectedDate
        }
      })
      setQueue(response.data.queue || [])
    } catch (err) {
      setError(err.message || 'Failed to load queue.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCallNext = async () => {
    setIsCallingNext(true)
    setError(null)

    try {
      await apiClient.post('/queue/call-next', {
        date: selectedDate
      })
      fetchQueue()
    } catch (err) {
      setError(err.message || 'Failed to call next patient.')
    } finally {
      setIsCallingNext(false)
    }
  }

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value)
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
      <div className="max-w-4xl mx-auto p-6 mt-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded shadow-sm">
          <p className="font-semibold">Error Loading Queue</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchQueue}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Patient Queue</h1>
          <div className="mt-4 md:mt-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              min={today}
              className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Queue for {selectedDate}</h2>
        {queue.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No patients in queue for this date.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item, index) => (
              <QueueItem
                key={item.appointmentId}
                patient={{
                  name: item.patientName,
                  slotTime: item.timeSlot,
                  status: item.status || 'waiting',
                }}
                position={index + 1}
                isCurrent={index === 0 && item.status !== 'completed'}
                onCallNext={handleCallNext}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
