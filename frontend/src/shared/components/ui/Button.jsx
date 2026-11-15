import React from 'react'
import Spinner from './Spinner.jsx'

export default function Button({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className = ''
}) {
  const baseStyle = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none transition-colors'
  
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border border-transparent disabled:bg-blue-300',
    secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 disabled:bg-gray-50'
  }

  const sizeStyles = {
    small: 'px-3 py-1.5 text-xs',
    medium: 'px-4 py-2 text-sm',
    large: 'px-6 py-3 text-base'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {loading && (
        <span className="mr-2">
          <Spinner size="small" />
        </span>
      )}
      {children}
    </button>
  )
}
