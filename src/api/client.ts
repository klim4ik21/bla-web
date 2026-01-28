export const API_BASE_URL = "https://api.joinbla.ru/api"// 'https://api.joinbla.ru/api'
const API_URL = API_BASE_URL

type RequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  skipAuth?: boolean
}

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Token refresh state to prevent race conditions
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function refreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) return false

    const tokens = await response.json()
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    return true
  } catch {
    return false
  }
}

async function handleTokenRefresh(): Promise<boolean> {
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = refreshToken().finally(() => {
    isRefreshing = false
    refreshPromise = null
  })

  return refreshPromise
}

async function request<T>(endpoint: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options

  const token = localStorage.getItem('access_token')
  if (token && !skipAuth) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_URL}${endpoint}`, config)

  // Handle 401 - try to refresh token and retry once
  if (response.status === 401 && !isRetry && !skipAuth) {
    const refreshed = await handleTokenRefresh()
    if (refreshed) {
      // Retry the request with new token
      return request<T>(endpoint, options, true)
    }
    // Refresh failed - clear tokens and let the error propagate
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new ApiError(response.status, error.error || 'Request failed')
  }

  // Handle 204 No Content or empty responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'POST', body }),
  put: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PUT', body }),
  patch: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: 'PATCH', body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
}

export { ApiError }
