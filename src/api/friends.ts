import { api } from './client'
import type { User } from './auth'

export interface Friend {
  friendship_id: string
  user: User
  since: string
}

export interface FriendRequest {
  id: string
  status: 'pending' | 'accepted' | 'declined'
  user: User
  created_at: string
}

export interface Block {
  id: string
  user: User
  created_at: string
}

export interface FriendRequestResponse {
  id: string
  status: 'pending' | 'accepted'
  created_at: string
}

export const friendsApi = {
  // Friends
  getFriends: () => api.get<Friend[]>('/friends'),
  removeFriend: (userId: string) => api.delete(`/friends/${userId}`),

  // Requests
  sendRequest: (userId: string) => api.post('/friends/request', { user_id: userId }),
  sendRequestByUsername: (username: string) => api.post<FriendRequestResponse>('/friends/request/username', { username }),
  getIncomingRequests: () => api.get<FriendRequest[]>('/friends/requests/incoming'),
  getOutgoingRequests: () => api.get<FriendRequest[]>('/friends/requests/outgoing'),
  acceptRequest: (requestId: string) => api.post(`/friends/requests/${requestId}/accept`),
  declineRequest: (requestId: string) => api.post(`/friends/requests/${requestId}/decline`),
  cancelRequest: (requestId: string) => api.delete(`/friends/requests/${requestId}`),

  // Blocks
  getBlocks: () => api.get<Block[]>('/blocks'),
  blockUser: (userId: string) => api.post('/blocks', { user_id: userId }),
  unblockUser: (userId: string) => api.delete(`/blocks/${userId}`),

  // Search (we'll add this endpoint later, for now search by username)
  searchUsers: (query: string) => api.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`),
}
