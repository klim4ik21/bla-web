import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useCallStore } from '../stores/callStore'
import { useAuthStore } from '../stores/authStore'
import { useMessagesStore } from '../stores/messagesStore'

type Props = {
  conversationId: string
  onMinimize: () => void
}

export function CallView({ conversationId, onMinimize }: Props) {
  const { user } = useAuthStore()
  const { currentConversation } = useMessagesStore()
  const {
    myCall,
    calls,
    isMuted,
    toggleMute,
    leaveCall,
  } = useCallStore()

  const [callDuration, setCallDuration] = useState(0)

  const isInCall = myCall?.conversationId === conversationId
  const callInfo = calls[conversationId]

  useEffect(() => {
    if (isInCall) {
      setCallDuration(0)
      const interval = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isInCall])

  if (!callInfo || !isInCall) return null

  const getParticipantInfo = (id: string) => {
    return currentConversation?.participants.find(p => p.id === id)
  }

  const allParticipants = callInfo.participants.map(id => ({
    id,
    user: id === user?.id ? user : getParticipantInfo(id),
    isMe: id === user?.id,
  })).filter(p => p.user)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const totalTiles = allParticipants.length === 1 ? 2 : allParticipants.length

  const getGridConfig = () => {
    if (totalTiles <= 2) return { cols: 2, rows: 1 }
    if (totalTiles <= 4) return { cols: 2, rows: 2 }
    if (totalTiles <= 6) return { cols: 3, rows: 2 }
    if (totalTiles <= 9) return { cols: 3, rows: 3 }
    return { cols: 4, rows: Math.ceil(totalTiles / 4) }
  }

  const { cols } = getGridConfig()

  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[cols] || 'grid-cols-2'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col bg-[#050505]"
    >
      {/* Header */}
      <div className="h-14 border-b border-white/[0.04] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white/70">
            Звонок · <span className="tabular-nums">{formatDuration(callDuration)}</span>
          </span>
        </div>
        <motion.button
          onClick={onMinimize}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Свернуть
        </motion.button>
      </div>

      {/* Participants grid */}
      <div className="flex-1 p-6 min-h-0 flex items-center justify-center">
        <div className={`grid ${gridClass} gap-4 w-full max-w-4xl`}>
          {allParticipants.map((participant) => (
            <motion.div
              key={participant.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`relative aspect-video rounded-2xl bg-white/[0.02] border flex flex-col items-center justify-center gap-4 ${
                participant.isMe
                  ? isMuted
                    ? 'border-rose-500/30'
                    : 'border-emerald-500/30'
                  : 'border-white/[0.04]'
              }`}
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-white/[0.04]">
                  {participant.user?.avatar_url ? (
                    <img
                      src={participant.user.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-3xl text-white/20 uppercase font-medium">
                        {participant.user?.username?.[0] || '?'}
                      </span>
                    </div>
                  )}
                </div>
                {participant.isMe && isMuted && (
                  <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-rose-500 border-2 border-[#050505] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Name */}
              <span className="text-sm font-medium text-white/60">
                {participant.isMe ? 'Вы' : participant.user?.username}
              </span>
            </motion.div>
          ))}

          {/* Waiting placeholder */}
          {allParticipants.length === 1 && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="aspect-video rounded-2xl bg-white/[0.02] border border-white/[0.04] flex flex-col items-center justify-center gap-4"
            >
              <div className="w-24 h-24 rounded-full bg-white/[0.04] flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white/10 animate-pulse" />
              </div>
              <span className="text-sm text-white/30">Ожидание...</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="h-24 border-t border-white/[0.04] flex items-center justify-center gap-4">
        <motion.button
          onClick={toggleMute}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            isMuted
              ? 'bg-rose-500 text-white'
              : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white'
          }`}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {isMuted ? (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </>
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            )}
          </svg>
        </motion.button>

        <motion.button
          onClick={leaveCall}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-14 h-14 rounded-2xl bg-rose-500 text-white hover:bg-rose-600 flex items-center justify-center transition-all"
          title="Выйти из звонка"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  )
}
