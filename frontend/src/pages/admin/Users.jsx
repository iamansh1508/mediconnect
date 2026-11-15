import { useState } from 'react'
import { patch, useAction, useApi } from '../../lib/api'
import { Badge, Button, Card, Empty, Field, Page, Query } from '../../components/ui'

export default function Users() {
  const [text, setText] = useState('')
  const [search, setSearch] = useState({ q: '', role: '' })
  const params = new URLSearchParams(Object.entries(search).filter(([, v]) => v)).toString()
  const q = useApi(`/admin/users${params ? `?${params}` : ''}`)
  const toggle = useAction((u) => patch(`/admin/users/${u._id}`, { isActive: !u.isActive }), {
    success: (d) => `${d.user.name} ${d.user.isActive ? 'can use MediConnect again' : 'is suspended and signed out'}.`,
  })

  return (
    <Page title="Users">
      <form onSubmit={(e) => { e.preventDefault(); setSearch({ ...search, q: text.trim() }) }} className="flex flex-wrap items-end gap-3">
        <Field label="Name or exact email" value={text} onChange={(e) => setText(e.target.value)} className="min-w-60 flex-1" />
        <Field label="Role" as="select" value={search.role} onChange={(e) => setSearch({ ...search, role: e.target.value })}>
          <option value="">Everyone</option><option value="patient">Patients</option><option value="doctor">Doctors</option><option value="admin">Admins</option>
        </Field>
        <Button type="submit">Search</Button>
      </form>
      <Card>
        <Query query={q}>
          {({ users }) => users.length === 0 ? <Empty>No users match.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500"><tr><th className="py-2">Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td className="py-2">{u.name}</td>
                      <td>{u.email}</td>
                      <td className="capitalize">{u.role}</td>
                      <td>{u.isActive ? <Badge status="approved">Active</Badge> : <Badge status="cancelled">Suspended</Badge>}</td>
                      <td className="text-right">
                        {u.role !== 'admin' && (
                          <Button variant={u.isActive ? 'danger' : 'secondary'} className="!px-3 !py-1" onClick={() => toggle.mutate(u)}>
                            {u.isActive ? 'Suspend' : 'Restore'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Query>
      </Card>
    </Page>
  )
}
