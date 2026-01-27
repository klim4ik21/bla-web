const LIVEKIT_SERVICE_URL = 'http://localhost:7881'

export interface TokenResponse {
  token: string
}

export interface RoomResponse {
  name: string
  sid: string
  empty_timeout: number
}

export const livekitApi = {
  getToken: async (roomName: string, userId: string, username: string): Promise<TokenResponse> => {
    const response = await fetch(`${LIVEKIT_SERVICE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: roomName,
        user_id: userId,
        username: username,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get token')
    }

    return response.json()
  },

  createRoom: async (roomName: string): Promise<RoomResponse> => {
    const response = await fetch(`${LIVEKIT_SERVICE_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ room_name: roomName }),
    })

    if (!response.ok) {
      throw new Error('Failed to create room')
    }

    return response.json()
  },

  deleteRoom: async (roomName: string): Promise<void> => {
    const response = await fetch(`${LIVEKIT_SERVICE_URL}/rooms/${roomName}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Failed to delete room')
    }
  },

  listRooms: async (): Promise<RoomResponse[]> => {
    const response = await fetch(`${LIVEKIT_SERVICE_URL}/rooms`)

    if (!response.ok) {
      throw new Error('Failed to list rooms')
    }

    return response.json()
  },
}
