import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { post } from '../../lib/api'
import { homeFor, useAuth } from '../../lib/auth'
import { Button, Card, Field } from '../../components/ui'

export default function Login() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const { user } = await post('/auth/login', Object.fromEntries(new FormData(e.target)))
      setUser(user)
      navigate(params.get('next') || homeFor(user), { replace: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Log in</h1>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" loading={busy} className="w-full">Log in</Button>
      </form>
      <div className="mt-5 flex justify-between text-sm">
        <Link to="/forgot-password" className="text-teal-700 hover:underline">Forgot your password?</Link>
        <Link to="/register" className="text-teal-700 hover:underline">Create an account</Link>
      </div>
    </Card>
  )
}
