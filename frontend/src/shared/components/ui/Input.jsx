import React from 'react'

export default function Input({
  type = 'text',
  placeholder = '',
  error = null,
  disabled = false,
  className = '',
  ...props
}) {
  const baseStyle = 'block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed'
  const errorStyle = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''

  return (
    <input
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      className={`${baseStyle} ${errorStyle} ${className}`}
      {...props}
    />
  )
}
