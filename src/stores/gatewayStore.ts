import { create } from 'zustand'
import {
  connectGateway,
  disconnectGateway,
  type ReadyEvent,
  type FriendRequestCreateEvent,
  type FriendRequestDeleteEvent,
  type RelationshipAddEvent,
  type RelationshipRemoveEvent,
  type MessageCreateEvent,
  type MessageDeleteEvent,
  type ReactionAddEvent,
  type ReactionRemoveEvent,
  type PresenceUpdateEvent,
  type Conversation,
  type CallStateEvent,
} from '../api/messages'
import { useFriendsStore } from './friendsStore'
import { useMessagesStore } from './messagesStore'
import { useAuthStore } from './authStore'
import { useCallStore } from './callStore'

type GatewayState = {
  isConnected: boolean
  isReady: boolean

  connect: () => void
  disconnect: () => void
}

export const useGatewayStore = create<GatewayState>((set, get) => ({
  isConnected: false,
  isReady: false,

  connect: () => {
    if (get().isConnected) return

    try {
      connectGateway({
        onReady: (data: ReadyEvent) => {
          console.log('READY received:', data)

          // Populate auth store with user
          useAuthStore.setState({ user: data.user })

          // Populate friends store
          useFriendsStore.setState({
            friends: data.friends || [],
            incomingRequests: data.incoming_requests || [],
            outgoingRequests: data.outgoing_requests || [],
            isHydrated: true,
          })

          // Populate messages store
          useMessagesStore.setState({
            conversations: data.conversations || [],
            isHydrated: true,
          })

          // Initialize calls from active_calls
          if (data.active_calls) {
            useCallStore.getState().initFromReady(data.active_calls)
          }

          set({ isReady: true })
        },

        onFriendRequestCreate: (data: FriendRequestCreateEvent) => {
          const state = useFriendsStore.getState()
          useFriendsStore.setState({
            incomingRequests: [...state.incomingRequests, data.request],
          })
        },

        onFriendRequestDelete: (data: FriendRequestDeleteEvent) => {
          const state = useFriendsStore.getState()
          useFriendsStore.setState({
            incomingRequests: state.incomingRequests.filter((r) => r.id !== data.request_id),
            outgoingRequests: state.outgoingRequests.filter((r) => r.id !== data.request_id),
          })
        },

        onRelationshipAdd: (data: RelationshipAddEvent) => {
          const state = useFriendsStore.getState()
          // Add new friend if not already in list
          if (!state.friends.find((f) => f.user.id === data.friend.user.id)) {
            useFriendsStore.setState({
              friends: [...state.friends, data.friend],
            })
          }
        },

        onRelationshipRemove: (data: RelationshipRemoveEvent) => {
          const state = useFriendsStore.getState()
          useFriendsStore.setState({
            friends: state.friends.filter((f) => f.user.id !== data.user_id),
          })
        },

        onMessageCreate: (data: MessageCreateEvent) => {
          const state = useMessagesStore.getState()

          // Update messages if we're in this conversation
          if (state.currentConversation?.id === data.conversation_id) {
            useMessagesStore.setState({
              messages: [...state.messages, data.message],
            })
          }

          // Update conversation list
          const updatedConversations = state.conversations.map((c) => {
            if (c.id === data.conversation_id) {
              return { ...c, last_message: data.message, updated_at: data.message.created_at }
            }
            return c
          })

          // Sort by updated_at
          updatedConversations.sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )

          useMessagesStore.setState({ conversations: updatedConversations })
        },

        onMessageDelete: (data: MessageDeleteEvent) => {
          const state = useMessagesStore.getState()

          // Remove message from current conversation if we're viewing it
          if (state.currentConversation?.id === data.conversation_id) {
            useMessagesStore.setState({
              messages: state.messages.filter((m) => m.id !== data.message_id),
            })
          }
        },

        onReactionAdd: (data: ReactionAddEvent) => {
          const state = useMessagesStore.getState()

          // Add reaction to message if we're viewing this conversation
          if (state.currentConversation?.id === data.conversation_id) {
            useMessagesStore.setState({
              messages: state.messages.map((m) => {
                if (m.id === data.message_id) {
                  const reactions = m.reactions || []
                  // Check if reaction already exists
                  const exists = reactions.some(
                    (r) => r.user_id === data.reaction.user_id && r.emoji === data.reaction.emoji
                  )
                  if (!exists) {
                    return { ...m, reactions: [...reactions, data.reaction] }
                  }
                }
                return m
              }),
            })
          }
        },

        onReactionRemove: (data: ReactionRemoveEvent) => {
          const state = useMessagesStore.getState()

          // Remove reaction from message if we're viewing this conversation
          if (state.currentConversation?.id === data.conversation_id) {
            useMessagesStore.setState({
              messages: state.messages.map((m) => {
                if (m.id === data.message_id) {
                  return {
                    ...m,
                    reactions: (m.reactions || []).filter(
                      (r) => !(r.user_id === data.user_id && r.emoji === data.emoji)
                    ),
                  }
                }
                return m
              }),
            })
          }
        },

        onPresenceUpdate: (data: PresenceUpdateEvent) => {
          // Update friends
          const friendsState = useFriendsStore.getState()
          const updatedFriends = friendsState.friends.map((f) => {
            if (f.user.id === data.user_id) {
              return { ...f, user: { ...f.user, status: data.status } }
            }
            return f
          })
          useFriendsStore.setState({ friends: updatedFriends })

          // Update conversations participants
          const messagesState = useMessagesStore.getState()
          const updatedConversations = messagesState.conversations.map((c) => ({
            ...c,
            participants: c.participants.map((p) =>
              p.id === data.user_id ? { ...p, status: data.status } : p
            ),
          }))

          // Update current conversation if needed
          const updatedCurrentConversation = messagesState.currentConversation
            ? {
                ...messagesState.currentConversation,
                participants: messagesState.currentConversation.participants.map((p) =>
                  p.id === data.user_id ? { ...p, status: data.status } : p
                ),
              }
            : null

          useMessagesStore.setState({
            conversations: updatedConversations,
            currentConversation: updatedCurrentConversation,
          })
        },

        onConversationCreate: (conversation: Conversation) => {
          useMessagesStore.getState().addConversation(conversation)
        },

        onConversationUpdate: (conversation: Conversation) => {
          useMessagesStore.getState().updateConversation(conversation)
        },

        onCallState: (data: CallStateEvent) => {
          useCallStore.getState().onCallState(
            data.conversation_id,
            data.call_id,
            data.participants
          )
        },

        onConnect: () => {
          set({ isConnected: true })
        },

        onDisconnect: () => {
          set({ isConnected: false, isReady: false })
        },
      })
    } catch (err) {
      console.error('Failed to connect gateway:', err)
    }
  },

  disconnect: () => {
    disconnectGateway()
    set({ isConnected: false, isReady: false })
  },
}))
