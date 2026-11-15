import { useEffect } from 'react'
import { useSocket } from '../shared/context/SocketContext'

export function useAppointmentEvents(callback) {
  const socket = useSocket()

  useEffect(() => {
    if (!socket) return

    socket.on('appointment:queued', callback)
    socket.on('appointment:cancelled', callback)
    socket.on('payment_confirmed', callback)

    return () => {
      socket.off('appointment:queued', callback)
      socket.off('appointment:cancelled', callback)
      socket.off('payment_confirmed', callback)
    }
  }, [socket, callback])
}
