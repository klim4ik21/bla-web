import { api, API_BASE_URL } from './client'

export interface Sticker {
  id: string
  pack_id: string
  emoji: string
  file_url: string
  file_type: 'tgs' | 'webp' | 'png' | 'webm'
  width: number
  height: number
  created_at: string
}

// Get sticker URL - now uses CDN directly (file_url already points to CDN)
export const getStickerUrl = (sticker: Sticker) => sticker.file_url

export interface StickerPack {
  id: string
  name: string
  description: string
  cover_url: string | null
  is_official: boolean
  creator_id: string | null
  created_at: string
  updated_at: string
  stickers?: Sticker[]
}

export const stickersApi = {
  // Get all sticker packs (user's saved + official)
  getPacks: () => api.get<StickerPack[]>('/stickers'),

  // Get a specific pack with all stickers
  getPack: (packId: string) => api.get<StickerPack>(`/stickers/${packId}`),

  // Create a new sticker pack
  createPack: (name: string, description: string) =>
    api.post<StickerPack>('/stickers', { name, description }),

  // Upload a sticker to a pack
  uploadSticker: async (packId: string, file: File, emoji: string): Promise<Sticker> => {
    const token = localStorage.getItem('access_token')
    const formData = new FormData()
    formData.append('sticker', file)
    formData.append('emoji', emoji)

    const response = await fetch(`${API_BASE_URL}/stickers/${packId}/stickers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload sticker')
    }

    return response.json()
  },

  // Add pack to user's collection
  addPack: (packId: string) => api.post(`/stickers/${packId}/add`, {}),

  // Remove pack from user's collection
  removePack: (packId: string) => api.delete(`/stickers/${packId}/remove`),

  // Delete a pack (owner only)
  deletePack: (packId: string) => api.delete(`/stickers/${packId}`),
}
