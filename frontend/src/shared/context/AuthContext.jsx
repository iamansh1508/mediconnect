import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import apiClient from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState(null)
  
  const isInitializing = useRef(false)

  useEffect(() => {
    refreshUser()
  }, [])

  const refreshUser = async () => {
    if (isInitializing.current) {
      return
    }

    if (!localStorage.getItem('accessToken')) {
      setIsLoading(false)
      setError(null)
      return
    }

    isInitializing.current = true
    setIsLoading(true)

    try {
      const response = await apiClient.get('/auth/me')
      setUser(response.data.user)
      setIsAuthenticated(true)
      setError(null)
    } catch (err) {
      setUser(null)
      setIsAuthenticated(false)
      setError('Failed to refresh user session')
    } finally {
      setIsLoading(false)
      isInitializing.current = false
    }
  }

  const login = async (email, password) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiClient.post('/auth/login', { email, password })
      localStorage.setItem('accessToken', response.data.accessToken)
      localStorage.setItem('refreshToken', response.data.refreshToken)
      setUser(response.data.user)
      setIsAuthenticated(true)
      return response.data.user
    } catch (err) {
      setError('Login failed. Please check your credentials.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
      setIsAuthenticated(false)
      window.location.href = '/login'
    }
  }

  const value = {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    logout,
    refreshUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
