import React from 'react'

export default function EmptyState({ message = 'No data found', icon = null, action = null }) {
  return (
    <div className="text-center py-12 px-4 bg-white rounded-lg shadow-sm border border-gray-200">
      {icon && (
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 text-gray-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="mt-2 text-sm font-medium text-gray-900">{message}</h3>
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  )
}
