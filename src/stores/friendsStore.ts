import { create } from 'zustand'
import { friendsApi } from '../api/friends'
import type { Friend, FriendRequest } from '../api/friends'
import { ApiError } from '../api/client'

type FriendsState = {
  friends: Friend[]
  incomingRequests: FriendRequest[]
  outgoingRequests: FriendRequest[]
  isLoading: boolean
  error: string | null
  isHydrated: boolean

  // Actions
  sendRequest: (username: string) => Promise<boolean>
  acceptRequest: (requestId: string) => Promise<boolean>
  declineRequest: (requestId: string) => Promise<boolean>
  cancelRequest: (requestId: string) => Promise<boolean>
  removeFriend: (userId: string) => Promise<boolean>
  clearError: () => void
  reset: () => void
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  isLoading: false,
  error: null,
  isHydrated: false,

  sendRequest: async (username) => {
    set({ isLoading: true, error: null })
    try {
      const result = await friendsApi.sendRequestByUsername(username)
      // If auto-accepted, the RELATIONSHIP_ADD event will add the friend
      // If pending, add to outgoing requests
      if (result.status === 'pending') {
        // Request with user info will come via FRIEND_REQUEST_CREATE to target
        // For sender, we need to add to outgoing
        const state = get()
        const outgoingReq: FriendRequest = {
          id: result.id,
          status: result.status,
          created_at: result.created_at,
          user: { id: '', email: '', username, avatar_url: null, status: 'offline', created_at: '', updated_at: '' },
        }
        set({ outgoingRequests: [...state.outgoingRequests, outgoingReq], isLoading: false })
      } else {
        set({ isLoading: false })
      }
      return true
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send request'
      set({ error: message, isLoading: false })
      return false
    }
  },

  acceptRequest: async (requestId) => {
    try {
      await friendsApi.acceptRequest(requestId)
      // RELATIONSHIP_ADD and FRIEND_REQUEST_DELETE events will update state
      const state = get()
      set({
        incomingRequests: state.incomingRequests.filter((r) => r.id !== requestId),
      })
      return true
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to accept request'
      set({ error: message })
      return false
    }
  },

  declineRequest: async (requestId) => {
    try {
      await friendsApi.declineRequest(requestId)
      const state = get()
      set({
        incomingRequests: state.incomingRequests.filter((r) => r.id !== requestId),
      })
      return true
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to decline request'
      set({ error: message })
      return false
    }
  },

  cancelRequest: async (requestId) => {
    try {
      await friendsApi.cancelRequest(requestId)
      const state = get()
      set({
        outgoingRequests: state.outgoingRequests.filter((r) => r.id !== requestId),
      })
      return true
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to cancel request'
      set({ error: message })
      return false
    }
  },

  removeFriend: async (userId) => {
    try {
      await friendsApi.removeFriend(userId)
      // RELATIONSHIP_REMOVE event will update state
      const state = get()
      set({
        friends: state.friends.filter((f) => f.user.id !== userId),
      })
      return true
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to remove friend'
      set({ error: message })
      return false
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    isLoading: false,
    error: null,
    isHydrated: false,
  }),
}))
