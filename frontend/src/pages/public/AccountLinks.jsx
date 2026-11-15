// The three pages people reach from emails or the login form: forgot, reset, verify.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { post } from '../../lib/api'
import { Button, Card, ErrorNote, Field, Loading } from '../../components/ui'

export function ForgotPassword() {
  const [sent, setSent] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      setSent((await post('/auth/forgot-password', Object.fromEntries(new FormData(e.target)))).message)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      {sent ? (
        <p className="mt-4 text-sm text-gray-700">{sent} The link works for one hour.</p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Button type="submit" loading={busy} className="w-full">Email me a reset link</Button>
        </form>
      )}
      <p className="mt-5 text-sm"><Link to="/login" className="text-teal-700 hover:underline">Back to log in</Link></p>
    </Card>
  )
}

export function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      toast.success((await post('/auth/reset-password', { token, password: e.target.password.value })).message)
      navigate('/login')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters. This signs you out everywhere else." />
        <Button type="submit" loading={busy} className="w-full">Save new password</Button>
      </form>
    </Card>
  )
}

export function VerifyEmail() {
  const { token } = useParams()
  // A query, not an effect: it runs once even when React mounts twice, and the token only works once.
  const q = useQuery({ queryKey: ['verify-email', token], queryFn: () => post('/auth/verify-email', { token }), retry: false, staleTime: Infinity })

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Confirm your email</h1>
      <div className="mt-4">
        {q.isPending ? <Loading /> : q.isError ? <ErrorNote error={q.error} /> : <p className="text-sm text-gray-700">{q.data.message} You can close this page.</p>}
      </div>
      <p className="mt-5 text-sm"><Link to="/" className="text-teal-700 hover:underline">Go to MediConnect</Link></p>
    </Card>
  )
}
