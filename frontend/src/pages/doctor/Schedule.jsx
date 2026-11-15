import { useState } from 'react'
import { del, put, useAction, useApi } from '../../lib/api'
import { clock, day, todayIST } from '../../lib/format'
import { Button, Card, Empty, Field, Page, Query } from '../../components/ui'

export default function Schedule() {
  const me = useApi('/doctors/me')
  const [form, setForm] = useState({ date: todayIST(), from: '09:00', to: '13:00' })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = useAction(() => put('/doctors/me/schedule', form), { success: `Hours saved for ${day(form.date)}.` })
  const remove = useAction((date) => del(`/doctors/me/schedule/${date}`), { success: 'Day removed.' })

  return (
    <Page title="Opening hours" subtitle="Patients can book any open slot in these hours. Booked visits stay booked if you change them.">
      <Query query={me}>
        {({ doctor }) => {
          const upcoming = doctor.schedule.filter((d) => d.date >= todayIST())
          return (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <h2 className="font-semibold">Open a day</h2>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="mt-4 space-y-4">
                <Field label="Day" type="date" min={todayIST()} value={form.date} onChange={set('date')} required />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From" type="time" value={form.from} onChange={set('from')} required />
                  <Field label="To" type="time" value={form.to} onChange={set('to')} required />
                </div>
                <p className="text-xs text-gray-500">Slots are {doctor.slotMinutes} minutes long. Change this in your clinic profile.</p>
                <Button type="submit" loading={save.isPending}>Save hours</Button>
              </form>
            </Card>
            <Card>
              <h2 className="font-semibold">Upcoming days</h2>
              {upcoming.length === 0 ? <Empty>No days open yet.</Empty> : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {upcoming.map((d) => (
                    <li key={d.date} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        <span className="font-medium">{day(d.date)}</span>
                        <span className="text-gray-600"> · {clock(d.slots[0])}–{clock(d.slots.at(-1))} · {d.slots.length} slots</span>
                      </span>
                      <Button variant="danger" className="!px-3 !py-1" loading={remove.isPending && remove.variables === d.date} onClick={() => remove.mutate(d.date)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          )
        }}
      </Query>
    </Page>
  )
}
