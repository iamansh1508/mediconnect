import apiClient from './api'

export const bookAppointment = async (data) => {
  const response = await apiClient.post('/appointments/book', data)
  return response.data
}

export const fetchMyAppointments = async () => {
  const response = await apiClient.get('/appointments/my')
  return response.data
}

export const cancelAppointment = async (appointmentId) => {
  const response = await apiClient.delete(`/appointments/${appointmentId}`)
  return response.data
}

export const fetchPrescription = async (prescriptionId) => {
  const response = await apiClient.get(`/prescriptions/${prescriptionId}`)
  return response.data
}

export const createPrescription = async (data) => {
  const response = await apiClient.post('/prescriptions', data)
  return response.data
}
