import React, { useCallback, useEffect, useState } from 'react'
import apiClient from '../../../shared/utils/api'
import { useSocket } from '../../../shared/context/SocketContext.jsx'

function QueueDisplay({ appointmentId, appointmentDate, onPatientCalled }) {
  const { socket, isConnected, subscribeToQueue, unsubscribeFromQueue } = useSocket()
  const [status, setStatus] = useState('loading')
  const [position, setPosition] = useState(null)
  const [estimatedWaitTime, setEstimatedWaitTime] = useState(null)

  const fetchQueuePosition = useCallback(async () => {
    try {
      const response = await apiClient.get(`/appointments/${appointmentId}/queue`)
      const data = response.data || {}

      if (data.status === 'completed' || data.appointmentStatus === 'completed') {
        setStatus('completed')
        return
      }

      setEstimatedWaitTime(data.estimatedWaitTime || data.estimatedWaitMinutes || null)

      if (data.position === null || data.position === undefined) {
        setPosition(null)
        setStatus('not-in-queue')
        return
      }

      setPosition(Number(data.position))
      setStatus('in-queue')
    } catch (error) {
      if (!isConnected || error.statusCode === 0 || !error.response) {
        setStatus('offline')
        return
      }

      setStatus('not-in-queue')
    }
  }, [appointmentId, isConnected])

  useEffect(() => {
    let isMounted = true

    const loadQueuePosition = async () => {
      if (isMounted) {
        await fetchQueuePosition()
      }
    }

    loadQueuePosition()
    const intervalId = window.setInterval(loadQueuePosition, 5000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [fetchQueuePosition])

  useEffect(() => {
    if (!socket || !appointmentId) {
      return undefined
    }

    subscribeToQueue(appointmentDate, appointmentId)

    const handleQueueUpdate = (data) => {
      if (!data || data.appointmentId === appointmentId || data.appointmentId === undefined) {
        fetchQueuePosition()
      }
    }

    const handlePatientCalled = (data) => {
      if (data && data.appointmentId !== appointmentId) {
        return
      }

      setStatus('called')
      setPosition(0)

      if (onPatientCalled) {
        onPatientCalled(data)
      }
    }

    socket.on('queue_updated', handleQueueUpdate)
    socket.on('patient_called', handlePatientCalled)

    return () => {
      socket.off('queue_updated', handleQueueUpdate)
      socket.off('patient_called', handlePatientCalled)
      unsubscribeFromQueue({ appointmentId })
    }
  }, [
    appointmentDate,
    appointmentId,
    fetchQueuePosition,
    onPatientCalled,
    socket,
    subscribeToQueue,
    unsubscribeFromQueue,
  ])

  useEffect(() => {
    if (!isConnected && status !== 'called' && status !== 'completed') {
      setStatus('offline')
      return
    }

    if (isConnected && status === 'offline') {
      fetchQueuePosition()
    }
  }, [fetchQueuePosition, isConnected, status])

  let message = 'Fetching queue position...'
  let positionContent = null

  if (status === 'not-in-queue') {
    message = 'Your turn will come soon'
  }

  if (status === 'in-queue') {
    message = `You are #${position} in the queue`
    positionContent = <p aria-label="Queue position">{position}</p>
  }

  if (status === 'called') {
    message = 'Your turn has come! Report to clinic'
  }

  if (status === 'completed') {
    message = 'Appointment completed'
  }

  if (status === 'offline') {
    message = 'Offline - checking queue...'
  }

  let connectionLabel = 'Connected'
  let connectionClassName = 'text-green-600'
  let connectionDotClassName = 'bg-green-500'

  if (!isConnected) {
    connectionLabel = 'Offline'
    connectionClassName = 'text-red-600'
    connectionDotClassName = 'bg-red-500'
  }

  return (
    <section
      className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-center"
      aria-live="polite"
    >
      <div className="mb-4 flex items-center justify-center gap-2 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${connectionDotClassName}`}
          aria-hidden="true"
        />
        <span className={connectionClassName}>{connectionLabel}</span>
      </div>

      <p className="text-lg font-semibold text-blue-900">{message}</p>

      {positionContent}

      {estimatedWaitTime && status === 'in-queue' && (
        <p className="mt-2 text-sm text-gray-600">
          Estimated wait: {estimatedWaitTime} minutes
        </p>
      )}
    </section>
  )
}

export default QueueDisplay
