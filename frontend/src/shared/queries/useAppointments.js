import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMyAppointments, cancelAppointment, bookAppointment } from '../../services/appointmentService'

export function useMyAppointments() {
  return useQuery({
    queryKey: ['myAppointments'],
    queryFn: fetchMyAppointments,
  })
}

export function useCancelAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (appointmentId) => cancelAppointment(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries(['myAppointments'])
    },
  })
}

export function useBookAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data) => bookAppointment(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['myAppointments'])
    },
  })
}
