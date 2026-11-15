import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../../../shared/utils/api'

export function CreatePrescriptionPage() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()

  const [appointment, setAppointment] = useState(null)
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '', frequency: '', duration: '', instructions: '' }
  ])
  const [notes, setNotes] = useState('')

  const [isLoadingDetails, setIsLoadingDetails] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [createdPrescription, setCreatedPrescription] = useState(null)

  useEffect(() => {
    fetchAppointmentDetails()
  }, [appointmentId])

  const fetchAppointmentDetails = async () => {
    setIsLoadingDetails(true)
    setError(null)
    try {
      const response = await apiClient.get('/doctors/appointments/today')
      const appts = response.data.appointments || []
      const found = appts.find((a) => a._id === appointmentId)
      if (found) {
        setAppointment(found)
      } else {
        setAppointment({ _id: appointmentId, patientName: 'Patient', doctorName: 'Doctor' })
      }
    } catch (err) {
      setError('Failed to fetch appointment context. Using fallback data.')
      setAppointment({ _id: appointmentId, patientName: 'Patient', doctorName: 'Doctor' })
    } font
    setIsLoadingDetails(false)
  }

  const handleAddMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      { name: '', dosage: '', frequency: '', duration: '', instructions: '' }
    ])
  }

  const handleRemoveMedicine = (index) => {
    setMedicines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleMedicineChange = (index, field, value) => {
    setMedicines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const validateForm = () => {
    if (medicines.length === 0) {
      setError('At least one medicine is required.')
      return false
    }

    for (let i = 0; i < medicines.length; i++) {
      const med = medicines[i]
      if (!med.name.trim()) {
        setError(`Medicine #${i + 1} requires a name.`)
        return false
      }
      if (!med.dosage.trim()) {
        setError(`Medicine #${i + 1} requires a dosage.`)
        return false
      }
      if (!med.frequency.trim()) {
        setError(`Medicine #${i + 1} requires a frequency.`)
        return false
      }
      if (!med.duration.trim()) {
        setError(`Medicine #${i + 1} requires a duration.`)
        return false
      }
    }

    setError(null)
    return true
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await apiClient.post('/doctors/prescriptions', {
        appointmentId,
        medicines,
        notes
      })

      setCreatedPrescription(response.data)
    } catch (err) {
      if (err.response) {
        setError(err.response.data.message || 'Failed to create prescription.')
      } else {
        setError('Network error. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Prescription</h1>

        {createdPrescription ? (
          <div className="bg-green-50 border border-green-200 p-6 rounded-lg space-y-4 text-center">
            <h2 className="text-xl font-bold text-green-800">Prescription Created Successfully!</h2>
            <p className="text-gray-700">Prescription ID: <span className="font-mono">{createdPrescription.prescriptionId || createdPrescription._id}</span></p>
            {createdPrescription.pdfUrl && (
              <a
                href={createdPrescription.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
              >
                View / Download PDF
              </a>
            )}
            <div>
              <button
                onClick={() => navigate('/doctor')}
                className="mt-4 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded font-medium transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border border-gray-200">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Patient Name</label>
                <p className="font-bold text-gray-900 text-base">{appointment?.patientName || 'Patient'}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase">Doctor Name</label>
                <p className="font-bold text-gray-900 text-base">{appointment?.doctorName || 'Doctor'}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Medicines List</h2>
                <button
                  type="button"
                  onClick={handleAddMedicine}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-semibold transition-colors"
                >
                  + Add Medicine
                </button>
              </div>

              <div className="space-y-4">
                {medicines.map((med, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50 relative space-y-3">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-sm font-bold text-gray-700">Medicine #{index + 1}</span>
                      {medicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(index)}
                          className="text-red-600 hover:text-red-800 text-xs font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Medicine Name</label>
                        <input
                          type="text"
                          value={med.name}
                          onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                          placeholder="e.g. Paracetamol"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Dosage</label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                          placeholder="e.g. 500mg"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => handleMedicineChange(index, 'frequency', e.target.value)}
                          placeholder="e.g. Twice a day"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
                        <input
                          type="text"
                          value={med.duration}
                          onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                          placeholder="e.g. 5 days"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Instructions (Optional)</label>
                      <textarea
                        value={med.instructions}
                        onChange={(e) => handleMedicineChange(index, 'instructions', e.target.value)}
                        placeholder="e.g. Take after meals"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Doctor's Notes / Special Advice</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes for patient..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Prescription...' : 'Issue Prescription'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
