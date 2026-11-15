import axios from 'axios'

/**
 * MediConnect Axios API Client
 * Handles authentication, token refresh, and error handling
 */

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  timeout: 10000,
})

// Track whether we're currently refreshing the token
let isRefreshing = false

// Queue of requests waiting for token refresh
let failedQueue = []

/**
 * Process queued requests that failed due to 401
 */
const processQueue = (token, originalRequest) => {
  failedQueue.forEach((failedRequest) => {
    if (originalRequest && failedRequest.error && failedRequest.error.config) {
      failedRequest.error.config.headers['Authorization'] = `Bearer ${token}`
      apiClient(failedRequest.error.config)
        .then((response) => {
          failedRequest.resolve(response)
        })
        .catch((error) => {
          failedRequest.reject(error)
        })
    }
  })
  
  failedQueue = []
}

/**
 * Interceptor: Add Authorization header to requests
 */
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('accessToken')
    
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`
    }
    
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * Interceptor: Handle 401 and refresh token
 */
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    
    if (error.response && error.response.status === 401) {
      if (!isRefreshing && originalRequest.url !== '/auth/refresh-token') {
        isRefreshing = true
        
        try {
          const refreshToken = localStorage.getItem('refreshToken')
          
          if (!refreshToken) {
            throw new Error('No refresh token available')
          }
          
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/auth/refresh-token`,
            { refreshToken }
          )
          
          const newAccessToken = response.data.accessToken
          const newRefreshToken = response.data.refreshToken
          
          localStorage.setItem('accessToken', newAccessToken)
          localStorage.setItem('refreshToken', newRefreshToken)
          
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`
          
          processQueue(newAccessToken, originalRequest)
          
          return apiClient(originalRequest)
          
        } catch (refreshError) {
          console.error('[API] Token refresh failed:', refreshError.message)
          
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          
          failedQueue.forEach((failedRequest) => {
            failedRequest.reject(new Error('Authentication expired. Please login again.'))
          })
          failedQueue = []
          
          window.location.href = '/login'
          
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
        
      } else if (originalRequest.url === '/auth/refresh-token') {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
      }
      
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers['Authorization'] = `Bearer ${token}`
        return apiClient(originalRequest)
      })
    }
    
    if (error.response) {
      const errorMessage = error.response.data?.message || error.response.statusText
      console.error(`[API] ${error.response.status}: ${errorMessage}`)
      
      return Promise.reject({
        statusCode: error.response.status,
        message: errorMessage,
        data: error.response.data
      })
    } else if (error.request) {
      console.error('[API] No response received from server')
      return Promise.reject({
        statusCode: 0,
        message: 'Network error - please check your connection'
      })
    } else {
      console.error('[API] Error:', error.message)
      return Promise.reject({
        statusCode: 500,
        message: error.message || 'An unexpected error occurred'
      })
    }
  }
)

/**
 * Helper functions for common HTTP methods
 */
export const apiGet = (url, config) => apiClient.get(url, config)
export const apiPost = (url, data, config) => apiClient.post(url, data, config)
export const apiPut = (url, data, config) => apiClient.put(url, data, config)
export const apiDelete = (url, config) => apiClient.delete(url, config)

export default apiClient
