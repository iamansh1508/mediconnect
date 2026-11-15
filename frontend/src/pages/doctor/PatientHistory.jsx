import { useParams } from 'react-router-dom'
import { useApi } from '../../lib/api'
import { clock, day } from '../../lib/format'
import { Badge, Card, Page, Query } from '../../components/ui'

export default function PatientHistory() {
  const { patientId } = useParams()
  const q = useApi(`/doctors/me/patients/${patientId}`)
  return (
    <Query query={q}>
      {({ patient, visits }) => (
        <Page title={patient.name} subtitle={`${patient.phone} · ${patient.email} · ${visits.length} visit${visits.length > 1 ? 's' : ''} with you`}>
          <div className="space-y-4">
            {visits.map((v) => (
              <Card key={v._id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{day(v.date)}, {clock(v.time)}</p>
                  <Badge status={v.status} />
                </div>
                {v.prescription ? (
                  <ul className="mt-3 space-y-1 text-sm">
                    {v.prescription.medicines.map((m, i) => (
                      <li key={i}><span className="font-medium">{m.name}</span> <span className="text-gray-600">{[m.dosage, m.duration, m.instructions].filter(Boolean).join(' · ')}</span></li>
                    ))}
                    {v.prescription.notes && <li className="text-gray-700">Notes: {v.prescription.notes}</li>}
                  </ul>
                ) : <p className="mt-2 text-sm text-gray-500">No prescription.</p>}
                {v.review && <p className="mt-2 text-sm text-gray-600">Patient rated <span className="text-amber-500">{'★'.repeat(v.review.rating)}</span>{v.review.comment && ` — “${v.review.comment}”`}</p>}
              </Card>
            ))}
          </div>
        </Page>
      )}
    </Query>
  )
}
