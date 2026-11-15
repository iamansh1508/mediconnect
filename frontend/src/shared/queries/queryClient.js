import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: function (failureCount, error) {
        if (error) {
          if (error.response) {
            if (error.response.status === 401) {
              return false
            }
            if (error.response.status === 403) {
              return false
            }
          }
          if (error.status === 401) {
            return false
          }
          if (error.status === 403) {
            return false
          }
        }
        if (failureCount < 3) {
          return true
        }
        return false
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
    mutations: {
      retry: 0,
    },
  },
})
