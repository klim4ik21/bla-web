import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { User } from '../api/auth'

type Props = {
  user: User
  isOpen: boolean
  onClose: () => void
  onSendMessage: (userId: string, message: string) => void
  position?: { top: number; left: number }
}

export function UserProfilePopup({ user, isOpen, onClose, onSendMessage, position }: Props) {
  const [message, setMessage] = useState('')

  const handleSend = () => {
    if (!message.trim()) return
    onSendMessage(user.id, message.trim())
    setMessage('')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 w-72 bg-[#0f0f0f] rounded-2xl border border-white/[0.06] shadow-2xl overflow-hidden"
            style={position ? { top: position.top, left: position.left } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            {/* Banner */}
            <div className="h-20 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent relative">
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] to-transparent" />
            </div>

            {/* Avatar */}
            <div className="px-5 -mt-10 relative">
              <div className="w-20 h-20 rounded-full border-4 border-[#0f0f0f] bg-white/[0.06] flex items-center justify-center text-2xl text-white/30 uppercase overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-medium">{user.username?.[0] || '?'}</span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="px-5 pt-3 pb-5">
              <h3 className="text-lg font-medium text-white">
                {user.username || 'Unknown'}
              </h3>

              {/* Message input */}
              <div className="mt-4">
                <div className="relative">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={`Написать @${user.username}`}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
                  />
                  {message.trim() && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      onClick={handleSend}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#050505]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
