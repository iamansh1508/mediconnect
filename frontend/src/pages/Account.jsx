import { useState } from 'react'
import { post, put, useAction } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Badge, Button, Card, Field, Page } from '../components/ui'

export default function Account() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone || '')
  const save = useAction(() => put('/auth/me', { name, phone }), { success: 'Saved.', onSuccess: (d) => setUser(d.user) })
  const resend = useAction(() => post('/auth/resend-verification'), { success: (d) => d.message })
  const change = useAction((form) => post('/auth/change-password', form), { success: 'Password changed. Other devices were signed out.' })

  return (
    <Page title="Account">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Your details</h2>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="mt-4 space-y-4">
            <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            <Field label="Mobile number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} pattern="[6-9][0-9]{9}" required hint="10 digits. Queue alerts are sent here." />
            <div className="text-sm">
              <span className="text-gray-500">Email:</span> {user.email}{' '}
              {user.isEmailVerified ? <Badge status="approved">Confirmed</Badge> : <Badge status="pending">Not confirmed</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={save.isPending}>Save details</Button>
              {!user.isEmailVerified && <Button variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>Send confirmation email again</Button>}
            </div>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Change password</h2>
          <form
            onSubmit={(e) => { e.preventDefault(); change.mutate(Object.fromEntries(new FormData(e.target)), { onSuccess: () => e.target.reset() }) }}
            className="mt-4 space-y-4"
          >
            <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
            <Field label="New password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
            <Button type="submit" loading={change.isPending}>Change password</Button>
          </form>
        </Card>
      </div>
    </Page>
  )
}
