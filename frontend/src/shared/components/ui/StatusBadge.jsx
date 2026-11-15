import React from 'react'

export default function StatusBadge({ status, paymentStatus }) {
  let statusClass = 'bg-gray-100 text-gray-800'
  let statusText = status || paymentStatus || 'Unknown'

  if (status === 'confirmed' || status === 'successful') {
    statusClass = 'bg-green-100 text-green-800'
  } else if (status === 'in-queue' || status === 'pending') {
    statusClass = 'bg-yellow-100 text-yellow-800'
  } else if (status === 'cancelled' || status === 'failed') {
    statusClass = 'bg-red-100 text-red-800'
  } else if (status === 'completed') {
    statusClass = 'bg-indigo-100 text-indigo-800'
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${statusClass}`}>
      {statusText}
    </span>
  )
}
