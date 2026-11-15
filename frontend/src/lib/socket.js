import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { refresh } from './api'

let socket = null

// One socket per tab, opened the first time a logged-in page needs live updates.
function getSocket() {
  if (socket) return socket
  socket = io({ transports: ['websocket'], autoConnect: false })
  let retried = false
  socket.on('connect', () => { retried = false })
  socket.on('connect_error', async (err) => {
    // The access cookie expired: refresh it once and try again.
    if (err.message === 'unauthorized' && !retried) {
      retried = true
      if (await refresh()) socket?.connect()
    }
  })
  socket.connect()
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

// Joins a live queue (a patient passes their appointment id; a doctor any value) and reports the order.
// Re-joins after a reconnect, because rooms don't survive one.
export function useLiveQueue(watchId, { onOrder, onCalled } = {}) {
  const handlers = useRef()
  handlers.current = { onOrder, onCalled }

  useEffect(() => {
    if (!watchId) return
    const s = getSocket()
    const watch = () => s.emit('queue:watch', watchId, (res) => res?.order && handlers.current.onOrder?.(res.order))
    const update = ({ order }) => handlers.current.onOrder?.(order)
    const called = (d) => handlers.current.onCalled?.(d)
    if (s.connected) watch()
    s.on('connect', watch)
    s.on('queue:update', update)
    s.on('queue:called', called)
    return () => {
      s.off('connect', watch)
      s.off('queue:update', update)
      s.off('queue:called', called)
    }
  }, [watchId])
}
