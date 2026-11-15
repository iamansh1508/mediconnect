import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../../../shared/utils/api'

function MedicineList({ medicines }) {
  if (!medicines || medicines.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-500">No medicines prescribed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {medicines.map((medicine, index) => (
        <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold text-gray-900">{medicine.name}</h3>
            <span className="text-sm text-blue-600 font-medium">
              {medicine.dosage || 'As directed'}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-gray-500">Frequency</p>
              <p className="font-medium">{medicine.frequency || 'As needed'}</p>
            </div>
            <div>
              <p className="text-gray-500">Duration</p>
              <p className="font-medium">{medicine.duration || 'Until resolved'}</p>
            </div>
          </div>
          {medicine.instructions && (
            <div className="mt-3">
              <p className="text-gray-500 text-sm">Instructions</p>
              <p className="text-gray-700 text-sm">{medicine.instructions}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function PrescriptionPage() {
  const { prescriptionId } = useParams()
  const navigate = useNavigate()

  const [prescription, setPrescription] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPrescription()
  }, [prescriptionId])

  const fetchPrescription = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.get(`/prescriptions/${prescriptionId}`)
      setPrescription(response.data)
    } catch (err) {
      setError(err.message || 'Failed to fetch prescription details.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadPDF = () => {
    if (prescription && prescription.pdfUrl) {
      window.open(prescription.pdfUrl, '_blank')
    }
  }

  const handleBackToAppointment = () => {
    if (prescription && prescription.appointmentId) {
      navigate(`/patient/appointments/${prescription.appointmentId}`)
    } else {
      navigate('/patient/appointments')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded shadow-sm">
          <p className="font-semibold">Error Loading Prescription</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchPrescription}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!prescription) {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-8">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 text-yellow-700 rounded shadow-sm">
          <p className="font-semibold">Prescription Not Found</p>
          <p className="text-sm mt-1">The requested prescription could not be found in your records.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Prescription</h1>
            <p className="text-gray-600 mt-1">Issued by Dr. {prescription.doctorName || 'Doctor'}</p>
          </div>
          <div className="mt-4 md:mt-0">
            <p className="text-sm text-gray-500">Appointment Date</p>
            <p className="font-medium text-gray-900">{prescription.appointmentDate || 'Date not available'}</p>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Medicines Prescribed</h2>
          <MedicineList medicines={prescription.medicines} />
        </div>

        {prescription.notes && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Doctor's Notes</h2>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap">{prescription.notes}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between space-y-3 sm:space-y-0">
        <button
          onClick={handleBackToAppointment}
          className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded shadow-sm transition-colors"
        >
          Back to Appointment
        </button>

        {prescription.pdfUrl && (
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow-sm transition-colors"
          >
            Download PDF
          </button>
        )}
      </div>
    </div>
  )
}
