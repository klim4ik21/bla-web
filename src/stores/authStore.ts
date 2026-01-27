import { create } from 'zustand'
import { authApi } from '../api/auth'
import type { User } from '../api/auth'
import { ApiError } from '../api/client'

type AuthState = {
  user: User | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  register: (email: string, password: string) => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
  setUsername: (username: string) => Promise<boolean>
  uploadAvatar: (file: File) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  register: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.register(email, password)
      localStorage.setItem('access_token', response.access_token)
      localStorage.setItem('refresh_token', response.refresh_token)
      set({ user: response.user, isLoading: false })
      return true
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed'
      set({ error: message, isLoading: false })
      return false
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.login(email, password)
      localStorage.setItem('access_token', response.access_token)
      localStorage.setItem('refresh_token', response.refresh_token)
      set({ user: response.user, isLoading: false })
      return true
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed'
      set({ error: message, isLoading: false })
      return false
    }
  },

  setUsername: async (username) => {
    set({ isLoading: true, error: null })
    try {
      const user = await authApi.setUsername(username)
      set({ user, isLoading: false })
      return true
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to set username'
      set({ error: message, isLoading: false })
      return false
    }
  },

  uploadAvatar: async (file) => {
    set({ isLoading: true, error: null })
    try {
      const user = await authApi.uploadAvatar(file)
      set({ user, isLoading: false })
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload avatar'
      set({ error: message, isLoading: false })
      return false
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken)
      } catch {
        // Ignore logout errors
      }
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null })
  },

  checkAuth: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      set({ isInitialized: true })
      return
    }

    try {
      const user = await authApi.me()
      set({ user, isInitialized: true })
    } catch {
      // Try to refresh token
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const tokens = await authApi.refresh(refreshToken)
          localStorage.setItem('access_token', tokens.access_token)
          localStorage.setItem('refresh_token', tokens.refresh_token)
          const user = await authApi.me()
          set({ user, isInitialized: true })
          return
        } catch {
          // Refresh failed
        }
      }
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ isInitialized: true })
    }
  },

  clearError: () => set({ error: null }),
}))
