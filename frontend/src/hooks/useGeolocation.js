import { useState, useEffect } from 'react'

export function useGeolocation() {
  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      setIsLoading(false)
      return
    }

    const successCallback = (position) => {
      setLatitude(position.coords.latitude)
      setLongitude(position.coords.longitude)
      setIsLoading(false)
    }

    const errorCallback = (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          setError('Location permission denied. Please enable location access.')
          break
        case err.POSITION_UNAVAILABLE:
          setError('Location information unavailable.')
          break
        case err.TIMEOUT:
          setError('Location request timed out.')
          break
        default:
          setError('An unknown error occurred.')
          break
      }
      setIsLoading(false)
    }

    navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    })
  }, [])

  return { latitude, longitude, error, isLoading }
}
