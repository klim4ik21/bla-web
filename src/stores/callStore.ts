import { create } from 'zustand'
import { VoiceClient } from '../lib/voice/VoiceClient'
import { callsApi } from '../api/messages'
import { useAuthStore } from './authStore'

// Call state for a conversation (from backend)
export interface CallInfo {
  id: string
  participants: string[] // user IDs currently in the call
}

// Voice user in call
interface VoiceUser {
  id: string
  speaking: boolean
}

type CallState = {
  // The call user is currently in (local state)
  myCall: {
    id: string
    conversationId: string
  } | null

  // All active calls by conversation ID (from backend - source of truth)
  calls: Record<string, CallInfo>

  // Voice client and local state
  voiceClient: VoiceClient | null
  isMuted: boolean

  // Users in current call
  voiceUsers: VoiceUser[]

  // Noise suppression
  noiseSuppression: boolean

  // Actions
  startCall: (conversationId: string) => Promise<void>
  joinCall: (callId: string, conversationId: string) => Promise<void>
  leaveCall: () => Promise<void>
  toggleMute: () => void
  toggleNoiseSuppression: () => void
  reset: () => void

  // Event handler from WebSocket (single handler for all call state changes)
  onCallState: (conversationId: string, callId: string | null, participants: string[]) => void

  // Initialize from READY event
  initFromReady: (activeCalls: Array<{ call_id: string; conversation_id: string; participants: string[] }>) => void
}

export const useCallStore = create<CallState>((set, get) => ({
  myCall: null,
  calls: {},
  voiceClient: null,
  isMuted: false,
  voiceUsers: [],
  noiseSuppression: true,

  startCall: async (conversationId: string) => {
    const { myCall } = get()
    const currentUser = useAuthStore.getState().user

    // Already in a call?
    if (myCall && myCall.conversationId !== conversationId) {
      console.error('Already in another call')
      return
    }

    try {
      const response = await callsApi.startCall(conversationId)

      // Set local state
      set({
        myCall: {
          id: response.call_id,
          conversationId,
        },
        isMuted: false,
        voiceUsers: [],
      })

      // Connect to custom voice server
      const voiceClient = new VoiceClient({
        wsUrl: response.livekit_url, // This is now our SFU URL
        roomId: `call-${response.call_id}`,
        userId: currentUser?.id || '',
        token: response.token,
        noiseSuppression: get().noiseSuppression,
        onUserJoin: (user) => {
          set((state) => ({
            voiceUsers: [...state.voiceUsers, { id: user.userId, speaking: false }],
          }))
        },
        onUserLeave: (userId) => {
          set((state) => ({
            voiceUsers: state.voiceUsers.filter((u) => u.id !== userId),
          }))
        },
        onUserSpeaking: (userId, speaking) => {
          set((state) => ({
            voiceUsers: state.voiceUsers.map((u) =>
              u.id === userId ? { ...u, speaking } : u
            ),
          }))
        },
        onError: (error) => {
          console.error('Voice error:', error)
        },
        onConnected: () => {
          console.log('Voice connected')
        },
        onDisconnected: () => {
          console.log('Voice disconnected')
          // Clean up state directly (don't call leaveCall to avoid recursion)
          const { myCall: currentCall } = get()
          if (currentCall) {
            // Notify backend
            callsApi.leaveCall(currentCall.id).catch(() => {})
            // Clear local state
            set({ myCall: null, voiceClient: null, isMuted: false, voiceUsers: [] })
          }
        },
      })

      await voiceClient.connect()
      await voiceClient.startSpeaking()

      set({ voiceClient })
    } catch (err) {
      console.error('Failed to start call:', err)
      set({ myCall: null })
    }
  },

  joinCall: async (callId: string, conversationId: string) => {
    const { myCall } = get()
    const currentUser = useAuthStore.getState().user

    if (myCall) {
      console.error('Already in a call')
      return
    }

    try {
      const response = await callsApi.joinCall(callId)

      set({
        myCall: {
          id: response.call_id,
          conversationId,
        },
        isMuted: false,
        voiceUsers: [],
      })

      // Connect to custom voice server
      const voiceClient = new VoiceClient({
        wsUrl: response.livekit_url,
        roomId: `call-${response.call_id}`,
        userId: currentUser?.id || '',
        token: response.token,
        noiseSuppression: get().noiseSuppression,
        onUserJoin: (user) => {
          set((state) => ({
            voiceUsers: [...state.voiceUsers, { id: user.userId, speaking: false }],
          }))
        },
        onUserLeave: (userId) => {
          set((state) => ({
            voiceUsers: state.voiceUsers.filter((u) => u.id !== userId),
          }))
        },
        onUserSpeaking: (userId, speaking) => {
          set((state) => ({
            voiceUsers: state.voiceUsers.map((u) =>
              u.id === userId ? { ...u, speaking } : u
            ),
          }))
        },
        onError: (error) => {
          console.error('Voice error:', error)
        },
        onConnected: () => {
          console.log('Voice connected')
        },
        onDisconnected: () => {
          console.log('Voice disconnected')
          // Clean up state directly (don't call leaveCall to avoid recursion)
          const { myCall: currentCall } = get()
          if (currentCall) {
            callsApi.leaveCall(currentCall.id).catch(() => {})
            set({ myCall: null, voiceClient: null, isMuted: false, voiceUsers: [] })
          }
        },
      })

      await voiceClient.connect()
      await voiceClient.startSpeaking()

      set({ voiceClient })
    } catch (err) {
      console.error('Failed to join call:', err)
      set({ myCall: null })
    }
  },

  leaveCall: async () => {
    const { myCall, voiceClient } = get()

    if (voiceClient) {
      voiceClient.disconnect()
    }

    if (myCall) {
      try {
        await callsApi.leaveCall(myCall.id)
      } catch (err) {
        console.error('Failed to leave call:', err)
      }
    }

    set({ myCall: null, voiceClient: null, isMuted: false, voiceUsers: [] })
  },

  toggleMute: () => {
    const { voiceClient, isMuted } = get()
    if (voiceClient) {
      voiceClient.setMuted(!isMuted)
    }
    set({ isMuted: !isMuted })
  },

  toggleNoiseSuppression: () => {
    const { voiceClient, noiseSuppression } = get()
    const newValue = !noiseSuppression
    if (voiceClient) {
      voiceClient.setNoiseSuppression(newValue)
    }
    set({ noiseSuppression: newValue })
  },

  reset: () => {
    const { voiceClient } = get()
    if (voiceClient) {
      voiceClient.disconnect()
    }
    set({
      myCall: null,
      calls: {},
      voiceClient: null,
      isMuted: false,
      voiceUsers: [],
    })
  },

  // Single handler for all call state changes from backend
  onCallState: (conversationId: string, callId: string | null, participants: string[]) => {
    set((state) => {
      const newCalls = { ...state.calls }

      if (callId && participants.length > 0) {
        // Call exists with participants
        newCalls[conversationId] = {
          id: callId,
          participants,
        }
      } else {
        // No call or empty call - remove it
        delete newCalls[conversationId]

        // If user was in this call, clear myCall
        if (state.myCall?.conversationId === conversationId) {
          if (state.voiceClient) {
            state.voiceClient.disconnect()
          }
          return {
            calls: newCalls,
            myCall: null,
            voiceClient: null,
            isMuted: false,
            voiceUsers: [],
          }
        }
      }

      return { calls: newCalls }
    })
  },

  // Initialize from READY event
  initFromReady: async (activeCalls) => {
    const calls: Record<string, CallInfo> = {}
    const currentUserId = useAuthStore.getState().user?.id

    // Find if current user is stuck in any call
    let stuckCallId: string | null = null

    for (const call of activeCalls) {
      if (call.participants.length > 0) {
        calls[call.conversation_id] = {
          id: call.call_id,
          participants: call.participants,
        }

        // Check if current user is in this call but we don't have local state
        if (currentUserId && call.participants.includes(currentUserId)) {
          const { myCall } = get()
          if (!myCall) {
            // User is in a call on server but not locally - this is a stuck call
            stuckCallId = call.call_id
          }
        }
      }
    }

    set({ calls })

    // If user is stuck in a call, leave it automatically
    if (stuckCallId) {
      console.log('Found stuck call, leaving automatically:', stuckCallId)
      try {
        await callsApi.leaveCall(stuckCallId)
      } catch (err) {
        console.error('Failed to leave stuck call:', err)
      }
    }
  },
}))

// Setup page lifecycle handlers after store is created
if (typeof window !== 'undefined') {
  // Leave call when page closes
  window.addEventListener('beforeunload', () => {
    const { myCall, voiceClient } = useCallStore.getState()
    if (myCall) {
      // Disconnect voice client immediately
      if (voiceClient) {
        voiceClient.disconnect()
      }

      // Use fetch with keepalive for reliable delivery during page unload
      const token = localStorage.getItem('auth_token')
      if (token) {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/calls/leave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ call_id: myCall.id }),
          keepalive: true,
        }).catch(() => {
          // Ignore errors during unload
        })
      }
    }
  })

  // Check connection when page becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const { myCall, voiceClient } = useCallStore.getState()
      // If we think we're in a call but voice client is null/disconnected, clean up
      if (myCall && !voiceClient) {
        console.log('Voice client disconnected while page was hidden, cleaning up')
        useCallStore.getState().leaveCall()
      }
    }
  })
}
