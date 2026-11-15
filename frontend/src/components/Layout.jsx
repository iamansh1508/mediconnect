import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const links = {
  guest: [['/doctors', 'Find a doctor'], ['/login', 'Log in'], ['/register', 'Sign up']],
  patient: [['/doctors', 'Find a doctor'], ['/appointments', 'My appointments'], ['/profile', 'Account']],
  doctor: [['/doctor', 'Today'], ['/doctor/schedule', 'Hours'], ['/doctor/profile', 'Clinic profile'], ['/profile', 'Account']],
  admin: [['/admin', 'Overview'], ['/admin/doctors', 'Doctors'], ['/admin/users', 'Users'], ['/admin/notifications', 'Notifications']],
}

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = links[user?.role] || links.guest

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-teal-800">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-teal-700 text-white" aria-hidden>+</span>
            MediConnect
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm" aria-label="Main">
            {nav.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/doctor' || to === '/admin'}
                className={({ isActive }) => `rounded-md px-3 py-1.5 ${isActive ? 'bg-teal-50 font-medium text-teal-800' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-gray-500 sm:inline">{user.name}</span>
              <button onClick={logout} className="rounded-md px-3 py-1.5 text-gray-600 hover:text-gray-900">Log out</button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        MediConnect · a portfolio project. Doctors and data in the demo are fictional.
      </footer>
    </div>
  )
}
