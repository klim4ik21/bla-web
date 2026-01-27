import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Conversation } from '../api/messages'

type Props = {
  isOpen: boolean
  onClose: () => void
  conversation: Conversation
  isOwner: boolean
  onUpdateName: (name: string) => Promise<boolean>
  onUploadAvatar: (file: File) => Promise<boolean>
}

export function GroupSettingsModal({
  isOpen,
  onClose,
  conversation,
  isOwner,
  onUpdateName,
  onUploadAvatar,
}: Props) {
  const [name, setName] = useState(conversation.name || '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(conversation.name || '')
  }, [conversation.name])

  const handleSave = async () => {
    if (!isOwner || !name.trim()) return

    setIsUpdating(true)
    try {
      const success = await onUpdateName(name.trim())
      if (success) {
        onClose()
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isOwner) return

    setIsUploadingAvatar(true)
    try {
      await onUploadAvatar(file)
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleClose = () => {
    setName(conversation.name || '')
    onClose()
  }

  const getDefaultName = () => {
    const names = conversation.participants.map((p) => p.username || 'Unknown')
    if (names.length <= 2) {
      return names.join(' и ')
    }
    const lastIndex = names.length - 1
    return names.slice(0, lastIndex).join(', ') + ' и ' + names[lastIndex]
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="bg-[#0f0f0f] rounded-2xl w-full max-w-md border border-white/[0.06] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.04]">
                <h2 className="text-lg font-medium text-white">Настройки группы</h2>
                <motion.button
                  onClick={handleClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarSelect}
                    accept="image/*"
                    className="hidden"
                    disabled={!isOwner}
                  />
                  <motion.button
                    onClick={() => isOwner && fileInputRef.current?.click()}
                    disabled={isUploadingAvatar || !isOwner}
                    whileHover={isOwner ? { scale: 1.05 } : {}}
                    whileTap={isOwner ? { scale: 0.95 } : {}}
                    className={`relative w-24 h-24 rounded-full overflow-hidden ${
                      isOwner ? 'cursor-pointer group' : 'cursor-default'
                    }`}
                  >
                    {isUploadingAvatar ? (
                      <div className="w-full h-full bg-white/[0.06] flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : conversation.avatar_url ? (
                      <img src={conversation.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/[0.06] flex items-center justify-center text-white/20">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      </div>
                    )}
                    {isOwner && !isUploadingAvatar && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                        </svg>
                      </div>
                    )}
                  </motion.button>
                  {isOwner && (
                    <p className="text-xs text-white/20">Нажмите чтобы изменить</p>
                  )}
                </div>

                {/* Name input */}
                <div>
                  <label className="block text-[11px] font-medium tracking-widest text-white/30 uppercase mb-3">
                    Название группы
                  </label>
                  {isOwner ? (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={getDefaultName()}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
                    />
                  ) : (
                    <div className="bg-white/[0.03] border border-white/[0.04] rounded-xl px-4 py-3.5 text-white/40">
                      {conversation.name || getDefaultName()}
                    </div>
                  )}
                </div>

                {/* Members count */}
                <div>
                  <label className="block text-[11px] font-medium tracking-widest text-white/30 uppercase mb-3">
                    Участники
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {conversation.participants.slice(0, 5).map((p) => (
                        <div
                          key={p.id}
                          className="w-8 h-8 rounded-full bg-white/[0.06] border-2 border-[#0f0f0f] flex items-center justify-center text-xs text-white/30 uppercase overflow-hidden"
                        >
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.username?.[0] || '?'
                          )}
                        </div>
                      ))}
                      {conversation.participants.length > 5 && (
                        <div className="w-8 h-8 rounded-full bg-white/[0.08] border-2 border-[#0f0f0f] flex items-center justify-center text-xs text-white/40">
                          +{conversation.participants.length - 5}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-white/30">{conversation.participants.length} участников</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.04] flex justify-end gap-3">
                <motion.button
                  onClick={handleClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-5 py-2.5 text-sm text-white/50 hover:text-white transition-colors"
                >
                  {isOwner ? 'Отмена' : 'Закрыть'}
                </motion.button>
                {isOwner && (
                  <motion.button
                    onClick={handleSave}
                    disabled={isUpdating || !name.trim()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-5 py-2.5 bg-white text-[#050505] rounded-xl text-sm font-medium hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {isUpdating ? 'Сохранение...' : 'Сохранить'}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
