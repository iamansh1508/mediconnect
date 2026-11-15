import { useQuery } from '@tanstack/react-query'
import apiClient from '../utils/api'

// Common staleTime for doctor data
const STALE_TIME = 1000 * 60 * 5

// Helper function to extract pagination info
const extractPagination = (response) => ({
  nextCursor: response.data.nextCursor,
  hasNextPage: !!response.data.nextCursor,
  total: response.data.total
})

// Helper function to extract doctor data
const extractDoctors = (response) => response.data.doctors || []

// Helper function to extract schedule data
const extractSchedule = (response) => ({
  slots: response.data.slots || [],
  totalAvailable: response.data.totalAvailable || 0
})

export function useListDoctors(filters = {}) {
  return useQuery({
    queryKey: ['doctors', filters],
    queryFn: async () => {
      const response = await apiClient.get('/doctors', { params: filters })
      return {
        doctors: extractDoctors(response),
        pagination: extractPagination(response)
      }
    },
    staleTime: STALE_TIME
  })
}

export function useSearchDoctors(query) {
  return useQuery({
    queryKey: ['doctors', 'search', query],
    queryFn: async () => {
      const response = await apiClient.get('/doctors/search', { params: { q: query } })
      return {
        doctors: extractDoctors(response)
      }
    },
    enabled: query.length > 2,
    staleTime: STALE_TIME
  })
}

export function useGeospatialSearch(lat, lng, filters = {}) {
  return useQuery({
    queryKey: ['doctors', 'geo', lat, lng, filters],
    queryFn: async () => {
      const response = await apiClient.get('/doctors/search/geo', {
        params: { lat, lng, ...filters, radius: 5000 }
      })
      return {
        doctors: extractDoctors(response),
        pagination: extractPagination(response)
      }
    },
    enabled: !!lat && !!lng,
    staleTime: STALE_TIME
  })
}

export function useDoctorDetail(doctorId) {
  return useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: async () => {
      const response = await apiClient.get(`/doctors/${doctorId}`)
      return {
        doctor: response.data
      }
    },
    enabled: !!doctorId,
    staleTime: STALE_TIME
  })
}

export function useDoctorSchedule(doctorId, date) {
  return useQuery({
    queryKey: ['doctor', doctorId, 'schedule', date],
    queryFn: async () => {
      const response = await apiClient.get(`/doctors/${doctorId}/schedule`, {
        params: { date }
      })
      return extractSchedule(response)
    },
    enabled: !!doctorId && !!date,
    staleTime: STALE_TIME
  })
}
