import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useFriendsStore } from '../stores/friendsStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useAuthStore } from '../stores/authStore'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSelectConversation: (conversationId: string) => void
  onSelectUser: (userId: string) => void
}

type SearchResult = {
  type: 'user' | 'group' | 'message'
  id: string
  title: string
  subtitle?: string
  avatarUrl?: string | null
  conversationId?: string
  messageContent?: string
  timestamp?: string
}

export function SearchModal({ isOpen, onClose, onSelectConversation, onSelectUser }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuthStore()
  const { friends } = useFriendsStore()
  const { conversations, messages } = useMessagesStore()

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Default content when no query
  const defaultContent = useMemo(() => {
    const items: SearchResult[] = []

    // Recent conversations (up to 5)
    const recentConvs = [...conversations]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)

    for (const conv of recentConvs) {
      if (conv.type === 'dm') {
        const other = conv.participants.find(p => p.id !== user?.id)
        if (other) {
          items.push({
            type: 'user',
            id: other.id,
            title: other.username || 'Unknown',
            subtitle: conv.last_message?.content || 'Нет сообщений',
            avatarUrl: other.avatar_url,
            conversationId: conv.id,
          })
        }
      } else {
        const groupName = conv.name || conv.participants
          .filter(p => p.id !== user?.id)
          .map(p => p.username)
          .join(', ')
        items.push({
          type: 'group',
          id: conv.id,
          title: groupName,
          subtitle: conv.last_message?.content || 'Нет сообщений',
          avatarUrl: conv.avatar_url,
          conversationId: conv.id,
        })
      }
    }

    return items
  }, [conversations, user?.id])

  // Online friends
  const onlineFriends = useMemo(() => {
    return friends
      .filter(f => f.user.status === 'online')
      .slice(0, 8)
      .map(f => ({
        type: 'user' as const,
        id: f.user.id,
        title: f.user.username || 'Unknown',
        subtitle: 'В сети',
        avatarUrl: f.user.avatar_url,
      }))
  }, [friends])

  const results = useMemo(() => {
    if (!query.trim()) return []

    const searchResults: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    // Search users (friends)
    for (const friend of friends) {
      if (friend.user.username?.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          type: 'user',
          id: friend.user.id,
          title: friend.user.username || 'Unknown',
          subtitle: friend.user.status === 'online' ? 'В сети' : 'Не в сети',
          avatarUrl: friend.user.avatar_url,
        })
      }
    }

    // Search groups
    for (const conv of conversations) {
      if (conv.type === 'group') {
        const groupName = conv.name || conv.participants
          .filter(p => p.id !== user?.id)
          .map(p => p.username)
          .join(', ')

        if (groupName.toLowerCase().includes(lowerQuery)) {
          searchResults.push({
            type: 'group',
            id: conv.id,
            title: groupName,
            subtitle: `${conv.participants.length} участников`,
            avatarUrl: conv.avatar_url,
            conversationId: conv.id,
          })
        }
      }
    }

    // Search messages in current conversation
    for (const msg of messages) {
      if (msg.content?.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          type: 'message',
          id: msg.id,
          title: msg.sender?.username || 'Unknown',
          subtitle: msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content,
          avatarUrl: msg.sender?.avatar_url,
          conversationId: msg.conversation_id,
          messageContent: msg.content,
          timestamp: msg.created_at,
        })
      }
    }

    return searchResults.slice(0, 20) // Limit results
  }, [query, friends, conversations, messages, user?.id])

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'user') {
      onSelectUser(result.id)
    } else if (result.conversationId) {
      onSelectConversation(result.conversationId)
    }
    onClose()
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    }) + ' ' + date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const statusColors: Record<string, string> = {
    online: 'bg-emerald-400',
    idle: 'bg-amber-400',
    dnd: 'bg-rose-400',
    offline: 'bg-white/20',
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl mx-4"
          >
            {/* Search Input */}
            <div className="relative">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск сообщений, пользователей, групп..."
                className="w-full bg-[#0f0f0f] border border-white/[0.08] rounded-2xl pl-14 pr-14 py-5 text-lg text-white placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
              />
              {query && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setQuery('')}
                  className="absolute right-5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.15] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              )}
            </div>

            {/* Results */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="mt-2 bg-[#0f0f0f] border border-white/[0.08] rounded-2xl overflow-hidden"
            >
              {query.trim() ? (
                <>
                  {results.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/[0.04] flex items-center justify-center">
                      <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </div>
                    <p className="text-base text-white/40">Ничего не найдено</p>
                    <p className="text-sm text-white/20 mt-1">Попробуйте другой запрос</p>
                  </div>
                ) : (
                    <div className="max-h-[50vh] overflow-y-auto py-2">
                      {/* Group results by type */}
                      {results.some(r => r.type === 'user') && (
                        <>
                          <div className="px-5 py-2.5">
                            <span className="text-xs font-medium tracking-widest text-white/30 uppercase">
                              Пользователи
                            </span>
                          </div>
                          {results.filter(r => r.type === 'user').map((result) => (
                            <button
                              key={result.id}
                              onClick={() => handleSelect(result)}
                              className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/[0.04] transition-colors"
                            >
                              <div className="relative flex-shrink-0">
                                <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden">
                                  {result.avatarUrl ? (
                                    <img src={result.avatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-base text-white/30 uppercase">{result.title[0]}</span>
                                  )}
                                </div>
                                <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0f0f0f] ${
                                  result.subtitle === 'В сети' ? statusColors.online : statusColors.offline
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-medium text-white/80 truncate">{result.title}</p>
                                <p className="text-sm text-white/40">{result.subtitle}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}

                      {results.some(r => r.type === 'group') && (
                        <>
                          <div className="px-5 py-2.5 mt-2">
                            <span className="text-xs font-medium tracking-widest text-white/30 uppercase">
                              Группы
                            </span>
                          </div>
                          {results.filter(r => r.type === 'group').map((result) => (
                            <button
                              key={result.id}
                              onClick={() => handleSelect(result)}
                              className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/[0.04] transition-colors"
                            >
                              <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden">
                                {result.avatarUrl ? (
                                  <img src={result.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-medium text-white/80 truncate">{result.title}</p>
                                <p className="text-sm text-white/40">{result.subtitle}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}

                      {results.some(r => r.type === 'message') && (
                        <>
                          <div className="px-5 py-2.5 mt-2">
                            <span className="text-xs font-medium tracking-widest text-white/30 uppercase">
                              Сообщения
                            </span>
                          </div>
                          {results.filter(r => r.type === 'message').map((result) => (
                            <button
                              key={result.id}
                              onClick={() => handleSelect(result)}
                              className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/[0.04] transition-colors"
                            >
                              <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
                                {result.avatarUrl ? (
                                  <img src={result.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-base text-white/30 uppercase">{result.title[0]}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-base font-medium text-white/80 truncate">{result.title}</p>
                                  {result.timestamp && (
                                    <span className="text-xs text-white/30 tabular-nums flex-shrink-0">
                                      {formatTime(result.timestamp)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-white/50 truncate">{result.subtitle}</p>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {/* Footer hint */}
                  <div className="px-5 py-3.5 border-t border-white/[0.04] flex items-center justify-between">
                    <span className="text-sm text-white/30">
                      {results.length} результатов
                    </span>
                    <span className="text-sm text-white/30 flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-white/[0.06] rounded text-white/40 text-xs">ESC</kbd>
                      <span>закрыть</span>
                    </span>
                  </div>
                </>
              ) : (
                /* Default content when no query */
                <>
                  <div className="max-h-[50vh] overflow-y-auto py-2">
                    {/* Online friends */}
                    {onlineFriends.length > 0 && (
                      <>
                        <div className="px-5 py-2.5">
                          <span className="text-xs font-medium tracking-widest text-white/30 uppercase">
                            Сейчас в сети
                          </span>
                        </div>
                        <div className="px-3 pb-2 flex flex-wrap gap-2">
                          {onlineFriends.map((friend) => (
                            <motion.button
                              key={friend.id}
                              onClick={() => handleSelect(friend)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl transition-colors"
                            >
                              <div className="relative">
                                <div className="w-7 h-7 rounded-full bg-white/[0.06] overflow-hidden">
                                  {friend.avatarUrl ? (
                                    <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="w-full h-full flex items-center justify-center text-xs text-white/30 uppercase">
                                      {friend.title[0]}
                                    </span>
                                  )}
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0f0f0f]" />
                              </div>
                              <span className="text-sm text-white/70">{friend.title}</span>
                            </motion.button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Recent conversations */}
                    {defaultContent.length > 0 && (
                      <>
                        <div className="px-5 py-2.5 mt-1">
                          <span className="text-xs font-medium tracking-widest text-white/30 uppercase">
                            Недавние чаты
                          </span>
                        </div>
                        {defaultContent.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="relative flex-shrink-0">
                              <div className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden">
                                {item.avatarUrl ? (
                                  <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : item.type === 'group' ? (
                                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                  </svg>
                                ) : (
                                  <span className="text-base text-white/30 uppercase">{item.title[0]}</span>
                                )}
                              </div>
                              {item.type === 'group' && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white/[0.1] rounded-full border-2 border-[#0f0f0f] flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-medium text-white/80 truncate">{item.title}</p>
                              <p className="text-sm text-white/40 truncate">{item.subtitle}</p>
                            </div>
                            <svg className="w-5 h-5 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Empty state */}
                    {defaultContent.length === 0 && onlineFriends.length === 0 && (
                      <div className="px-6 py-10 text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/[0.04] flex items-center justify-center">
                          <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                          </svg>
                        </div>
                        <p className="text-base text-white/40">Начните вводить для поиска</p>
                        <p className="text-sm text-white/20 mt-1">Сообщения, пользователи, группы</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3.5 border-t border-white/[0.04] flex items-center justify-between">
                    <span className="text-sm text-white/30">
                      Быстрый доступ
                    </span>
                    <span className="text-sm text-white/30 flex items-center gap-2">
                      <kbd className="px-2 py-1 bg-white/[0.06] rounded text-white/40 text-xs">ESC</kbd>
                      <span>закрыть</span>
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
