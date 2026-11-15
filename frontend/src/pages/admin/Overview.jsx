import { useApi } from '../../lib/api'
import { day, rupees, todayIST } from '../../lib/format'
import { Card, Page, Query } from '../../components/ui'

const Tile = ({ label, value, note }) => (
  <Card>
    <p className="text-sm text-gray-500">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
  </Card>
)

export default function Overview() {
  const q = useApi('/admin/stats')
  return (
    <Page title="Overview">
      <Query query={q}>
        {(s) => {
          // Last 7 days, including days with no bookings.
          const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(todayIST()) - (6 - i) * 86400e3).toISOString().slice(0, 10))
          const counts = Object.fromEntries(s.perDay.map((d) => [d.date, d.appointments]))
          const max = Math.max(1, ...days.map((d) => counts[d] || 0))
          const a = s.appointments
          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Tile label="Patients" value={s.users.patient || 0} />
                <Tile label="Doctors" value={s.doctors.approved || 0} note={`${s.doctors.pending || 0} waiting for approval`} />
                <Tile label="Revenue collected" value={rupees(s.revenue)} note="Paid appointments, before refunds" />
                <Tile label="Average rating" value={s.averageRating ?? '—'} note={`${s.reviews} reviews`} />
              </div>
              <Card>
                <h2 className="font-semibold">Appointments</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {[['booked', 'Awaiting payment'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([k, label]) => (
                    <div key={k}><dt className="text-gray-500">{label}</dt><dd className="text-lg font-semibold tabular-nums">{a[k] || 0}</dd></div>
                  ))}
                </dl>
              </Card>
              <Card>
                <h2 className="font-semibold">Bookings in the last 7 days</h2>
                <div className="mt-4 flex h-40 items-end gap-2" role="img" aria-label={days.map((d) => `${day(d)}: ${counts[d] || 0}`).join(', ')}>
                  {days.map((d) => (
                    <div key={d} className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
                      <span className="text-xs tabular-nums text-gray-600">{counts[d] || 0}</span>
                      <div className="w-full rounded-t bg-teal-600" style={{ height: `${((counts[d] || 0) / max) * 100}%`, minHeight: 2 }} />
                      <span className="text-xs text-gray-500">{day(d).split(',')[0]}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )
        }}
      </Query>
    </Page>
  )
}
