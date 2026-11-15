import { useState } from 'react'
import { patch, useAction, useApi } from '../../lib/api'
import { Badge, Button, Card, Empty, Page, Query } from '../../components/ui'

const tabs = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Turned down']]

export default function Doctors() {
  const [status, setStatus] = useState('pending')
  const q = useApi(`/admin/doctors?status=${status}`)
  const decide = useAction(({ id, to }) => patch(`/admin/doctors/${id}`, { status: to }), {
    success: (d) => `Dr. ${d.doctor.name} ${d.doctor.status === 'approved' ? 'approved' : 'turned down'}.`,
  })

  return (
    <Page title="Doctors">
      <div className="flex gap-2" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={status === key} onClick={() => setStatus(key)}
            className={`rounded-md px-3 py-1.5 text-sm ${status === key ? 'bg-teal-700 text-white' : 'border border-gray-300 bg-white'}`}>
            {label}
          </button>
        ))}
      </div>
      <Query query={q}>
        {({ doctors }) => doctors.length === 0 ? <Card><Empty>No doctors here.</Empty></Card> : (
          <div className="space-y-3">
            {doctors.map((d) => (
              <Card key={d._id} className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm">
                  <p className="text-base font-semibold">Dr. {d.name} <span className="font-normal text-gray-500">· {d.specialty || 'No specialty'}</span></p>
                  <p className="text-gray-600">{d.userId?.email} · {d.userId?.phone}</p>
                  <p className="text-gray-600">
                    {[d.clinicName, d.address].filter(Boolean).join(', ') || 'No clinic details yet'} · NMC {d.nmcRegistrationNumber || '—'}{' '}
                    {d.isNmcVerified ? <Badge status="approved">Format checked</Badge> : <Badge status="pending">Not checked</Badge>}
                  </p>
                </div>
                <div className="flex gap-2">
                  {status !== 'approved' && <Button onClick={() => decide.mutate({ id: d._id, to: 'approved' })} loading={decide.isPending && decide.variables?.id === d._id}>Approve</Button>}
                  {status !== 'rejected' && <Button variant="danger" onClick={() => decide.mutate({ id: d._id, to: 'rejected' })}>{status === 'approved' ? 'Remove from search' : 'Turn down'}</Button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Query>
    </Page>
  )
}
