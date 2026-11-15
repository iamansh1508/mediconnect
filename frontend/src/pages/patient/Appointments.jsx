import { Link } from 'react-router-dom'
import { useApi } from '../../lib/api'
import { clock, day, todayIST } from '../../lib/format'
import { Badge, Button, Card, Empty, Page, Query } from '../../components/ui'

function List({ items }) {
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((a) => (
        <li key={a._id}>
          <Link to={`/appointments/${a._id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-gray-50">
            <div>
              <p className="font-medium">Dr. {a.doctorId?.name} <span className="font-normal text-gray-500">· {a.doctorId?.specialty}</span></p>
              <p className="text-sm text-gray-600">{day(a.date)}, {clock(a.time)} · {a.doctorId?.clinicName}</p>
            </div>
            <Badge status={a.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function Appointments() {
  const q = useApi('/appointments/my')
  return (
    <Page title="My appointments" actions={<Link to="/doctors"><Button>Book a visit</Button></Link>}>
      <Query query={q}>
        {({ appointments }) => {
          const today = todayIST()
          const upcoming = appointments.filter((a) => a.date >= today && ['booked', 'confirmed'].includes(a.status)).reverse()
          const past = appointments.filter((a) => !upcoming.includes(a))
          return (
            <div className="space-y-6">
              <Card>
                <h2 className="font-semibold">Upcoming</h2>
                {upcoming.length ? <List items={upcoming} /> : <Empty>Nothing booked. Find a doctor to book a visit.</Empty>}
              </Card>
              {past.length > 0 && (
                <Card>
                  <h2 className="font-semibold">Past and cancelled</h2>
                  <List items={past} />
                </Card>
              )}
            </div>
          )
        }}
      </Query>
    </Page>
  )
}
