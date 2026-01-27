import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useCallStore } from '../stores/callStore'
import { useAuthStore } from '../stores/authStore'
import { useMessagesStore } from '../stores/messagesStore'

type Props = {
  onReturnToCall: () => void
}

export function ActiveCallBar({ onReturnToCall }: Props) {
  const { user } = useAuthStore()
  const { conversations } = useMessagesStore()
  const { myCall, calls, leaveCall } = useCallStore()
  const [callDuration, setCallDuration] = useState(0)
  const [showBar, setShowBar] = useState(false)

  useEffect(() => {
    if (myCall) {
      setCallDuration(0)
      const interval = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [myCall])

  useEffect(() => {
    if (myCall) {
      const timer = setTimeout(() => setShowBar(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShowBar(false)
    }
  }, [myCall])

  if (!myCall || !showBar) {
    return null
  }

  const callInfo = calls[myCall.conversationId]
  const participants = callInfo?.participants || []

  const conversation = conversations.find(c => c.id === myCall.conversationId)

  const otherParticipants = participants
    .filter(id => id !== user?.id)
    .map(id => conversation?.participants.find(p => p.id === id))
    .filter(Boolean)

  const participantNames = otherParticipants.length > 0
    ? otherParticipants.map(p => p?.username).join(', ')
    : 'Ожидание...'

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 44, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="w-full bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between px-4 flex-shrink-0 overflow-hidden"
    >
      <button
        onClick={onReturnToCall}
        className="flex items-center gap-3 text-sm hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-medium">Звонок</span>
        </div>
        <span className="text-white/60">{participantNames}</span>
        <span className="text-white/30 tabular-nums">{formatDuration(callDuration)}</span>
      </button>

      <div className="flex items-center gap-2">
        <motion.button
          onClick={onReturnToCall}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-3 py-1.5 text-xs text-white/70 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] rounded-lg transition-colors"
        >
          Вернуться
        </motion.button>
        <motion.button
          onClick={leaveCall}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
        >
          Выйти
        </motion.button>
      </div>
    </motion.div>
  )
}
