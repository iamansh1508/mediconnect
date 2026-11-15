import React, { useState } from 'react'
import Navbar from './Navbar.jsx'
import Sidebar from './Sidebar.jsx'

function AppShell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onToggleSidebar={toggleSidebar} />
      <div className="flex flex-1">
        <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
        <main className="flex-1 p-4 md:p-8 bg-gray-50">
          {children}
        </main>
      </div>
      <footer className="bg-gray-800 text-white p-4 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} MediConnect. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default AppShell
