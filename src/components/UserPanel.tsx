import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { useFriendsStore } from '../stores/friendsStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useGatewayStore } from '../stores/gatewayStore'
import { useCallStore } from '../stores/callStore'
import { SettingsModal } from './SettingsModal'

type Status = 'online' | 'idle' | 'dnd' | 'invisible'

export function UserPanel() {
  const { user, logout } = useAuthStore()
  const resetFriends = useFriendsStore((s) => s.reset)
  const resetMessages = useMessagesStore((s) => s.reset)
  const disconnectGateway = useGatewayStore((s) => s.disconnect)
  const { myCall, isMuted, toggleMute } = useCallStore()
  const [isDeafened, setIsDeafened] = useState(false)
  const [status, setStatus] = useState<Status>('online')
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const statusColors = {
    online: 'bg-emerald-400',
    idle: 'bg-amber-400',
    dnd: 'bg-rose-400',
    invisible: 'bg-white/20',
  }

  const statusLabels = {
    online: 'В сети',
    idle: 'Неактивен',
    dnd: 'Не беспокоить',
    invisible: 'Невидимый',
  }

  const handleLogout = async () => {
    disconnectGateway()
    resetMessages()
    resetFriends()
    await logout()
  }

  return (
    <div className="absolute bottom-0 left-0 w-[360px] h-16 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-r border-white/[0.04] flex items-center px-3 gap-3">
      {/* Avatar + Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-sm text-white/40 uppercase overflow-hidden">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-medium">{user?.username?.[0] || 'U'}</span>
            )}
          </div>
          <motion.button
            onClick={() => {
              const statuses: Status[] = ['online', 'idle', 'dnd', 'invisible']
              const idx = statuses.indexOf(status)
              setStatus(statuses[(idx + 1) % statuses.length])
            }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${statusColors[status]} border-[3px] border-[#0a0a0a]`}
            title="Сменить статус"
          />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{user?.username || 'User'}</div>
          <div className="text-xs text-white/30 truncate">{statusLabels[status]}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-1">
        <motion.button
          onClick={myCall ? toggleMute : undefined}
          disabled={!myCall}
          whileHover={myCall ? { scale: 1.05 } : {}}
          whileTap={myCall ? { scale: 0.95 } : {}}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
            !myCall
              ? 'text-white/15 cursor-not-allowed'
              : isMuted
                ? 'bg-rose-500/15 text-rose-400'
                : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
          }`}
          title={!myCall ? 'Не в звонке' : isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted && myCall ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L17.591 17.591L5.409 5.409L4 4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </motion.button>

        <motion.button
          onClick={myCall ? () => setIsDeafened(!isDeafened) : undefined}
          disabled={!myCall}
          whileHover={myCall ? { scale: 1.05 } : {}}
          whileTap={myCall ? { scale: 0.95 } : {}}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
            !myCall
              ? 'text-white/15 cursor-not-allowed'
              : isDeafened
                ? 'bg-rose-500/15 text-rose-400'
                : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
          }`}
          title={!myCall ? 'Не в звонке' : isDeafened ? 'Включить звук' : 'Выключить звук'}
        >
          {isDeafened && myCall ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          )}
        </motion.button>

        <div className="relative">
          <motion.button
            onClick={() => setShowMenu(!showMenu)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:bg-white/[0.06] hover:text-white/70 transition-all"
            title="Настройки"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full right-0 mb-2 w-48 bg-[#141414] border border-white/[0.06] rounded-xl py-1.5 z-20 shadow-2xl overflow-hidden"
                >
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowSettings(true)
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/[0.06] hover:text-white flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Настройки
                  </button>
                  <div className="h-px bg-white/[0.04] my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Выйти
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
