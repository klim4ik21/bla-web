import { api, API_BASE_URL } from './client'

export interface User {
  id: string
  email: string
  username: string | null
  avatar_url: string | null
  status: string
  created_at: string
  updated_at: string
}

export type AuthResponse = {
  user: User
  access_token: string
  refresh_token: string
}

export type TokenResponse = {
  access_token: string
  refresh_token: string
}

export const authApi = {
  register: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { email, password }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  refresh: (refresh_token: string) =>
    api.post<TokenResponse>('/auth/refresh', { refresh_token }),

  setUsername: (username: string) =>
    api.post<User>('/auth/username', { username }),

  me: () => api.get<User>('/auth/me'),

  logout: (refresh_token: string) =>
    api.post('/auth/logout', { refresh_token }),

  uploadAvatar: async (file: File): Promise<User> => {
    const formData = new FormData()
    formData.append('avatar', file)

    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE_URL}/auth/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || 'Upload failed')
    }

    return response.json()
  },
}
