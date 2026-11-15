import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { post } from '../../lib/api'
import { homeFor, useAuth } from '../../lib/auth'
import { Button, Card, Field } from '../../components/ui'

export default function Register() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [role, setRole] = useState('patient')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const { user } = await post('/auth/register', { ...Object.fromEntries(new FormData(e.target)), role })
      setUser(user)
      toast.success('Account created. We emailed you a link to confirm your address.')
      navigate(role === 'doctor' ? '/doctor/profile' : params.get('next') || homeFor(user), { replace: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-gray-700">I am a</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[['patient', 'Patient'], ['doctor', 'Doctor']].map(([value, label]) => (
            <label key={value} className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${role === value ? 'border-teal-600 bg-teal-50 font-medium text-teal-800' : 'border-gray-300'}`}>
              <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <Field label="Full name" name="name" autoComplete="name" required minLength={2} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Mobile number" name="phone" type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" required
          hint="10 digits, no +91. Queue alerts are sent here." />
        {role === 'doctor' && <Field label="Specialty" name="specialty" placeholder="e.g. Dermatology" required />}
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters." />
        <Button type="submit" loading={busy} className="w-full">Create account</Button>
      </form>
      {role === 'doctor' && (
        <p className="mt-4 text-xs text-gray-500">An admin checks every doctor before patients can find them.</p>
      )}
      <p className="mt-5 text-sm">Already have an account? <Link to="/login" className="text-teal-700 hover:underline">Log in</Link></p>
    </Card>
  )
}
