import { useId } from 'react'

const buttons = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800',
  secondary: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
}

export function Button({ variant = 'primary', loading, className = '', children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${buttons[variant]} ${className}`}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  )
}

// Label + input (or as="select" / "textarea"), wired together for screen readers.
export function Field({ label, hint, as: Tag = 'input', className = '', children, ...props }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <Tag
        id={id}
        {...props}
        className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
      >
        {children}
      </Tag>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

export const Card = ({ className = '', children }) => (
  <section className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>
)

export function Page({ title, subtitle, actions, children }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

const badges = {
  booked: ['Awaiting payment', 'bg-amber-100 text-amber-800'],
  confirmed: ['Confirmed', 'bg-teal-100 text-teal-800'],
  completed: ['Completed', 'bg-gray-200 text-gray-700'],
  cancelled: ['Cancelled', 'bg-red-100 text-red-700'],
  pending: ['Pending', 'bg-amber-100 text-amber-800'],
  approved: ['Approved', 'bg-teal-100 text-teal-800'],
  rejected: ['Rejected', 'bg-red-100 text-red-700'],
  paid: ['Paid', 'bg-teal-100 text-teal-800'],
  refunded: ['Refunded', 'bg-gray-200 text-gray-700'],
}

export function Badge({ status, children }) {
  const [label, style] = badges[status] || [status, 'bg-gray-100 text-gray-700']
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{children || label}</span>
}

export const Loading = () => <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
export const Empty = ({ children }) => <p className="py-8 text-center text-sm text-gray-500">{children}</p>
export const ErrorNote = ({ error }) => (
  <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error?.message || 'Something went wrong.'}</p>
)

// Renders loading / error states for a query, or children(data) once it has loaded.
export function Query({ query, children }) {
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorNote error={query.error} />
  return children(query.data)
}

export const Stars = ({ rating, count }) => (
  <span className="text-sm text-gray-700">
    <span className="text-amber-500" aria-hidden>★</span> {rating ? rating.toFixed(1) : 'New'}
    {count ? <span className="text-gray-500"> ({count})</span> : null}
  </span>
)
