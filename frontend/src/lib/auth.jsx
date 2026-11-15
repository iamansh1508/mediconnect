import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api, post, queryClient, setLoggedOutHandler } from './api'
import { disconnectSocket } from './socket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined while we ask the server who is logged in
  const wasLoggedIn = useRef(false)
  wasLoggedIn.current = !!user

  useEffect(() => {
    const signedOut = () => {
      // Only drop cached data if someone was logged in (a visitor has nothing private to forget).
      // resetQueries, not clear(): clear() orphans queries on screen, which then never finish loading.
      if (wasLoggedIn.current) {
        disconnectSocket()
        queryClient.resetQueries()
      }
      setUser(null)
    }
    setLoggedOutHandler(signedOut)
    api('/auth/me').then((d) => setUser(d.user), signedOut)
  }, [])

  const logout = async () => {
    await post('/auth/logout').catch(() => {})
    setUser(null)
    disconnectSocket()
    queryClient.resetQueries()
  }

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
export const homeFor = (user) => ({ doctor: '/doctor', admin: '/admin' })[user?.role] || '/doctors'
