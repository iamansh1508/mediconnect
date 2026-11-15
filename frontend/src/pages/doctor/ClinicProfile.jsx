import { useMemo, useState } from 'react'
import { put, useAction, useApi } from '../../lib/api'
import { Badge, Button, Card, Field, Page, Query } from '../../components/ui'
import MapView from '../../components/MapView'

function ProfileForm({ doctor }) {
  const [form, setForm] = useState({
    specialty: doctor.specialty || '', consultationFee: doctor.consultationFee ?? 500, clinicName: doctor.clinicName || '',
    address: doctor.address || '', bio: doctor.bio || '', slotMinutes: doctor.slotMinutes, nmcRegistrationNumber: doctor.nmcRegistrationNumber || '',
  })
  const [spot, setSpot] = useState(doctor.location?.coordinates ? { lat: doctor.location.coordinates[1], lng: doctor.location.coordinates[0] } : null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const pin = useMemo(() => (spot ? [{ ...spot, label: 'Your clinic' }] : []), [spot])
  const save = useAction(() => put('/doctors/me', {
    ...Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')),
    consultationFee: Number(form.consultationFee), slotMinutes: Number(form.slotMinutes),
    ...(spot && { location: spot }),
  }), { success: 'Profile saved. Search results update within a minute.' })

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4">
        <Field label="Specialty" value={form.specialty} onChange={set('specialty')} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Consultation fee (₹)" type="number" min={0} value={form.consultationFee} onChange={set('consultationFee')} required />
          <Field label="Slot length" as="select" value={form.slotMinutes} onChange={set('slotMinutes')}>
            {[10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </Field>
        </div>
        <Field label="Clinic name" value={form.clinicName} onChange={set('clinicName')} />
        <Field label="Address" value={form.address} onChange={set('address')} />
        <Field label="About you" as="textarea" rows={4} value={form.bio} onChange={set('bio')} maxLength={2000} />
        <div>
          <Field label="NMC registration number" value={form.nmcRegistrationNumber} onChange={set('nmcRegistrationNumber')} placeholder="NMC123456"
            hint="In this demo the number is only checked for its format (NMC + 6 or more digits)." />
          <p className="mt-2 text-sm">{doctor.isNmcVerified ? <Badge status="approved">Format checked</Badge> : <Badge status="pending">Not checked</Badge>}</p>
        </div>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-semibold">Clinic location</h2>
        <p className="text-sm text-gray-600">Click the map where your clinic is. Patients searching nearby find you by this point.</p>
        <MapView points={pin} onPick={setSpot} className="h-80 cursor-crosshair" />
        <p className="text-xs text-gray-500">{spot ? `${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}` : 'Not set yet.'}</p>
        <Button type="submit" loading={save.isPending} className="w-full">Save profile</Button>
      </Card>
    </form>
  )
}

export default function ClinicProfile() {
  const me = useApi('/doctors/me')
  return (
    <Page title="Clinic profile" subtitle="This is what patients see.">
      <Query query={me}>{({ doctor }) => <ProfileForm doctor={doctor} />}</Query>
    </Page>
  )
}
