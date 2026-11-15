import React from 'react'

export function Spinner({ size = 'medium' }) {
  const sizeClasses = {
    small: 'h-4 w-4 border-2',
    medium: 'h-8 w-8 border-2',
    large: 'h-12 w-12 border-4'
  }

  return (
    <div className={`animate-spin rounded-full border-t-2 border-blue-600 ${sizeClasses[size]}`} />
  )
}
