import apiClient from './api'

export const fetchDoctors = async (params = {}) => {
  const queryParams = new URLSearchParams()
  
  if (params.specialty) {
    queryParams.append('specialty', params.specialty)
  }
  if (params.minRating) {
    queryParams.append('minRating', params.minRating)
  }
  if (params.cursor) {
    queryParams.append('cursor', params.cursor)
  }
  queryParams.append('limit', params.limit || 12)
  
  const response = await apiClient.get(`/doctors?${queryParams.toString()}`)
  return response.data
}

export const fetchDoctorById = async (doctorId) => {
  const response = await apiClient.get(`/doctors/${doctorId}`)
  return response.data
}

export const searchDoctorsGeo = async (params) => {
  const { lat, lng, radius = 5000, specialty, minRating, cursor, limit = 20 } = params
  
  const queryParams = new URLSearchParams()
  queryParams.append('lat', lat)
  queryParams.append('lng', lng)
  queryParams.append('radius', radius)
  
  if (specialty) queryParams.append('specialty', specialty)
  if (minRating) queryParams.append('minRating', minRating)
  if (cursor) queryParams.append('cursor', cursor)
  queryParams.append('limit', limit)
  
  const response = await apiClient.get(`/doctors/search/geo?${queryParams.toString()}`)
  return response.data
}

export const searchDoctorsByText = async (query) => {
  const response = await apiClient.get(`/doctors/search?q=${encodeURIComponent(query)}`)
  return response.data
}

export const updateDoctorProfile = async (data) => {
  const response = await apiClient.put('/doctors/profile', data)
  return response.data
}

export const verifyNMC = async (nmcNumber) => {
  const response = await apiClient.post('/doctors/verify-nmc', { nmcRegistrationNumber: nmcNumber })
  return response.data
}
