import { create } from 'zustand'
import { Room, RoomEvent, Track, RemoteTrackPublication, RemoteParticipant, DisconnectReason } from 'livekit-client'
import { callsApi } from '../api/messages'
import { useAuthStore } from './authStore'

// Helper to attach remote audio tracks to DOM for playback
function attachTrack(track: Track, participant: RemoteParticipant) {
  if (track.kind === Track.Kind.Audio) {
    const audioElement = track.attach()
    audioElement.id = `audio-${participant.identity}`
    document.body.appendChild(audioElement)
  }
}

function detachTrack(track: Track, participant: RemoteParticipant) {
  if (track.kind === Track.Kind.Audio) {
    track.detach()
    const audioElement = document.getElementById(`audio-${participant.identity}`)
    if (audioElement) {
      audioElement.remove()
    }
  }
}

// Call state for a conversation (from backend)
export interface CallInfo {
  id: string
  participants: string[] // user IDs currently in the call
}

type CallState = {
  // The call user is currently in (local state)
  myCall: {
    id: string
    conversationId: string
  } | null

  // All active calls by conversation ID (from backend - source of truth)
  calls: Record<string, CallInfo>

  // LiveKit room and local state
  room: Room | null
  isMuted: boolean

  // Actions
  startCall: (conversationId: string) => Promise<void>
  joinCall: (callId: string, conversationId: string) => Promise<void>
  leaveCall: () => Promise<void>
  toggleMute: () => void
  reset: () => void

  // Event handler from WebSocket (single handler for all call state changes)
  onCallState: (conversationId: string, callId: string | null, participants: string[]) => void

  // Initialize from READY event
  initFromReady: (activeCalls: Array<{ call_id: string; conversation_id: string; participants: string[] }>) => void
}

export const useCallStore = create<CallState>((set, get) => ({
  myCall: null,
  calls: {},
  room: null,
  isMuted: false,

  startCall: async (conversationId: string) => {
    const { myCall } = get()

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
      })

      // Connect to LiveKit
      const room = new Room()

      room.on(RoomEvent.TrackSubscribed, (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        attachTrack(track, participant)
      })

      room.on(RoomEvent.TrackUnsubscribed, (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        detachTrack(track, participant)
      })

      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        console.log('Disconnected from LiveKit room, reason:', reason)
        // If disconnected unexpectedly, clean up state
        if (reason !== DisconnectReason.CLIENT_INITIATED) {
          get().leaveCall()
        }
      })

      await room.connect(response.livekit_url, response.token)
      await room.localParticipant.setMicrophoneEnabled(true)

      set({ room })
    } catch (err) {
      console.error('Failed to start call:', err)
      set({ myCall: null })
    }
  },

  joinCall: async (callId: string, conversationId: string) => {
    const { myCall } = get()

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
      })

      // Connect to LiveKit
      const room = new Room()

      room.on(RoomEvent.TrackSubscribed, (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        attachTrack(track, participant)
      })

      room.on(RoomEvent.TrackUnsubscribed, (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        detachTrack(track, participant)
      })

      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        console.log('Disconnected from LiveKit room, reason:', reason)
        // If disconnected unexpectedly, clean up state
        if (reason !== DisconnectReason.CLIENT_INITIATED) {
          get().leaveCall()
        }
      })

      await room.connect(response.livekit_url, response.token)
      await room.localParticipant.setMicrophoneEnabled(true)

      set({ room })
    } catch (err) {
      console.error('Failed to join call:', err)
      set({ myCall: null })
    }
  },

  leaveCall: async () => {
    const { myCall, room } = get()

    if (room) {
      room.disconnect()
    }

    if (myCall) {
      try {
        await callsApi.leaveCall(myCall.id)
      } catch (err) {
        console.error('Failed to leave call:', err)
      }
    }

    set({ myCall: null, room: null, isMuted: false })
  },

  toggleMute: () => {
    const { room, isMuted } = get()
    if (room) {
      room.localParticipant.setMicrophoneEnabled(isMuted) // enable if currently muted
    }
    set({ isMuted: !isMuted })
  },

  reset: () => {
    const { room } = get()
    if (room) {
      room.disconnect()
    }
    set({
      myCall: null,
      calls: {},
      room: null,
      isMuted: false,
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
          if (state.room) {
            state.room.disconnect()
          }
          return {
            calls: newCalls,
            myCall: null,
            room: null,
            isMuted: false,
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
    const { myCall } = useCallStore.getState()
    if (myCall) {
      // Use fetch with keepalive for reliable delivery during page unload
      const token = localStorage.getItem('auth_token')
      if (token) {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/calls/leave`, {
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
      const { myCall, room } = useCallStore.getState()
      // If we think we're in a call but room is disconnected, clean up
      if (myCall && room && room.state === 'disconnected') {
        console.log('Room disconnected while page was hidden, cleaning up')
        useCallStore.getState().leaveCall()
      }
    }
  })
}
