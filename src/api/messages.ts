import { Centrifuge } from 'centrifuge'
import { api, API_BASE_URL } from './client'

// Derive WebSocket URL from API base URL
const WS_URL = API_BASE_URL.replace(/^http/, 'ws').replace(/\/api$/, '') + '/api/ws'
import type { User } from './auth'
import type { Friend, FriendRequest } from './friends'

export interface Attachment {
  id: string
  message_id: string
  type: 'image' | 'file'
  url: string
  filename: string
  size: number
  width?: number
  height?: number
  created_at: string
}

export interface Reaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
  user?: User
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  type?: 'text' | 'call' // default: 'text'
  content: string
  created_at: string
  updated_at: string
  sender?: User
  attachments?: Attachment[]
  reactions?: Reaction[]
}

// Call message content (parsed from Message.content JSON)
export interface CallMessageContent {
  call_id: string
  duration: number // seconds
  participants: string[] // user IDs who joined
  status: 'completed' | 'missed' | 'cancelled'
}

export interface Conversation {
  id: string
  type: 'dm' | 'group'
  name: string | null
  avatar_url: string | null
  owner_id: string | null
  participants: User[]
  last_message: Message | null
  updated_at: string
}

// Active call info from READY event
export interface ActiveCallInfo {
  call_id: string
  conversation_id: string
  participants: string[]
  started_at: string
}

// Gateway events (like Discord)
export interface ReadyEvent {
  user: User
  friends: Friend[]
  incoming_requests: FriendRequest[]
  outgoing_requests: FriendRequest[]
  conversations: Conversation[]
  active_calls: ActiveCallInfo[]
}

export interface FriendRequestCreateEvent {
  request: FriendRequest
}

export interface FriendRequestDeleteEvent {
  request_id: string
  user_id: string
}

export interface RelationshipAddEvent {
  friend: Friend
}

export interface RelationshipRemoveEvent {
  user_id: string
}

export interface MessageCreateEvent {
  message: Message
  conversation_id: string
}

export interface MessageDeleteEvent {
  message_id: string
  conversation_id: string
}

export interface ReactionAddEvent {
  reaction: Reaction
  message_id: string
  conversation_id: string
}

export interface ReactionRemoveEvent {
  message_id: string
  conversation_id: string
  user_id: string
  emoji: string
}

export interface PresenceUpdateEvent {
  user_id: string
  status: 'online' | 'offline' | 'idle' | 'dnd'
}

export interface ConversationCreateEvent {
  conversation: Conversation
}

export interface ConversationUpdateEvent {
  conversation: Conversation
}

// Single event for all call state changes
export interface CallStateEvent {
  conversation_id: string
  call_id: string | null  // null = no active call
  participants: string[]  // who is currently in the call
}

export interface RealtimeEvent {
  type: string
  data: unknown
}

export interface CallResponse {
  call_id: string
  token: string
  livekit_url: string
}

export interface CallInfo {
  call_id: string
  started_at: string
  participants: string[]
}

export const callsApi = {
  // Start a call in a conversation (or join if one exists)
  startCall: (conversationId: string) =>
    api.post<CallResponse>('/calls/start', { conversation_id: conversationId }),

  // Join an existing call
  joinCall: (callId: string) =>
    api.post<CallResponse>('/calls/join', { call_id: callId }),

  // Leave a call
  leaveCall: (callId: string) =>
    api.post('/calls/leave', { call_id: callId }),

  // Get active call for a conversation
  getActiveCall: (conversationId: string) =>
    api.get<CallInfo | undefined>(`/conversations/${conversationId}/call`),
}

export const messagesApi = {
  getConversations: () => api.get<Conversation[]>('/conversations'),

  getOrCreateDM: (userId: string) =>
    api.post<Conversation>('/conversations/dm', { user_id: userId }),

  getConversation: (id: string) =>
    api.get<Conversation>(`/conversations/${id}`),

  getMessages: (conversationId: string, limit = 50, offset = 0) =>
    api.get<Message[]>(`/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`),

  sendMessage: (conversationId: string, content: string, attachmentIds?: string[]) =>
    api.post<Message>(`/conversations/${conversationId}/messages`, {
      content,
      attachment_ids: attachmentIds,
    }),

  deleteMessage: (conversationId: string, messageId: string) =>
    api.delete(`/conversations/${conversationId}/messages/${messageId}`),

  addReaction: (conversationId: string, messageId: string, emoji: string) =>
    api.post<Reaction>(`/conversations/${conversationId}/messages/${messageId}/reactions`, { emoji }),

  removeReaction: (conversationId: string, messageId: string, emoji: string) =>
    api.delete(`/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),

  createGroup: (name: string, participantIds: string[]) =>
    api.post<Conversation>('/conversations/group', {
      name,
      participant_ids: participantIds,
    }),

  addParticipants: (conversationId: string, userIds: string[]) =>
    api.post<Conversation>(`/conversations/${conversationId}/participants`, {
      user_ids: userIds,
    }),

  updateGroup: (conversationId: string, name: string) =>
    api.patch<Conversation>(`/conversations/${conversationId}`, { name }),

  leaveGroup: (conversationId: string) =>
    api.delete(`/conversations/${conversationId}/leave`),

  uploadGroupAvatar: async (conversationId: string, file: File): Promise<Conversation> => {
    const token = localStorage.getItem('access_token')
    const formData = new FormData()
    formData.append('avatar', file)

    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || 'Upload failed')
    }

    return response.json()
  },

  uploadAttachment: async (file: File): Promise<Attachment> => {
    const token = localStorage.getItem('access_token')
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || 'Upload failed')
    }

    return response.json()
  },
}

// Centrifuge connection
let centrifuge: Centrifuge | null = null

export type EventHandlers = {
  onReady?: (data: ReadyEvent) => void
  onFriendRequestCreate?: (data: FriendRequestCreateEvent) => void
  onFriendRequestDelete?: (data: FriendRequestDeleteEvent) => void
  onRelationshipAdd?: (data: RelationshipAddEvent) => void
  onRelationshipRemove?: (data: RelationshipRemoveEvent) => void
  onMessageCreate?: (data: MessageCreateEvent) => void
  onMessageDelete?: (data: MessageDeleteEvent) => void
  onReactionAdd?: (data: ReactionAddEvent) => void
  onReactionRemove?: (data: ReactionRemoveEvent) => void
  onPresenceUpdate?: (data: PresenceUpdateEvent) => void
  onConversationCreate?: (data: Conversation) => void
  onConversationUpdate?: (data: Conversation) => void
  onCallState?: (data: CallStateEvent) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export function connectGateway(handlers: EventHandlers): Centrifuge {
  const token = localStorage.getItem('access_token')
  if (!token) {
    throw new Error('No access token')
  }

  if (centrifuge) {
    centrifuge.disconnect()
  }

  centrifuge = new Centrifuge(WS_URL, {
    token,
  })

  centrifuge.on('connected', () => {
    console.log('Gateway connected')
    handlers.onConnect?.()
  })

  centrifuge.on('disconnected', (ctx) => {
    console.log('Gateway disconnected:', ctx)
    handlers.onDisconnect?.()
  })

  centrifuge.on('error', (ctx) => {
    console.error('Gateway error:', ctx)
  })

  // Get user ID from token to subscribe to personal channel
  const payload = JSON.parse(atob(token.split('.')[1]))
  const userId = payload.user_id
  const channel = `user:${userId}`

  const sub = centrifuge.newSubscription(channel)

  sub.on('publication', (ctx) => {
    const event = ctx.data as RealtimeEvent
    console.log('Gateway event:', event.type, event.data)

    switch (event.type) {
      case 'READY':
        handlers.onReady?.(event.data as ReadyEvent)
        break
      case 'FRIEND_REQUEST_CREATE':
        handlers.onFriendRequestCreate?.(event.data as FriendRequestCreateEvent)
        break
      case 'FRIEND_REQUEST_DELETE':
        handlers.onFriendRequestDelete?.(event.data as FriendRequestDeleteEvent)
        break
      case 'RELATIONSHIP_ADD':
        handlers.onRelationshipAdd?.(event.data as RelationshipAddEvent)
        break
      case 'RELATIONSHIP_REMOVE':
        handlers.onRelationshipRemove?.(event.data as RelationshipRemoveEvent)
        break
      case 'MESSAGE_CREATE':
      case 'new_message':
        handlers.onMessageCreate?.(event.data as MessageCreateEvent)
        break
      case 'MESSAGE_DELETE':
        handlers.onMessageDelete?.(event.data as MessageDeleteEvent)
        break
      case 'REACTION_ADD':
        handlers.onReactionAdd?.(event.data as ReactionAddEvent)
        break
      case 'REACTION_REMOVE':
        handlers.onReactionRemove?.(event.data as ReactionRemoveEvent)
        break
      case 'PRESENCE_UPDATE':
        handlers.onPresenceUpdate?.(event.data as PresenceUpdateEvent)
        break
      case 'CONVERSATION_CREATE':
        handlers.onConversationCreate?.(event.data as Conversation)
        break
      case 'CONVERSATION_UPDATE':
        handlers.onConversationUpdate?.(event.data as Conversation)
        break
      case 'CALL_STATE':
        handlers.onCallState?.(event.data as CallStateEvent)
        break
    }
  })

  sub.on('subscribed', () => {
    console.log('Subscribed to personal channel')
  })

  sub.on('error', (ctx) => {
    console.error('Subscription error:', ctx)
  })

  sub.subscribe()
  centrifuge.connect()

  return centrifuge
}

export function disconnectGateway() {
  if (centrifuge) {
    centrifuge.disconnect()
    centrifuge = null
  }
}

// Keep old exports for compatibility during transition
export const connectRealtime = (
  onMessage: (event: RealtimeEvent) => void,
  onConnect?: () => void,
  onDisconnect?: () => void
) => connectGateway({
  onMessageCreate: (data) => onMessage({ type: 'new_message', data }),
  onConnect,
  onDisconnect,
})

export const disconnectRealtime = disconnectGateway
