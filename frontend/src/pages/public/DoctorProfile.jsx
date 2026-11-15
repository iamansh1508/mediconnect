import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { post, useAction, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { clock, day, rupees, todayIST } from '../../lib/format'
import { Badge, Button, Card, Empty, Loading, Query, Stars } from '../../components/ui'
import MapView from '../../components/MapView'

export default function DoctorProfile() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const profile = useApi(`/doctors/${id}`)
  const [date, setDate] = useState(todayIST())
  const [time, setTime] = useState(null)
  const slots = useApi(`/doctors/${id}/slots?date=${date}`)
  const days = slots.data?.days

  // Open on the first day the doctor actually works.
  useEffect(() => {
    if (days?.length && !days.includes(date)) setDate(days[0])
  }, [days, date])

  const book = useAction(() => post('/appointments', { doctorId: id, date, time }), {
    success: 'Slot held for 15 minutes. Pay to confirm it.',
    onSuccess: (d) => navigate(`/appointments/${d.appointment._id}`),
  })
  const location = profile.data?.doctor.location?.coordinates
  const pin = useMemo(() => (location ? [{ lat: location[1], lng: location[0], label: 'Clinic' }] : []), [location])

  return (
    <Query query={profile}>
      {({ doctor, reviews }) => (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">Dr. {doctor.name}</h1>
                  <p className="text-teal-800">{doctor.specialty}</p>
                </div>
                <Stars rating={doctor.rating} count={doctor.totalReviews} />
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-gray-500">Clinic</dt><dd>{[doctor.clinicName, doctor.address].filter(Boolean).join(', ') || '—'}</dd></div>
                <div><dt className="text-gray-500">Consultation fee</dt><dd>{rupees(doctor.consultationFee)}</dd></div>
                <div>
                  <dt className="text-gray-500">Medical registration</dt>
                  <dd>{doctor.isNmcVerified ? <Badge status="approved">Number checked</Badge> : 'Not provided'}</dd>
                </div>
              </dl>
              {doctor.bio && <p className="mt-4 whitespace-pre-line text-sm text-gray-700">{doctor.bio}</p>}
            </Card>

            <Card>
              <h2 className="font-semibold">Book a visit</h2>
              {slots.isPending ? <Loading /> : !days?.length ? (
                <Empty>This doctor hasn&apos;t opened any days for booking yet.</Empty>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Day">
                    {days.map((d) => (
                      <button key={d} onClick={() => { setDate(d); setTime(null) }}
                        className={`rounded-md border px-3 py-1.5 text-sm ${d === date ? 'border-teal-700 bg-teal-700 text-white' : 'border-gray-300 hover:border-teal-600'}`}>
                        {day(d)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Time">
                    {slots.data.slots.length === 0 && <p className="text-sm text-gray-500">No open times left on this day.</p>}
                    {slots.data.slots.map((t) => (
                      <button key={t} onClick={() => setTime(t)} aria-pressed={t === time}
                        className={`rounded-md border px-3 py-1.5 text-sm tabular-nums ${t === time ? 'border-teal-700 bg-teal-50 font-medium text-teal-800' : 'border-gray-300 hover:border-teal-600'}`}>
                        {clock(t)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    {!user ? (
                      <Button onClick={() => navigate(`/login?next=/doctors/${id}`)}>Log in to book</Button>
                    ) : user.role !== 'patient' ? (
                      <p className="text-sm text-gray-500">Log in with a patient account to book.</p>
                    ) : (
                      <Button disabled={!time} loading={book.isPending} onClick={() => book.mutate()}>
                        {time ? `Book ${day(date)}, ${clock(time)} · ${rupees(doctor.consultationFee)}` : 'Pick a time'}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>

            <Card>
              <h2 className="font-semibold">Reviews</h2>
              {reviews.length === 0 ? <Empty>No reviews yet.</Empty> : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {reviews.map((r, i) => (
                    <li key={i} className="py-3 text-sm">
                      <p><span className="text-amber-500">{'★'.repeat(r.rating)}</span><span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span> · {r.patientName}</p>
                      {r.comment && <p className="mt-1 text-gray-700">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <div className="space-y-3">
            {pin.length > 0 && <MapView points={pin} className="h-64" />}
            <Link to="/doctors" className="text-sm text-teal-700 hover:underline">← Back to search</Link>
          </div>
        </div>
      )}
    </Query>
  )
}
