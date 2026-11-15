import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext.jsx'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { isAuthenticated, user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'

    socketRef.current = io(socketUrl, {
      auth: {
        token: localStorage.getItem('accessToken'),
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [isAuthenticated, user])

  const subscribeToQueue = (appointmentDate, appointmentId) => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe_to_queue', {
        appointmentDate,
        appointmentId,
      })
    }
  }

  const unsubscribeFromQueue = () => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe_from_queue')
    }
  }

  const onAppointmentQueued = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('appointment:queued', callback)
      return () => socketRef.current?.off('appointment:queued', callback)
    }
    return undefined
  }

  const onAppointmentCalled = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('appointment:called', callback)
      return () => socketRef.current?.off('appointment:called', callback)
    }
    return undefined
  }

  const onPatientCalled = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('patient_called', callback)
      return () => socketRef.current?.off('patient_called', callback)
    }
    return undefined
  }

  const onPaymentConfirmed = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('payment_confirmed', callback)
      return () => socketRef.current?.off('payment_confirmed', callback)
    }
    return undefined
  }

  const onQueueUpdated = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('queue_updated', callback)
      return () => socketRef.current?.off('queue_updated', callback)
    }
    return undefined
  }

  const value = {
    socket: socketRef.current,
    isConnected,
    subscribeToQueue,
    unsubscribeFromQueue,
    onAppointmentQueued,
    onAppointmentCalled,
    onPatientCalled,
    onPaymentConfirmed,
    onQueueUpdated,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
