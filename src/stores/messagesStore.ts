import { create } from 'zustand'
import { messagesApi } from '../api/messages'
import type { Message, Conversation, Attachment } from '../api/messages'

type MessagesState = {
  conversations: Conversation[]
  currentConversation: Conversation | null
  messages: Message[]
  isLoading: boolean
  isHydrated: boolean

  // Actions
  selectConversation: (id: string) => Promise<void>
  openDM: (userId: string) => Promise<string | null>
  createGroup: (name: string, participantIds: string[]) => Promise<string | null>
  addParticipants: (userIds: string[]) => Promise<boolean>
  sendMessage: (content: string, attachmentIds?: string[]) => Promise<boolean>
  deleteMessage: (messageId: string) => Promise<boolean>
  addReaction: (messageId: string, emoji: string) => Promise<boolean>
  removeReaction: (messageId: string, emoji: string) => Promise<boolean>
  uploadAttachment: (file: File) => Promise<Attachment | null>
  uploadGroupAvatar: (file: File) => Promise<boolean>
  updateGroupName: (name: string) => Promise<boolean>
  leaveGroup: (conversationId: string) => Promise<boolean>
  addConversation: (conversation: Conversation) => void
  updateConversation: (conversation: Conversation) => void
  removeConversation: (conversationId: string) => void
  reset: () => void
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isHydrated: false,

  selectConversation: async (id) => {
    const { conversations } = get()
    const cachedConv = conversations.find((c) => c.id === id)

    set({ isLoading: true, currentConversation: cachedConv || null })

    try {
      const messages = await messagesApi.getMessages(id)

      let conversation = cachedConv
      if (!conversation) {
        conversation = await messagesApi.getConversation(id)
      }

      set({
        currentConversation: conversation,
        messages: messages || [],
        isLoading: false,
      })
    } catch (err) {
      console.error('Failed to load conversation:', err)
      set({ isLoading: false })
    }
  },

  openDM: async (userId) => {
    try {
      const conversation = await messagesApi.getOrCreateDM(userId)
      const { conversations } = get()

      // Add to conversations if not exists
      if (!conversations.find((c) => c.id === conversation.id)) {
        set({ conversations: [conversation, ...conversations] })
      }

      await get().selectConversation(conversation.id)
      return conversation.id
    } catch (err) {
      console.error('Failed to open DM:', err)
      return null
    }
  },

  createGroup: async (name, participantIds) => {
    try {
      const conversation = await messagesApi.createGroup(name, participantIds)
      const { conversations } = get()

      // Add to conversations if not exists
      if (!conversations.find((c) => c.id === conversation.id)) {
        set({ conversations: [conversation, ...conversations] })
      }

      await get().selectConversation(conversation.id)
      return conversation.id
    } catch (err) {
      console.error('Failed to create group:', err)
      return null
    }
  },

  addParticipants: async (userIds) => {
    const { currentConversation } = get()
    if (!currentConversation) return false

    try {
      const updated = await messagesApi.addParticipants(currentConversation.id, userIds)
      set({ currentConversation: updated })

      // Update in conversations list
      const { conversations } = get()
      set({
        conversations: conversations.map((c) =>
          c.id === updated.id ? updated : c
        ),
      })

      return true
    } catch (err) {
      console.error('Failed to add participants:', err)
      return false
    }
  },

  sendMessage: async (content, attachmentIds) => {
    const { currentConversation } = get()
    if (!currentConversation) return false

    try {
      await messagesApi.sendMessage(currentConversation.id, content, attachmentIds)
      // Message will come back via WebSocket MESSAGE_CREATE event
      return true
    } catch (err) {
      console.error('Failed to send message:', err)
      return false
    }
  },

  deleteMessage: async (messageId) => {
    const { currentConversation, messages } = get()
    if (!currentConversation) return false

    try {
      await messagesApi.deleteMessage(currentConversation.id, messageId)
      // Remove message from local state
      set({ messages: messages.filter((m) => m.id !== messageId) })
      return true
    } catch (err) {
      console.error('Failed to delete message:', err)
      return false
    }
  },

  addReaction: async (messageId, emoji) => {
    const { currentConversation, messages } = get()
    if (!currentConversation) return false

    try {
      const reaction = await messagesApi.addReaction(currentConversation.id, messageId, emoji)
      // Update message reactions locally
      set({
        messages: messages.map((m) => {
          if (m.id === messageId) {
            const reactions = m.reactions || []
            const exists = reactions.some(
              (r) => r.user_id === reaction.user_id && r.emoji === reaction.emoji
            )
            if (!exists) {
              return { ...m, reactions: [...reactions, reaction] }
            }
          }
          return m
        }),
      })
      return true
    } catch (err) {
      console.error('Failed to add reaction:', err)
      return false
    }
  },

  removeReaction: async (messageId, emoji) => {
    const { currentConversation } = get()
    if (!currentConversation) return false

    try {
      await messagesApi.removeReaction(currentConversation.id, messageId, emoji)
      // Update message reactions locally - will be synced via gateway
      return true
    } catch (err) {
      console.error('Failed to remove reaction:', err)
      return false
    }
  },

  uploadAttachment: async (file) => {
    try {
      return await messagesApi.uploadAttachment(file)
    } catch (err) {
      console.error('Failed to upload attachment:', err)
      return null
    }
  },

  uploadGroupAvatar: async (file) => {
    const { currentConversation } = get()
    if (!currentConversation || currentConversation.type !== 'group') return false

    try {
      const updated = await messagesApi.uploadGroupAvatar(currentConversation.id, file)
      set({ currentConversation: updated })

      // Update in conversations list
      const { conversations } = get()
      set({
        conversations: conversations.map((c) =>
          c.id === updated.id ? updated : c
        ),
      })

      return true
    } catch (err) {
      console.error('Failed to upload group avatar:', err)
      return false
    }
  },

  updateGroupName: async (name) => {
    const { currentConversation } = get()
    if (!currentConversation || currentConversation.type !== 'group') return false

    try {
      const updated = await messagesApi.updateGroup(currentConversation.id, name)
      set({ currentConversation: updated })

      // Update in conversations list
      const { conversations } = get()
      set({
        conversations: conversations.map((c) =>
          c.id === updated.id ? updated : c
        ),
      })

      return true
    } catch (err) {
      console.error('Failed to update group name:', err)
      return false
    }
  },

  addConversation: (conversation) => {
    const { conversations } = get()
    if (!conversations.find((c) => c.id === conversation.id)) {
      set({ conversations: [conversation, ...conversations] })
    }
  },

  updateConversation: (conversation) => {
    const { conversations, currentConversation } = get()
    set({
      conversations: conversations.map((c) =>
        c.id === conversation.id ? conversation : c
      ),
      currentConversation:
        currentConversation?.id === conversation.id
          ? conversation
          : currentConversation,
    })
  },

  leaveGroup: async (conversationId) => {
    try {
      await messagesApi.leaveGroup(conversationId)
      const { conversations, currentConversation } = get()
      set({
        conversations: conversations.filter((c) => c.id !== conversationId),
        currentConversation:
          currentConversation?.id === conversationId ? null : currentConversation,
        messages: currentConversation?.id === conversationId ? [] : get().messages,
      })
      return true
    } catch (err) {
      console.error('Failed to leave group:', err)
      return false
    }
  },

  removeConversation: (conversationId) => {
    const { conversations, currentConversation } = get()
    set({
      conversations: conversations.filter((c) => c.id !== conversationId),
      currentConversation:
        currentConversation?.id === conversationId ? null : currentConversation,
    })
  },

  reset: () => set({
    conversations: [],
    currentConversation: null,
    messages: [],
    isLoading: false,
    isHydrated: false,
  }),
}))
