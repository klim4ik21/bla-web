import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { stickersApi, type StickerPack, type Sticker } from '../api/stickers'
import { TgsPlayer } from './TgsPlayer'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSelect: (sticker: Sticker) => void
}

export function StickerPicker({ isOpen, onClose, onSelect }: Props) {
  const [packs, setPacks] = useState<StickerPack[]>([])
  const [activePack, setActivePack] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadedStickers, setLoadedStickers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen) {
      loadPacks()
    }
  }, [isOpen])

  const loadPacks = async () => {
    setIsLoading(true)
    try {
      const data = await stickersApi.getPacks()
      setPacks(data || [])
      if (data && data.length > 0) {
        setActivePack(data[0].id)
        // Preload first pack stickers
        preloadPackStickers(data[0])
      }
    } catch (err) {
      console.error('Failed to load sticker packs:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Preload stickers when pack changes
  const preloadPackStickers = useCallback((pack: StickerPack) => {
    if (!pack.stickers) return

    pack.stickers.forEach((sticker) => {
      if (sticker.file_type === 'webm') {
        const video = document.createElement('video')
        video.preload = 'auto'
        video.src = sticker.file_url
        video.onloadeddata = () => {
          setLoadedStickers((prev) => new Set(prev).add(sticker.id))
        }
      } else if (sticker.file_type === 'webp' || sticker.file_type === 'png') {
        const img = new Image()
        img.src = sticker.file_url
        img.onload = () => {
          setLoadedStickers((prev) => new Set(prev).add(sticker.id))
        }
      }
    })
  }, [])

  const handlePackChange = (packId: string) => {
    setActivePack(packId)
    const pack = packs.find((p) => p.id === packId)
    if (pack) {
      preloadPackStickers(pack)
    }
  }

  const currentPack = packs.find((p) => p.id === activePack)

  const handleStickerClick = (sticker: Sticker) => {
    onSelect(sticker)
    onClose()
  }

  const renderSticker = (sticker: Sticker, size: number) => {
    const isLoaded = loadedStickers.has(sticker.id) || sticker.file_type === 'tgs'

    if (sticker.file_type === 'tgs') {
      return (
        <TgsPlayer
          src={sticker.file_url}
          size={size}
          loop={false}
          autoplay={false}
          className="cursor-pointer hover:scale-110 transition-transform"
        />
      )
    }

    if (sticker.file_type === 'webm') {
      return (
        <div className="relative w-full h-full">
          {!isLoaded && <StickerSkeleton />}
          <video
            src={sticker.file_url}
            width={size}
            height={size}
            loop
            muted
            playsInline
            preload="auto"
            className={`object-contain cursor-pointer hover:scale-110 transition-all ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoadedData={() => setLoadedStickers((prev) => new Set(prev).add(sticker.id))}
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
          />
        </div>
      )
    }

    return (
      <div className="relative w-full h-full">
        {!isLoaded && <StickerSkeleton />}
        <img
          src={sticker.file_url}
          alt={sticker.emoji}
          className={`w-full h-full object-contain cursor-pointer hover:scale-110 transition-all ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoadedStickers((prev) => new Set(prev).add(sticker.id))}
        />
      </div>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 z-50 w-[340px] bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-sm font-medium text-white/70">Стикеры</span>
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
              </div>
            ) : packs.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-white/40">
                <svg className="w-12 h-12 mb-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">Нет стикеров</p>
                <p className="text-xs text-white/20 mt-1">Стикерпаки скоро появятся</p>
              </div>
            ) : (
              <>
                {/* Pack tabs */}
                <div className="px-2 py-2 border-b border-white/[0.06] flex gap-1 overflow-x-auto">
                  {packs.map((pack) => (
                    <button
                      key={pack.id}
                      onClick={() => handlePackChange(pack.id)}
                      className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        activePack === pack.id
                          ? 'bg-white/[0.1] border border-white/[0.1]'
                          : 'hover:bg-white/[0.04]'
                      }`}
                      title={pack.name}
                    >
                      {pack.stickers?.[0] ? (
                        pack.stickers[0].file_type === 'tgs' ? (
                          <TgsPlayer src={pack.stickers[0].file_url} size={32} loop={false} autoplay={false} />
                        ) : pack.stickers[0].file_type === 'webm' ? (
                          <video
                            src={pack.stickers[0].file_url}
                            width={32}
                            height={32}
                            muted
                            playsInline
                            preload="auto"
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <img src={pack.stickers[0].file_url} alt={pack.name} className="w-8 h-8 object-contain" />
                        )
                      ) : (
                        <span className="text-lg">📦</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Stickers grid */}
                <div className="h-[280px] overflow-y-auto p-2">
                  {currentPack && (
                    <>
                      <div className="px-2 py-1 mb-2">
                        <span className="text-xs font-medium text-white/30">{currentPack.name}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {currentPack.stickers?.map((sticker) => (
                          <motion.button
                            key={sticker.id}
                            onClick={() => handleStickerClick(sticker)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="aspect-square p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
                          >
                            {renderSticker(sticker, 56)}
                          </motion.button>
                        ))}
                      </div>
                      {(!currentPack.stickers || currentPack.stickers.length === 0) && (
                        <div className="text-center py-8 text-white/30 text-sm">
                          В этом паке пока нет стикеров
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Skeleton placeholder for loading stickers
function StickerSkeleton() {
  return (
    <div className="absolute inset-0 bg-white/[0.04] rounded-lg animate-pulse" />
  )
}
