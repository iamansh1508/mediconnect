import { useState } from 'react'
import { post, useAction } from '../../lib/api'
import { Button, Field } from '../../components/ui'

const blank = { name: '', dosage: '', duration: '', instructions: '' }

export default function PrescriptionForm({ appointmentId, onDone }) {
  const [medicines, setMedicines] = useState([{ ...blank }])
  const [notes, setNotes] = useState('')
  const edit = (i, key, value) => setMedicines((ms) => ms.map((m, j) => (j === i ? { ...m, [key]: value } : m)))
  const save = useAction(
    () => post(`/appointments/${appointmentId}/prescription`, {
      medicines: medicines.filter((m) => m.name.trim()).map((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v.trim()))),
      notes: notes.trim() || undefined,
    }),
    { success: 'Prescription saved. The patient can download it now.', onSuccess: onDone },
  )

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="space-y-4">
      {medicines.map((m, i) => (
        <fieldset key={i} className="grid gap-3 rounded-md border border-gray-200 p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-medium text-gray-500">Medicine {i + 1}</legend>
          <Field label="Name and strength" value={m.name} onChange={(e) => edit(i, 'name', e.target.value)} required={i === 0} placeholder="Paracetamol 650 mg" />
          <Field label="Dosage" value={m.dosage} onChange={(e) => edit(i, 'dosage', e.target.value)} placeholder="1 tablet twice a day" />
          <Field label="Duration" value={m.duration} onChange={(e) => edit(i, 'duration', e.target.value)} placeholder="5 days" />
          <Field label="Instructions" value={m.instructions} onChange={(e) => edit(i, 'instructions', e.target.value)} placeholder="After food" />
          {medicines.length > 1 && (
            <button type="button" onClick={() => setMedicines((ms) => ms.filter((_, j) => j !== i))} className="text-left text-sm text-red-700 hover:underline sm:col-span-2">
              Remove medicine {i + 1}
            </button>
          )}
        </fieldset>
      ))}
      <Button variant="secondary" onClick={() => setMedicines((ms) => [...ms, { ...blank }])}>Add another medicine</Button>
      <Field label="Notes for the patient" as="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      <Button type="submit" loading={save.isPending}>Save prescription and finish visit</Button>
    </form>
  )
}
