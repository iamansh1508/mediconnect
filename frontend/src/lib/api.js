import { QueryClient, useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: (n, e) => e.status >= 500 && n < 2 } },
})

let refreshing = null
let onLoggedOut = () => {}
export const setLoggedOutHandler = (fn) => { onLoggedOut = fn }

// Concurrent 401s share one refresh: refresh tokens work once, so a second refresh would look like theft.
export const refresh = () =>
  (refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST' }).then((r) => r.ok).finally(() => { refreshing = null }))

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh']

export async function api(path, { method = 'GET', body } = {}, retried = false) {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && !retried && !NO_REFRESH.includes(path)) {
    if (await refresh()) return api(path, { method, body }, true)
    onLoggedOut()
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(data?.message || `Request failed (${res.status})`), { status: res.status })
  return data
}

export const useApi = (path, options = {}) => useQuery({ queryKey: [path], queryFn: () => api(path), enabled: !!path, ...options })

// A mutation that toasts the outcome and refreshes every query on screen (there are only a few).
export const useAction = (fn, { success, onSuccess } = {}) =>
  useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      if (success) toast.success(typeof success === 'function' ? success(data) : success)
      queryClient.invalidateQueries()
      onSuccess?.(data, vars)
    },
    onError: (e) => toast.error(e.message),
  })

export const post = (path, body = {}) => api(path, { method: 'POST', body })
export const put = (path, body) => api(path, { method: 'PUT', body })
export const patch = (path, body) => api(path, { method: 'PATCH', body })
export const del = (path) => api(path, { method: 'DELETE' })
