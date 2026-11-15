import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'

const steps = [
  ['Find a doctor nearby', 'Search by name or specialty, or see who practises near you on the map.'],
  ['Book and pay', 'Pick an open slot and pay the consultation fee online. The slot is yours.'],
  ['Wait from anywhere', 'Watch your place in the queue update live, and get an SMS when you are next.'],
]

export default function Home() {
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  return (
    <div className="space-y-12">
      <section className="rounded-xl bg-teal-800 px-6 py-12 text-white sm:px-10">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">See a doctor without the waiting room.</h1>
        <p className="mt-3 max-w-xl text-teal-100">Book a slot with a doctor near you, pay online, and follow the clinic queue from your phone.</p>
        <form
          className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
          onSubmit={(e) => { e.preventDefault(); navigate(`/doctors?q=${encodeURIComponent(q.trim())}`) }}
        >
          <label htmlFor="home-search" className="sr-only">Doctor name or specialty</label>
          <input
            id="home-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Doctor name or specialty, e.g. Dermatology"
            className="flex-1 rounded-md border-0 px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
          <Button type="submit" className="bg-white !text-teal-800 hover:bg-teal-50">Search</Button>
        </form>
        <button onClick={() => navigate('/doctors?near=1')} className="mt-4 text-sm text-teal-100 underline underline-offset-4 hover:text-white">
          Or show doctors near my location
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {steps.map(([title, text], i) => (
          <div key={title} className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-teal-700">Step {i + 1}</p>
            <h2 className="mt-1 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{text}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
