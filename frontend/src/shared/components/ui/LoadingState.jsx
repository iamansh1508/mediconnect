import React from 'react'
import Spinner from './Spinner.jsx'

export default function LoadingState({ text = 'Loading...', skeleton = false }) {
  if (skeleton) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-full"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Spinner size="large" />
      <p className="mt-4 text-gray-500 text-sm">{text}</p>
    </div>
  )
}
