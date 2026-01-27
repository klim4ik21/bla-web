import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFriendsStore } from '../stores/friendsStore'

type Props = {
  isOpen: boolean
  onClose: () => void
  onAdd: (userIds: string[]) => void
  existingParticipantIds: string[]
  title: string
}

export function AddParticipantsModal({ isOpen, onClose, onAdd, existingParticipantIds, title }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const { friends } = useFriendsStore()

  const availableFriends = friends.filter(
    (f) => !existingParticipantIds.includes(f.user.id)
  )

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const handleAdd = () => {
    if (selectedIds.length > 0) {
      onAdd(selectedIds)
      setSelectedIds([])
      onClose()
    }
  }

  const handleClose = () => {
    setSelectedIds([])
    onClose()
  }

  const statusColors: Record<string, string> = {
    online: 'bg-emerald-400',
    idle: 'bg-amber-400',
    dnd: 'bg-rose-400',
    offline: 'bg-white/20',
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
                <h2 className="text-lg font-medium text-white">{title}</h2>
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

              {/* Friend list */}
              <div className="max-h-80 overflow-y-auto p-3">
                {availableFriends.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/[0.03] flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                    </div>
                    <p className="text-white/30">Нет друзей для добавления</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {availableFriends.map((friend) => {
                      const isSelected = selectedIds.includes(friend.user.id)
                      return (
                        <motion.button
                          key={friend.user.id}
                          onClick={() => toggleUser(friend.user.id)}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                            isSelected
                              ? 'bg-white/[0.08] border border-white/[0.1]'
                              : 'hover:bg-white/[0.04] border border-transparent'
                          }`}
                        >
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-sm text-white/40 uppercase overflow-hidden">
                              {friend.user.avatar_url ? (
                                <img src={friend.user.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-medium">{friend.user.username?.[0] || '?'}</span>
                              )}
                            </div>
                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0f0f0f] ${
                              statusColors[friend.user.status || 'offline']
                            }`} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 text-left">
                            <p className="text-white text-sm font-medium">
                              {friend.user.username || 'Unknown'}
                            </p>
                            <p className="text-white/30 text-xs capitalize">
                              {friend.user.status === 'online' ? 'В сети' :
                               friend.user.status === 'idle' ? 'Неактивен' :
                               friend.user.status === 'dnd' ? 'Не беспокоить' : 'Не в сети'}
                            </p>
                          </div>

                          {/* Checkbox */}
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-white border-white'
                                : 'border-white/20'
                            }`}
                          >
                            {isSelected && (
                              <motion.svg
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-3 h-3 text-[#050505]"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </motion.svg>
                            )}
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.04] flex justify-end gap-3">
                <motion.button
                  onClick={handleClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-5 py-2.5 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Отмена
                </motion.button>
                <motion.button
                  onClick={handleAdd}
                  disabled={selectedIds.length === 0}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-5 py-2.5 bg-white text-[#050505] rounded-xl text-sm font-medium hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  Добавить
                  {selectedIds.length > 0 && (
                    <span className="bg-[#050505]/20 px-1.5 py-0.5 rounded text-xs">
                      {selectedIds.length}
                    </span>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
