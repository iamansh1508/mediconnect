import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, useApi } from '../../lib/api'
import { rupees } from '../../lib/format'
import { Button, Empty, ErrorNote, Field, Loading, Page, Stars } from '../../components/ui'
import MapView from '../../components/MapView'

export default function Doctors() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [text, setText] = useState(params.get('q') || '')
  const [q, setQ] = useState(text)
  const [specialty, setSpecialty] = useState('')
  const [minRating, setMinRating] = useState('')
  const [near, setNear] = useState(null)
  const [radiusKm, setRadiusKm] = useState('10')
  const specialties = useApi('/doctors/specialties')

  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => setNear({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => toast.error("We couldn't get your location. Allow location access, or search by name instead."),
  )
  useEffect(() => { if (params.get('near')) locate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const search = new URLSearchParams(Object.entries({ q, specialty, minRating, lat: near?.lat, lng: near?.lng, radiusKm: near && radiusKm })
    .filter(([, v]) => v)).toString()
  const results = useInfiniteQuery({
    queryKey: ['/doctors', search],
    queryFn: ({ pageParam }) => api(`/doctors?${search}${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor,
  })
  const doctors = useMemo(() => results.data?.pages.flatMap((p) => p.doctors) ?? [], [results.data])
  const pins = useMemo(() => doctors.filter((d) => d.location?.coordinates).map((d) => ({
    lat: d.location.coordinates[1], lng: d.location.coordinates[0], label: `Dr. ${d.name}`, onClick: () => navigate(`/doctors/${d._id}`),
  })), [doctors, navigate])

  return (
    <Page title="Find a doctor" subtitle="Only doctors checked by our team are listed.">
      <form onSubmit={(e) => { e.preventDefault(); setQ(text.trim()) }} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Name, specialty or clinic" value={text} onChange={(e) => setText(e.target.value)} className="lg:col-span-2" />
        <Field label="Specialty" as="select" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
          <option value="">Any</option>
          {specialties.data?.specialties.map((s) => <option key={s}>{s}</option>)}
        </Field>
        <Field label="Rating" as="select" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
          <option value="">Any</option>
          <option value="4">4★ and up</option>
          <option value="4.5">4.5★ and up</option>
        </Field>
        <div className="flex items-end"><Button type="submit" className="w-full">Search</Button></div>
        <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-5">
          {near ? (
            <>
              <Field label="Within" as="select" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)}>
                {['2', '5', '10', '25'].map((r) => <option key={r} value={r}>{r} km of me</option>)}
              </Field>
              <Button variant="secondary" onClick={() => setNear(null)}>Search everywhere</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={locate}>Show doctors near me</Button>
          )}
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {results.isPending ? <Loading /> : results.isError ? <ErrorNote error={results.error} /> : doctors.length === 0 ? (
            <Empty>No doctors match. Try a wider area or fewer filters.</Empty>
          ) : (
            <ul className="space-y-3">
              {doctors.map((d) => (
                <li key={d._id}>
                  <Link to={`/doctors/${d._id}`} className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-teal-600">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-semibold">Dr. {d.name}</h2>
                      <Stars rating={d.rating} count={d.totalReviews} />
                    </div>
                    <p className="text-sm text-teal-800">{d.specialty}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {[d.clinicName, d.address].filter(Boolean).join(', ')}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      {rupees(d.consultationFee)} per visit{d.distanceKm !== undefined && <> · {d.distanceKm} km away</>}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {results.hasNextPage && (
            <Button variant="secondary" className="mt-4 w-full" loading={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>
              Show more doctors
            </Button>
          )}
        </div>
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-4"><MapView points={pins} me={near} className="h-96" /></div>
        </div>
      </div>
    </Page>
  )
}
