import { createContext, useContext, useEffect, useState } from 'react'
import { api, post, queryClient, setLoggedOutHandler } from './api'
import { disconnectSocket } from './socket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined while we ask the server who is logged in

  useEffect(() => {
    const signedOut = () => {
      setUser(null)
      disconnectSocket()
      queryClient.clear()
    }
    setLoggedOutHandler(signedOut)
    api('/auth/me').then((d) => setUser(d.user), signedOut)
  }, [])

  const logout = async () => {
    await post('/auth/logout').catch(() => {})
    setUser(null)
    disconnectSocket()
    queryClient.clear()
  }

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
export const homeFor = (user) => ({ doctor: '/doctor', admin: '/admin' })[user?.role] || '/doctors'
