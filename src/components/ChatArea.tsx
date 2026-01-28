import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useCallStore } from '../stores/callStore'
import type { Attachment, Message, CallMessageContent } from '../api/messages'
import type { User } from '../api/auth'
import { AddParticipantsModal } from './AddParticipantsModal'
import { GroupSettingsModal } from './GroupSettingsModal'
import { UserProfilePopup } from './UserProfilePopup'
import { CallOverlay } from './CallOverlay'
import { CallView } from './CallView'
import { ImagePreviewModal } from './ImagePreviewModal'
import { StickerPicker } from './StickerPicker'
import { TgsPlayer } from './TgsPlayer'
import type { Sticker } from '../api/stickers'

type Props = {
  conversationId: string | null
  onConversationChange?: (conversationId: string) => void
}

export function ChatArea({ conversationId, onConversationChange }: Props) {
  const [message, setMessage] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showFullCallView, setShowFullCallView] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 })
  const [newMessagesCount, setNewMessagesCount] = useState(0)
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<'bottom' | 'top'>('bottom')
  const [previewImage, setPreviewImage] = useState<{ attachment: Attachment; message: Message } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const dragCounterRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevMessagesLengthRef = useRef<number>(0)
  const prevConversationIdRef = useRef<string | null>(null)
  const { user } = useAuthStore()
  const {
    currentConversation,
    messages,
    isLoading,
    selectConversation,
    sendMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    uploadAttachment,
    uploadGroupAvatar,
    updateGroupName,
    createGroup,
    addParticipants,
    openDM,
  } = useMessagesStore()

  // Owner can edit, or if no owner is set (legacy groups), any participant can edit
  const isGroupOwner = currentConversation?.type === 'group' &&
    (currentConversation?.owner_id === user?.id || !currentConversation?.owner_id)

  const { myCall, calls, startCall } = useCallStore()
  const isInCall = myCall?.conversationId === conversationId
  const callInfo = conversationId ? calls[conversationId] : null
  const hasActiveCall = !!callInfo

  // Auto-open full call view when joining a call, close when leaving
  useEffect(() => {
    if (isInCall) {
      setShowFullCallView(true)
    } else {
      setShowFullCallView(false)
    }
  }, [isInCall])

  // Load conversation when ID changes
  useEffect(() => {
    if (conversationId) {
      selectConversation(conversationId)
    }
  }, [conversationId, selectConversation])

  // Clear badge when scrolled to bottom
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
      if (isNearBottom) {
        setNewMessagesCount(0)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to bottom when conversation changes
  useEffect(() => {
    if (conversationId && prevConversationIdRef.current !== conversationId) {
      prevConversationIdRef.current = conversationId
      prevMessagesLengthRef.current = 0
      setNewMessagesCount(0)
    }
  }, [conversationId])

  // Scroll to bottom when messages load/change
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || messages.length === 0) return

    const isInitialLoad = prevMessagesLengthRef.current === 0
    const newCount = messages.length - prevMessagesLengthRef.current

    if (isInitialLoad) {
      // Initial load - always scroll to bottom instantly
      setTimeout(() => {
        container.scrollTop = container.scrollHeight
      }, 0)
    } else if (newCount > 0) {
      // New messages arrived
      const lastMessage = messages[messages.length - 1]
      const isOwnMessage = lastMessage?.sender_id === user?.id
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150

      if (isOwnMessage || isNearBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
        setNewMessagesCount(0)
      } else {
        setNewMessagesCount(prev => prev + newCount)
      }
    }

    prevMessagesLengthRef.current = messages.length
  }, [messages, user?.id])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setNewMessagesCount(0)
  }

  const handleSend = async () => {
    if (!message.trim() && pendingAttachments.length === 0) return
    const content = message
    const attachmentIds = pendingAttachments.map((a) => a.id)
    setMessage('')
    setPendingAttachments([])
    await sendMessage(content, attachmentIds.length > 0 ? attachmentIds : undefined)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const attachment = await uploadAttachment(file)
        if (attachment) {
          setPendingAttachments((prev) => [...prev, attachment])
        }
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const attachment = await uploadAttachment(file)
        if (attachment) {
          setPendingAttachments((prev) => [...prev, attachment])
        }
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleAddParticipants = async (userIds: string[]) => {
    if (!currentConversation) return

    if (currentConversation.type === 'dm') {
      // Create new group with current DM participants + new users
      const existingIds = currentConversation.participants.map((p) => p.id)
      const allParticipantIds = [...existingIds, ...userIds].filter((id) => id !== user?.id)
      await createGroup('', allParticipantIds)
    } else {
      // Add to existing group
      await addParticipants(userIds)
    }
  }

  const existingParticipantIds = currentConversation?.participants.map((p) => p.id) || []

  const handleParticipantClick = (participant: User, event: React.MouseEvent) => {
    // Don't show popup for self
    if (participant.id === user?.id) return

    const rect = event.currentTarget.getBoundingClientRect()
    setPopupPosition({
      top: rect.top,
      left: rect.left - 290, // Position to the left of the participant
    })
    setSelectedUser(participant)
  }

  const handleSendDM = async (userId: string, message: string) => {
    const convId = await openDM(userId)
    if (convId) {
      onConversationChange?.(convId)
      if (message) {
        await sendMessage(message)
      }
    }
  }

  const handleStickerSelect = async (sticker: Sticker) => {
    // Send sticker as a message with sticker info including CDN URL
    // Format: [sticker|file_url|file_type|emoji]
    const stickerContent = `[sticker|${sticker.file_url}|${sticker.file_type}|${sticker.emoji}]`
    await sendMessage(stickerContent)
  }

  // Parse sticker from message content
  const parseStickerContent = (content: string) => {
    const match = content.match(/^\[sticker\|(.+)\|(tgs|webm|webp|png)\|([^\]]+)\]$/)
    if (match) {
      return {
        file_url: match[1],
        file_type: match[2] as 'tgs' | 'webp' | 'png' | 'webm',
        emoji: match[3],
      }
    }
    return null
  }

  // Format call duration
  const formatCallDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} сек`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins < 60) return secs > 0 ? `${mins} мин ${secs} сек` : `${mins} мин`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours} ч ${remainingMins} мин`
  }

  // Parse call message content
  const parseCallContent = (content: string): CallMessageContent | null => {
    try {
      return JSON.parse(content) as CallMessageContent
    } catch {
      return null
    }
  }

  // Render call message
  const renderCallMessage = (msg: Message) => {
    const callData = parseCallContent(msg.content)
    if (!callData) return null

    const isMissed = callData.status === 'missed'
    const participantCount = callData.participants.length

    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
        isMissed ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-white/[0.03] border border-white/[0.06]'
      }`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isMissed ? 'bg-rose-500/20' : 'bg-emerald-500/20'
        }`}>
          {isMissed ? (
            <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m1.5 13.5c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          )}
        </div>
        <div>
          <p className={`text-sm font-medium ${isMissed ? 'text-rose-400' : 'text-white/80'}`}>
            {isMissed ? 'Пропущенный звонок' : 'Звонок'}
          </p>
          <p className="text-xs text-white/40">
            {isMissed
              ? 'Никто не ответил'
              : `${formatCallDuration(callData.duration)} • ${participantCount} ${participantCount === 1 ? 'участник' : participantCount < 5 ? 'участника' : 'участников'}`
            }
          </p>
        </div>
      </div>
    )
  }

  const renderMessageContent = (content: string) => {
    const sticker = parseStickerContent(content)
    if (sticker) {
      if (sticker.file_type === 'tgs') {
        return (
          <TgsPlayer
            src={sticker.file_url}
            size={160}
            loop={true}
            autoplay={true}
            className="rounded-lg"
          />
        )
      }
      if (sticker.file_type === 'webm') {
        return (
          <video
            src={sticker.file_url}
            width={160}
            height={160}
            autoPlay
            loop
            muted
            playsInline
            className="w-40 h-40 object-contain rounded-lg"
          />
        )
      }
      return (
        <img
          src={sticker.file_url}
          alt={sticker.emoji}
          className="w-40 h-40 object-contain"
        />
      )
    }
    return (
      <p className="text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </p>
    )
  }

  // Get the other participant for DM
  const otherUser = currentConversation?.participants.find((p) => p.id !== user?.id)

  const handleStartCall = () => {
    if (!currentConversation) return
    startCall(currentConversation.id)
  }

  // Generate group name from participants if no custom name
  const getGroupName = () => {
    if (currentConversation?.name) return currentConversation.name
    const others = currentConversation?.participants.filter((p) => p.id !== user?.id) || []
    const names = others.map((p) => p.username || 'Unknown')
    if (names.length === 0) return 'Group'
    if (names.length === 1) return names[0]
    if (names.length === 2) return names.join(' и ')
    return names.slice(0, -1).join(', ') + ' и ' + names[names.length - 1]
  }

  const channelName = currentConversation?.type === 'dm'
    ? otherUser?.username || 'Direct Message'
    : getGroupName()

  const statusColors: Record<string, string> = {
    online: 'bg-emerald-400',
    idle: 'bg-amber-400',
    dnd: 'bg-rose-400',
    offline: 'bg-white/20',
  }

  if (!conversationId) {
    return (
      <div className="flex-1 flex flex-col bg-[#050505] items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/[0.03] flex items-center justify-center">
            <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-white/30 text-lg font-light">Выберите чат</p>
          <p className="text-white/15 text-sm mt-2">Выберите друга или группу для общения</p>
        </motion.div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col bg-[#050505] items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/[0.06] border-t-white/40 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col bg-[#050505] relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#050505]/95 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-20 h-20 rounded-2xl bg-white/[0.06] border-2 border-dashed border-white/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-white/80">Отпустите для загрузки</p>
                <p className="text-sm text-white/40 mt-1">Файлы будут прикреплены к сообщению</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="h-16 border-b border-white/[0.04] flex items-center justify-between px-6 bg-[#050505]/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {/* Group avatar & name (clickable to open settings) */}
          {currentConversation?.type === 'group' ? (
            <motion.button
              onClick={() => setShowGroupSettings(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-white/[0.04]">
                {currentConversation.avatar_url ? (
                  <img src={currentConversation.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="text-left">
                <span className="text-white font-medium block">
                  {channelName}
                </span>
                <span className="text-white/30 text-xs">
                  {currentConversation.participants.length} участников
                </span>
              </div>
            </motion.button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-white/[0.04] flex items-center justify-center text-white/30 text-sm uppercase">
                  {otherUser?.avatar_url ? (
                    <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    otherUser?.username?.[0] || '?'
                  )}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#050505] ${
                  statusColors[otherUser?.status || 'offline']
                }`} />
              </div>
              <div>
                <span className="text-white font-medium block">
                  {channelName}
                </span>
                <span className="text-white/30 text-xs capitalize">
                  {otherUser?.status === 'online' ? 'В сети' :
                   otherUser?.status === 'idle' ? 'Неактивен' :
                   otherUser?.status === 'dnd' ? 'Не беспокоить' : 'Не в сети'}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Call button - only show when no active call */}
          {!hasActiveCall && !isInCall && (
            <motion.button
              onClick={handleStartCall}
              disabled={!!myCall}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
                myCall
                  ? 'text-white/20 cursor-not-allowed'
                  : 'text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
              title={myCall ? 'Уже в звонке' : 'Начать звонок'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </motion.button>
          )}
          <motion.button
            onClick={() => setShowAddModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
            title={currentConversation?.type === 'dm' ? 'Создать группу' : 'Добавить участников'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </motion.button>
          {currentConversation?.type === 'group' && (
            <motion.button
              onClick={() => setShowParticipants(!showParticipants)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
                showParticipants
                  ? 'text-white bg-white/[0.08]'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
              }`}
              title="Показать участников"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </motion.button>
          )}
        </div>
      </div>

      {/* Main content area with optional participants panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Full call view - replaces chat when expanded */}
        {showFullCallView && isInCall && conversationId ? (
          <CallView
            conversationId={conversationId}
            onMinimize={() => setShowFullCallView(false)}
          />
        ) : (
        <>
        {/* Messages and input */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Call overlay - show when there's an active call or user is in call */}
          <AnimatePresence>
            {(isInCall || hasActiveCall) && conversationId && (
              <CallOverlay
                conversationId={conversationId}
                onExpand={() => setShowFullCallView(true)}
              />
            )}
          </AnimatePresence>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-white/[0.03] flex items-center justify-center">
                  <svg className="w-7 h-7 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <p className="text-white/30 font-light">Нет сообщений</p>
                <p className="text-white/15 text-sm mt-1">Начните разговор!</p>
              </motion.div>
            ) : (
              <div className="space-y-0.5">
                {messages.map((msg, index) => {
                  const prevMsg = index > 0 ? messages[index - 1] : null
                  const isSameSender = prevMsg?.sender_id === msg.sender_id
                  const timeDiff = prevMsg
                    ? new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()
                    : Infinity
                  const isGrouped = isSameSender && timeDiff < 5 * 60 * 1000 // 5 minutes
                  const isOwnMessage = msg.sender_id === user?.id
                  const isAdmin = currentConversation?.owner_id === user?.id

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`group/message flex gap-3 relative -mx-3 px-3 py-1 rounded-lg hover:bg-white/[0.02] transition-colors ${isGrouped ? '' : 'mt-4'} ${index === 0 ? '!mt-0' : ''}`}
                    >
                      {/* Avatar - only show for first message in group */}
                      {!isGrouped ? (
                        <div className="w-9 h-9 rounded-full bg-white/[0.04] flex-shrink-0 flex items-center justify-center text-sm text-white/30 uppercase overflow-hidden">
                          {msg.sender?.avatar_url ? (
                            <img src={msg.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            msg.sender?.username?.[0] || '?'
                          )}
                        </div>
                      ) : (
                        <div className="w-9 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        {/* Header - only show for first message in group */}
                        {!isGrouped && (
                          <div className="flex items-baseline gap-3 mb-1">
                            <span className={`text-sm font-medium ${
                              msg.sender_id === user?.id ? 'text-white' : 'text-white/70'
                            }`}>
                              {msg.sender?.username || 'Unknown'}
                            </span>
                            <span className="text-xs text-white/20 tabular-nums">
                              {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}
                        {msg.type === 'call' ? renderCallMessage(msg) : msg.content && renderMessageContent(msg.content)}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {msg.attachments.map((attachment) => (
                              attachment.type === 'image' ? (
                                <button
                                  key={attachment.id}
                                  onClick={() => setPreviewImage({ attachment, message: msg })}
                                  className="block max-w-md group text-left"
                                >
                                  <img
                                    src={attachment.url}
                                    alt={attachment.filename}
                                    className="rounded-xl max-h-80 object-contain border border-white/[0.04] group-hover:border-white/[0.1] transition-colors cursor-pointer"
                                  />
                                </button>
                              ) : (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/[0.04] rounded-xl hover:bg-white/[0.06] hover:border-white/[0.08] transition-all group"
                                >
                                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm text-white/70 truncate group-hover:text-white transition-colors">
                                      {attachment.filename}
                                    </p>
                                    <p className="text-xs text-white/30">Файл</p>
                                  </div>
                                </a>
                              )
                            ))}
                          </div>
                        )}

                        {/* Reactions display */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {/* Group reactions by emoji */}
                            {Object.entries(
                              msg.reactions.reduce((acc, r) => {
                                if (!acc[r.emoji]) {
                                  acc[r.emoji] = { count: 0, users: [], hasOwn: false }
                                }
                                acc[r.emoji].count++
                                acc[r.emoji].users.push(r.user?.username || 'Unknown')
                                if (r.user_id === user?.id) {
                                  acc[r.emoji].hasOwn = true
                                }
                                return acc
                              }, {} as Record<string, { count: number; users: string[]; hasOwn: boolean }>)
                            ).map(([emoji, data]) => (
                              <motion.button
                                key={emoji}
                                onClick={() => {
                                  if (data.hasOwn) {
                                    removeReaction(msg.id, emoji)
                                  } else {
                                    addReaction(msg.id, emoji)
                                  }
                                }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm transition-colors ${
                                  data.hasOwn
                                    ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                                    : 'bg-white/[0.04] border border-transparent hover:bg-white/[0.08] text-white/60'
                                }`}
                                title={data.users.join(', ')}
                              >
                                <span>{emoji}</span>
                                <span className="text-xs tabular-nums">{data.count}</span>
                              </motion.button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quick reactions */}
                      <div className="absolute right-1/2 top-0 opacity-0 group-hover/message:opacity-100 transition-opacity">
                        <div className="flex items-center gap-0.5 p-1 bg-[#0a0a0a] border border-white/[0.06] rounded-lg">
                          {['👍', '❤️', '😂', '😮'].map((emoji) => (
                            <motion.button
                              key={emoji}
                              onClick={() => addReaction(msg.id, emoji)}
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.9 }}
                              className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/[0.08] transition-colors text-base"
                            >
                              {emoji}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Three-dot menu */}
                      <div className="absolute right-0 top-0 opacity-0 group-hover/message:opacity-100 transition-opacity">
                        <div className="relative">
                          <motion.button
                            onClick={(e) => {
                              if (messageMenuId === msg.id) {
                                setMessageMenuId(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const spaceBelow = window.innerHeight - rect.bottom
                                const menuHeight = 150
                                setMenuPosition(spaceBelow < menuHeight ? 'top' : 'bottom')
                                setMessageMenuId(msg.id)
                              }
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-8 h-8 rounded-lg bg-[#0a0a0a] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 hover:border-white/[0.12] transition-all"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="6" cy="12" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="18" cy="12" r="2" />
                            </svg>
                          </motion.button>

                          <AnimatePresence>
                            {messageMenuId === msg.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setMessageMenuId(null)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: menuPosition === 'bottom' ? -5 : 5 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: menuPosition === 'bottom' ? -5 : 5 }}
                                  transition={{ duration: 0.15 }}
                                  className={`absolute right-0 z-50 min-w-[160px] py-1.5 bg-[#0f0f0f] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden ${
                                    menuPosition === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'
                                  }`}
                                >
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(msg.id)
                                      setMessageMenuId(null)
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors text-left"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                    </svg>
                                    Копировать ID
                                  </button>

                                  {!isOwnMessage && (
                                    <button
                                      onClick={() => {
                                        setMessageMenuId(null)
                                      }}
                                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors text-left"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                                      </svg>
                                      Пожаловаться
                                    </button>
                                  )}

                                  {(isOwnMessage || isAdmin) && (
                                    <button
                                      onClick={async () => {
                                        await deleteMessage(msg.id)
                                        setMessageMenuId(null)
                                      }}
                                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                      </svg>
                                      Удалить
                                    </button>
                                  )}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* New messages badge */}
          <AnimatePresence>
            {newMessagesCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10"
              >
                <motion.button
                  onClick={scrollToBottom}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0f0f] border border-white/[0.08] rounded-full text-sm text-white/70 hover:text-white hover:border-white/[0.15] transition-all shadow-2xl"
                >
                  <span>{newMessagesCount} {newMessagesCount === 1 ? 'новое сообщение' : newMessagesCount < 5 ? 'новых сообщения' : 'новых сообщений'}</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="p-4 border-t border-white/[0.04]">
            {/* Pending attachments preview */}
            <AnimatePresence>
              {pendingAttachments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 mb-3"
                >
                  {pendingAttachments.map((attachment) => (
                    <motion.div
                      key={attachment.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative group"
                    >
                      {attachment.type === 'image' ? (
                        <img
                          src={attachment.url}
                          alt={attachment.filename}
                          className="h-20 w-20 object-cover rounded-xl border border-white/[0.06]"
                        />
                      ) : (
                        <div className="h-20 w-20 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center justify-center">
                          <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </div>
                      )}
                      <motion.button
                        onClick={() => removePendingAttachment(attachment.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </motion.button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative flex items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                multiple
                className="hidden"
              />
              <div className="absolute left-3 flex items-center gap-1">
                <motion.button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] disabled:opacity-50 transition-colors"
                >
                  {isUploading ? (
                    <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  )}
                </motion.button>
                <div className="relative">
                  <motion.button
                    onClick={() => setShowStickerPicker(!showStickerPicker)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                      showStickerPicker
                        ? 'text-white/70 bg-white/[0.08]'
                        : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
                    }`}
                    title="Стикеры"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                    </svg>
                  </motion.button>
                  <StickerPicker
                    isOpen={showStickerPicker}
                    onClose={() => setShowStickerPicker(false)}
                    onSelect={handleStickerSelect}
                  />
                </div>
              </div>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={`Сообщение ${currentConversation?.type === 'dm' ? '@' : '#'}${channelName}`}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-[88px] pr-12 py-3.5 text-[15px] text-white placeholder-white/20 focus:outline-none focus:border-white/[0.12] focus:bg-white/[0.04] transition-all"
              />
              <AnimatePresence>
                {(message.trim() || pendingAttachments.length > 0) && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={handleSend}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute right-3 w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#050505]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Participants panel */}
        <AnimatePresence>
          {showParticipants && currentConversation?.type === 'group' && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-white/[0.04] bg-[#0a0a0a] flex-shrink-0 overflow-hidden"
            >
              <div className="w-[280px] h-full overflow-y-auto">
                <div className="p-5">
                  <h3 className="text-[11px] font-medium tracking-widest text-white/30 uppercase mb-4">
                    Участники — {currentConversation.participants.length}
                  </h3>
                  <div className="space-y-1">
                    {currentConversation.participants.map((participant) => (
                      <motion.button
                        key={participant.id}
                        onClick={(e) => handleParticipantClick(participant, e)}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                          participant.id === user?.id ? 'opacity-50 cursor-default' : 'cursor-pointer'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-full bg-white/[0.04] flex items-center justify-center text-sm text-white/30 uppercase overflow-hidden">
                            {participant.avatar_url ? (
                              <img src={participant.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              participant.username?.[0] || '?'
                            )}
                          </div>
                          {/* Status indicator */}
                          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${
                            statusColors[participant.status || 'offline']
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white/70 truncate block">
                            {participant.username || 'Unknown'}
                          </span>
                          <span className="text-xs text-white/30 capitalize">
                            {participant.status === 'online' ? 'В сети' :
                             participant.status === 'idle' ? 'Неактивен' :
                             participant.status === 'dnd' ? 'Не беспокоить' : 'Не в сети'}
                          </span>
                        </div>
                        {/* Crown for owner */}
                        {currentConversation.owner_id === participant.id && (
                          <svg className="w-4 h-4 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <title>Owner</title>
                            <path d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06l-3.23.86-3.97-6.59a1.5 1.5 0 00-2.06-.44c-.16.1-.3.24-.4.4L6.54 9.44l-3.23-.86c-.8-.21-1.62.27-1.83 1.07-.05.2-.06.4-.02.6l1.54 7.75h18l1.54-7.75c.08-.2.07-.41.03-.61z"/>
                          </svg>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </>
        )}
      </div>

      {/* Add participants modal */}
      <AddParticipantsModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddParticipants}
        existingParticipantIds={existingParticipantIds}
        title={currentConversation?.type === 'dm' ? 'Создать группу' : 'Добавить участников'}
      />

      {/* Group settings modal */}
      {currentConversation?.type === 'group' && (
        <GroupSettingsModal
          isOpen={showGroupSettings}
          onClose={() => setShowGroupSettings(false)}
          conversation={currentConversation}
          isOwner={isGroupOwner}
          onUpdateName={updateGroupName}
          onUploadAvatar={uploadGroupAvatar}
        />
      )}

      {/* User profile popup */}
      {selectedUser && (
        <UserProfilePopup
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          onSendMessage={handleSendDM}
          position={popupPosition}
        />
      )}

      {/* Image preview modal */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        attachment={previewImage?.attachment || null}
        sender={previewImage?.message.sender}
        sentAt={previewImage?.message.created_at}
      />
    </div>
  )
}
