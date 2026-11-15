import React, { Component } from 'react'
import Button from '../ui/Button.jsx'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRecovery = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onRecover) {
      this.props.onRecover()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="ml-3 text-xl font-bold text-gray-900">Something went wrong</h2>
            </div>
            <p className="text-gray-600 mb-6">
              We're sorry for the inconvenience. Please try again or contact support if the problem persists.
            </p>
            <div className="flex space-x-3">
              <Button onClick={this.handleRecovery} variant="primary">
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()} variant="secondary">
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
