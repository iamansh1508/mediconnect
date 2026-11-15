import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api, del, post, useAction, useApi } from '../../lib/api'
import { useLiveQueue } from '../../lib/socket'
import { clock, day, rupees, todayIST } from '../../lib/format'
import { Badge, Button, Card, Field, Query } from '../../components/ui'

const HOLD_MS = 15 * 60 * 1000

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = resolve
    s.onerror = () => reject(new Error("Couldn't load Razorpay. Check your connection and try again."))
    document.body.appendChild(s)
  })
}

function PayButton({ appointment, refetch }) {
  const [busy, setBusy] = useState(false)

  async function pay() {
    setBusy(true)
    try {
      const order = await post('/payments/order', { appointmentId: appointment._id })
      if (order.testMode) {
        await post('/payments/test-pay', { appointmentId: appointment._id })
        toast.success('Paid (test mode). You are in the queue.')
        return refetch()
      }
      await loadCheckout()
      new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'MediConnect',
        description: `Visit with Dr. ${appointment.doctorId.name}`,
        handler: async (r) => {
          try {
            await post('/payments/verify', r)
            toast.success('Payment received. You are in the queue.')
          } catch (e) {
            toast.error(`${e.message} If money left your account, the booking will confirm shortly.`)
          }
          refetch()
        },
        theme: { color: '#0f766e' },
      }).open()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return <Button onClick={pay} loading={busy}>Pay {rupees(appointment.fee)}</Button>
}

function HoldTimer({ createdAt, expired }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = new Date(createdAt).getTime() + HOLD_MS - now
  if (expired || left <= 0) return null
  return <span className="tabular-nums">{Math.floor(left / 60000)}:{String(Math.floor(left / 1000) % 60).padStart(2, '0')}</span>
}

function ReviewForm({ id }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const review = useAction(() => post(`/appointments/${id}/review`, { rating, comment: comment || undefined }), { success: 'Thanks for the review.' })
  return (
    <form onSubmit={(e) => { e.preventDefault(); review.mutate() }} className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium text-gray-700">How was your visit?</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={n === rating}
              className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-gray-300'}`}>★</button>
          ))}
        </div>
      </fieldset>
      <Field label="Comment (optional)" as="textarea" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      <Button type="submit" loading={review.isPending}>Post review</Button>
    </form>
  )
}

export default function AppointmentDetail() {
  const { id } = useParams()
  const q = useApi(`/appointments/${id}`)
  const [livePosition, setLivePosition] = useState(null)
  const [called, setCalled] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const a = q.data?.appointment
  const waiting = a?.status === 'confirmed' && !a.calledAt

  useLiveQueue(waiting ? id : null, {
    onOrder: (order) => {
      const i = order.indexOf(id)
      if (i >= 0) setLivePosition(i + 1)
      else q.refetch()
    },
    onCalled: (d) => {
      if (d.appointmentId !== id) return
      setCalled(true)
      toast.success("It's your turn. Please go in.", { duration: 10000 })
      q.refetch()
    },
  })

  const cancel = useAction(() => del(`/appointments/${id}`), {
    success: (d) => (d.appointment.paymentStatus === 'refunded' ? 'Cancelled. Your refund is on its way.' : 'Cancelled.'),
  })

  return (
    <Query query={q}>
      {({ appointment: appt, position, holdExpired }) => {
        const doctor = appt.doctorId
        const expired = holdExpired || (appt.status === 'booked' && Date.now() > new Date(appt.createdAt).getTime() + HOLD_MS)
        const place = livePosition ?? position
        return (
          <div className="mx-auto max-w-2xl space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">Appointment</p>
                  <h1 className="text-xl font-semibold">Dr. {doctor.name}</h1>
                  <p className="text-sm text-gray-600">{doctor.specialty} · {[doctor.clinicName, doctor.address].filter(Boolean).join(', ')}</p>
                </div>
                <Badge status={appt.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-gray-500">When</dt><dd>{day(appt.date)}, {clock(appt.time)}</dd></div>
                <div><dt className="text-gray-500">Fee</dt><dd>{rupees(appt.fee)}</dd></div>
                <div><dt className="text-gray-500">Payment</dt><dd><Badge status={appt.paymentStatus} /></dd></div>
              </dl>
            </Card>

            {appt.status === 'booked' && (
              <Card className={expired ? 'border-red-200' : 'border-amber-200 bg-amber-50'}>
                {expired ? (
                  <p className="text-sm">
                    Your 15-minute hold on this slot ran out before payment.{' '}
                    <Link to={`/doctors/${doctor._id}`} className="font-medium text-teal-700 underline">Book again</Link>
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm">
                      This slot is held for you for <strong><HoldTimer createdAt={appt.createdAt} /></strong>. Pay to confirm it.
                    </p>
                    <PayButton appointment={appt} refetch={q.refetch} />
                  </div>
                )}
              </Card>
            )}

            {appt.status === 'confirmed' && (
              <Card className="border-teal-200 bg-teal-50 text-center">
                {appt.calledAt || called ? (
                  <p className="text-lg font-semibold text-teal-900">It&apos;s your turn. Please go in.</p>
                ) : appt.date === todayIST() && place ? (
                  <>
                    <p className="text-sm text-teal-900">Your place in the queue</p>
                    <p className="text-5xl font-semibold tabular-nums text-teal-900" aria-live="polite">#{place}</p>
                    <p className="mt-1 text-sm text-teal-900">{place === 1 ? "You're next." : `${place - 1} ${place === 2 ? 'person' : 'people'} ahead of you.`} This updates live; we&apos;ll also text you.</p>
                  </>
                ) : (
                  <p className="text-sm text-teal-900">You&apos;re booked. On {day(appt.date)} your live place in the queue shows here.</p>
                )}
              </Card>
            )}

            {appt.prescription && (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">Prescription</h2>
                  <a
                    href={`/api/v1/appointments/${id}/prescription.pdf`}
                    // A plain link can't refresh an expired login, so check (and refresh) the session first.
                    onClick={async (e) => { e.preventDefault(); const href = e.currentTarget.href; await api('/auth/me'); window.location.href = href }}
                    className="text-sm font-medium text-teal-700 underline"
                  >Download PDF</a>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {appt.prescription.medicines.map((m, i) => (
                    <li key={i}>
                      <span className="font-medium">{m.name}</span>
                      <span className="text-gray-600"> — {[m.dosage, m.duration].filter(Boolean).join(', ')}</span>
                      {m.instructions && <p className="text-gray-500">{m.instructions}</p>}
                    </li>
                  ))}
                </ul>
                {appt.prescription.notes && <p className="mt-3 whitespace-pre-line text-sm text-gray-700">{appt.prescription.notes}</p>}
              </Card>
            )}

            {appt.status === 'completed' && (
              <Card>
                {appt.review ? (
                  <p className="text-sm">You rated this visit <span className="text-amber-500">{'★'.repeat(appt.review.rating)}</span>{appt.review.comment && <>: “{appt.review.comment}”</>}</p>
                ) : <ReviewForm id={id} />}
              </Card>
            )}

            {['booked', 'confirmed'].includes(appt.status) && !appt.calledAt && !expired && (
              <div className="text-right">
                {confirmCancel ? (
                  <div className="inline-flex flex-wrap items-center justify-end gap-2 text-sm">
                    <span>{appt.paymentStatus === 'paid' ? `Cancel and refund ${rupees(appt.fee)}?` : 'Cancel this booking?'}</span>
                    <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Yes, cancel</Button>
                    <Button variant="secondary" onClick={() => setConfirmCancel(false)}>Keep it</Button>
                  </div>
                ) : (
                  <Button variant="danger" onClick={() => setConfirmCancel(true)}>Cancel appointment</Button>
                )}
              </div>
            )}
          </div>
        )
      }}
    </Query>
  )
}
