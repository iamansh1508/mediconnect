import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { post, useAction, useApi } from '../../lib/api'
import { useLiveQueue } from '../../lib/socket'
import { clock, day, todayIST } from '../../lib/format'
import { Badge, Button, Card, Empty, Page, Query } from '../../components/ui'
import PrescriptionForm from './PrescriptionForm'

export default function Dashboard() {
  const me = useApi('/doctors/me')
  const queue = useApi('/doctors/me/queue')
  const today = useApi('/doctors/me/appointments')
  useLiveQueue('me', { onOrder: () => { queue.refetch(); today.refetch() } })

  const callNext = useAction(() => post('/doctors/me/queue/next'), {
    onSuccess: (d) => (d.called ? toast.success(`Called ${d.called.patientId.name}.`) : toast('Nobody is waiting.')),
  })
  const status = me.data?.doctor.status

  return (
    <Page title="Today" subtitle={day(todayIST())}>
      {status && status !== 'approved' && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {status === 'pending'
            ? 'Your profile is waiting for an admin to check it. Patients can’t find you yet. Meanwhile, fill in your '
            : 'An admin turned down your profile. Check your details in your '}
          <Link to="/doctor/profile" className="font-medium underline">clinic profile</Link> and <Link to="/doctor/schedule" className="font-medium underline">hours</Link>.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Query query={queue}>
          {({ current, waiting }) => (
            <>
              <Card className="lg:col-span-2">
                <h2 className="font-semibold">With you now</h2>
                {current ? (
                  <div className="mt-3 space-y-4">
                    <p>
                      <Link to={`/doctor/patients/${current.patientId._id}`} className="text-lg font-medium text-teal-800 hover:underline">{current.patientId.name}</Link>
                      <span className="text-sm text-gray-600"> · booked {clock(current.time)} · {current.patientId.phone}</span>
                    </p>
                    <PrescriptionForm key={current._id} appointmentId={current._id} />
                  </div>
                ) : <Empty>No patient called in yet. Press “Call next patient” when you&apos;re ready.</Empty>}
              </Card>
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">Waiting ({waiting.length})</h2>
                  <Button onClick={() => callNext.mutate()} loading={callNext.isPending} disabled={!waiting.length}>Call next patient</Button>
                </div>
                {waiting.length ? (
                  <ol className="mt-3 divide-y divide-gray-100">
                    {waiting.map((a, i) => (
                      <li key={a._id} className="flex items-center justify-between py-2 text-sm">
                        <span><span className="mr-2 tabular-nums text-gray-400">{i + 1}.</span>{a.patientId.name}</span>
                        <span className="tabular-nums text-gray-600">{clock(a.time)}</span>
                      </li>
                    ))}
                  </ol>
                ) : <Empty>Nobody is waiting. Paid patients appear here.</Empty>}
              </Card>
            </>
          )}
        </Query>
      </div>

      <Card>
        <h2 className="font-semibold">All of today&apos;s bookings</h2>
        <Query query={today}>
          {({ appointments }) => appointments.length === 0 ? <Empty>No bookings today.</Empty> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr><th className="py-2">Time</th><th>Patient</th><th>Phone</th><th>Status</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {appointments.map((a) => (
                    <tr key={a._id}>
                      <td className="py-2 tabular-nums">{clock(a.time)}</td>
                      <td><Link to={`/doctor/patients/${a.patientId._id}`} className="text-teal-800 hover:underline">{a.patientId.name}</Link></td>
                      <td className="tabular-nums">{a.patientId.phone}</td>
                      <td><Badge status={a.status} /></td>
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
