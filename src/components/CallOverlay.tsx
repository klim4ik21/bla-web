import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useCallStore } from '../stores/callStore'
import { useAuthStore } from '../stores/authStore'
import { useMessagesStore } from '../stores/messagesStore'

type Props = {
  conversationId: string
  onExpand?: () => void
}

export function CallOverlay({ conversationId, onExpand }: Props) {
  const { user } = useAuthStore()
  const { currentConversation } = useMessagesStore()
  const {
    myCall,
    calls,
    isMuted,
    toggleMute,
    leaveCall,
    joinCall,
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

  if (!callInfo) return null

  const getParticipantInfo = (id: string) => {
    return currentConversation?.participants.find(p => p.id === id)
  }

  const displayParticipantIds = isInCall
    ? callInfo.participants.filter(id => id !== user?.id)
    : callInfo.participants

  const participantsInfo = displayParticipantIds
    .map(id => getParticipantInfo(id))
    .filter(Boolean)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleJoin = () => {
    joinCall(callInfo.id, conversationId)
  }

  const getStatusText = () => {
    if (!isInCall) {
      return `Идёт звонок (${callInfo.participants.length})`
    }
    if (participantsInfo.length > 0) {
      return formatDuration(callDuration)
    }
    return 'Ожидание...'
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-[#0a0a0a] border-b border-white/[0.04]"
    >
      <div className="flex items-center justify-between px-5 py-4">
        {/* Left side */}
        <button
          onClick={isInCall ? onExpand : undefined}
          disabled={!isInCall}
          className={`flex items-center gap-4 ${isInCall ? 'hover:opacity-80 transition-opacity cursor-pointer' : ''}`}
        >
          {/* Avatars */}
          <div className="flex items-center">
            {isInCall && (
              <div className="relative">
                <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${
                  !isMuted ? 'border-emerald-500/50' : 'border-white/10'
                }`}>
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/[0.06] flex items-center justify-center text-sm text-white/30 uppercase">
                      {user?.username?.[0] || '?'}
                    </div>
                  )}
                </div>
                {isMuted && (
                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-rose-500 rounded-full border-2 border-[#0a0a0a] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            {participantsInfo.map((participant, idx) => (
              <div
                key={participant?.id}
                className={`relative ${isInCall && idx === 0 ? '-ml-3' : idx > 0 ? '-ml-3' : ''}`}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#0a0a0a] ring-2 ring-emerald-500/30">
                  {participant?.avatar_url ? (
                    <img src={participant.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/[0.06] flex items-center justify-center text-sm text-white/30 uppercase">
                      {participant?.username?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0a0a0a] bg-emerald-500" />
              </div>
            ))}

            {isInCall && participantsInfo.length === 0 && (
              <div className="-ml-3 w-12 h-12 rounded-full bg-white/[0.04] border-2 border-[#0a0a0a] flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
              </div>
            )}
          </div>

          {/* Status */}
          <div className="text-left">
            <p className={`text-sm font-medium ${
              isInCall && participantsInfo.length > 0 ? 'text-emerald-400' : 'text-white/40'
            }`}>
              {getStatusText()}
            </p>
            {participantsInfo.length > 0 && (
              <p className="text-xs text-white/30">
                {participantsInfo.map(p => p?.username).join(', ')}
              </p>
            )}
          </div>

          {isInCall && (
            <svg className="w-4 h-4 text-white/30 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {isInCall ? (
            <>
              <motion.button
                onClick={toggleMute}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isMuted
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
                }`}
                title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all"
                title="Выйти из звонка"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
                </svg>
              </motion.button>
            </>
          ) : (
            <motion.button
              onClick={myCall ? undefined : handleJoin}
              disabled={!!myCall}
              whileHover={!myCall ? { scale: 1.02 } : {}}
              whileTap={!myCall ? { scale: 0.98 } : {}}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                myCall
                  ? 'bg-white/[0.04] text-white/20 cursor-not-allowed'
                  : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              Присоединиться
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
