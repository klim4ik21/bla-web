import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { Attachment } from '../api/messages'
import type { User } from '../api/auth'

type Props = {
  isOpen: boolean
  onClose: () => void
  attachment: Attachment | null
  sender?: User | null
  sentAt?: string
}

export function ImagePreviewModal({ isOpen, onClose, attachment, sender, sentAt }: Props) {
  const [zoom, setZoom] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)

  if (!attachment) return null

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5))
  const handleResetZoom = () => setZoom(1)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = attachment.url
    link.download = attachment.filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenInBrowser = () => {
    window.open(attachment.url, '_blank')
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(attachment.id)
    setMenuOpen(false)
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(attachment.url)
    setMenuOpen(false)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) + ', ' + date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
        >
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between px-5 py-4 bg-black/50 backdrop-blur-sm border-b border-white/[0.06]"
          >
            {/* Left - Sender info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white/[0.06] flex items-center justify-center">
                {sender?.avatar_url ? (
                  <img src={sender.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm text-white/30 uppercase">
                    {sender?.username?.[0] || '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{sender?.username || 'Unknown'}</p>
                {sentAt && (
                  <p className="text-xs text-white/40">{formatDate(sentAt)}</p>
                )}
              </div>
            </div>

            {/* Right - Controls */}
            <div className="flex items-center gap-1">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-white/[0.04] rounded-lg">
                <motion.button
                  onClick={handleZoomOut}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  disabled={zoom <= 0.5}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Уменьшить"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
                  </svg>
                </motion.button>
                <button
                  onClick={handleResetZoom}
                  className="px-2 py-1 text-xs text-white/50 hover:text-white transition-colors min-w-[50px] tabular-nums"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <motion.button
                  onClick={handleZoomIn}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  disabled={zoom >= 3}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Увеличить"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                  </svg>
                </motion.button>
              </div>

              {/* Download */}
              <motion.button
                onClick={handleDownload}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
                title="Скачать"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </motion.button>

              {/* Open in browser */}
              <motion.button
                onClick={handleOpenInBrowser}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
                title="Открыть в браузере"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </motion.button>

              {/* More menu */}
              <div className="relative">
                <motion.button
                  onClick={() => setMenuOpen(!menuOpen)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
                  title="Ещё"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="6" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="18" cy="12" r="2" />
                  </svg>
                </motion.button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        className="absolute right-0 top-full mt-1 z-50 min-w-[180px] py-1.5 bg-[#0f0f0f] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden"
                      >
                        <button
                          onClick={handleCopyId}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors text-left"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                          Копировать ID
                        </button>
                        <button
                          onClick={handleCopyUrl}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors text-left"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                          </svg>
                          Копировать ссылку
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Close */}
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-all ml-2"
                title="Закрыть"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>
          </motion.div>

          {/* Image container - click outside closes */}
          <div
            className="flex-1 flex items-center justify-center p-8 overflow-auto"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center"
            >
              <img
                src={attachment.url}
                alt={attachment.filename}
                style={{ transform: `scale(${zoom})` }}
                className="max-w-full max-h-[calc(100vh-200px)] object-contain rounded-lg shadow-2xl transition-transform duration-200 cursor-default"
                draggable={false}
              />
            </motion.div>
          </div>

          {/* Footer - filename */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="px-5 py-3 bg-black/50 backdrop-blur-sm border-t border-white/[0.06] text-center"
          >
            <p className="text-sm text-white/40 truncate">{attachment.filename}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
