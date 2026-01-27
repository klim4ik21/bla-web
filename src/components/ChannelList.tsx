import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { useFriendsStore } from '../stores/friendsStore'
import { useMessagesStore } from '../stores/messagesStore'
import { SearchModal } from './SearchModal'

type Props = {
  onSelectConversation: (conversationId: string) => void
  selectedConversation: string | null
  showFriends: boolean
  onToggleFriends: () => void
  onEditGroup?: (conversationId: string) => void
}

type ConversationItem = {
  type: 'dm' | 'group'
  odnoklasnikBroId?: string
  name: string
  avatarUrl?: string | null
  groupAvatarUrl?: string | null
  status?: 'online' | 'offline' | 'idle' | 'dnd'
  isOwnMessage?: boolean
  lastMessage?: string
  lastMessageTime?: string
  conversationId?: string
  unread?: number
  participantCount?: number
  ownerId?: string | null
  participants?: { username: string; avatar_url?: string | null }[]
}

type ContextMenu = {
  x: number
  y: number
  item: ConversationItem
} | null

export function ChannelList({
  onSelectConversation,
  selectedConversation,
  showFriends,
  onToggleFriends,
  onEditGroup,
}: Props) {
  const { user } = useAuthStore()
  const { friends, incomingRequests, removeFriend } = useFriendsStore()
  const { conversations, openDM, leaveGroup } = useMessagesStore()
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null)
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  // Keyboard shortcut for search (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, item: ConversationItem) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, item })
  }

  const handleLeaveGroup = async () => {
    if (contextMenu?.item.conversationId) {
      await leaveGroup(contextMenu.item.conversationId)
    }
    setContextMenu(null)
  }

  const handleBlockUser = async () => {
    if (contextMenu?.item.odnoklasnikBroId) {
      await removeFriend(contextMenu.item.odnoklasnikBroId)
    }
    setContextMenu(null)
  }

  const handleEditGroup = () => {
    if (contextMenu?.item.conversationId) {
      onSelectConversation(contextMenu.item.conversationId)
      onEditGroup?.(contextMenu.item.conversationId)
    }
    setContextMenu(null)
  }

  const conversationList = useMemo(() => {
    const getMessagePreview = (msg: typeof conversations[0]['last_message'] | undefined) => {
      if (!msg) return undefined
      if (msg.content) return msg.content
      if (msg.attachments && msg.attachments.length > 0) {
        const firstAttachment = msg.attachments[0]
        if (firstAttachment.type === 'image') {
          return 'Фото'
        }
        return 'Файл'
      }
      return 'Медиа'
    }

    const items: ConversationItem[] = []

    const friendConversations = new Map<string, typeof conversations[0]>()
    for (const conv of conversations) {
      if (conv.type === 'dm') {
        const other = conv.participants.find((p) => p.id !== user?.id)
        if (other) {
          friendConversations.set(other.id, conv)
        }
      }
    }

    for (const friend of friends) {
      const conv = friendConversations.get(friend.user.id)
      items.push({
        type: 'dm',
        odnoklasnikBroId: friend.user.id,
        name: friend.user.username || 'Unknown',
        avatarUrl: friend.user.avatar_url,
        status: (friend.user.status as 'online' | 'offline' | 'idle' | 'dnd') || 'offline',
        isOwnMessage: conv?.last_message?.sender_id === user?.id,
        lastMessage: getMessagePreview(conv?.last_message),
        lastMessageTime: conv?.last_message?.created_at || conv?.updated_at,
        conversationId: conv?.id,
        unread: 0,
      })
    }

    for (const conv of conversations) {
      if (conv.type === 'group') {
        const otherParticipants = conv.participants.filter((p) => p.id !== user?.id)
        const names = otherParticipants.map((p) => p.username || 'Unknown')
        let groupName = conv.name
        if (!groupName) {
          if (names.length === 0) groupName = 'Group'
          else if (names.length === 1) groupName = names[0]
          else if (names.length === 2) groupName = names.join(' и ')
          else groupName = names.slice(0, -1).join(', ') + ' и ' + names[names.length - 1]
        }

        items.push({
          type: 'group',
          name: groupName,
          groupAvatarUrl: conv.avatar_url,
          isOwnMessage: conv.last_message?.sender_id === user?.id,
          lastMessage: getMessagePreview(conv.last_message),
          lastMessageTime: conv.last_message?.created_at || conv.updated_at,
          conversationId: conv.id,
          unread: 0,
          participantCount: conv.participants.length,
          ownerId: conv.owner_id,
          participants: otherParticipants.slice(0, 3).map((p) => ({
            username: p.username || '?',
            avatar_url: p.avatar_url,
          })),
        })
      }
    }

    items.sort((a, b) => {
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      }
      if (a.lastMessageTime) return -1
      if (b.lastMessageTime) return 1
      return a.name.localeCompare(b.name)
    })

    return items
  }, [friends, conversations, user?.id])

  const handleSelectConversation = async (item: ConversationItem) => {
    if (item.conversationId) {
      onSelectConversation(item.conversationId)
    } else if (item.type === 'dm' && item.odnoklasnikBroId) {
      const convId = await openDM(item.odnoklasnikBroId)
      if (convId) {
        onSelectConversation(convId)
      }
    }
  }

  const handleSearchSelectUser = async (userId: string) => {
    const convId = await openDM(userId)
    if (convId) {
      onSelectConversation(convId)
    }
  }

  const statusColors = {
    online: 'bg-emerald-400',
    idle: 'bg-amber-400',
    dnd: 'bg-rose-400',
    offline: 'bg-white/20',
  }

  return (
    <div className="w-72 border-r border-white/[0.04] flex flex-col h-full pb-16 bg-[#0a0a0a]">
      {/* Header */}
      <div className="p-3 space-y-3">
        {/* Search */}
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-3 bg-white/[0.03] border border-white/[0.04] rounded-xl px-4 py-3 text-sm text-white/30 hover:border-white/[0.08] hover:bg-white/[0.04] transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="font-light">Поиск</span>
          <kbd className="ml-auto text-[10px] text-white/20 bg-white/[0.04] px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        {/* Friends Button */}
        <motion.button
          onClick={onToggleFriends}
          whileTap={{ scale: 0.98 }}
          className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
            showFriends
              ? 'bg-white text-[#0a0a0a]'
              : 'bg-white/[0.03] border border-white/[0.04] text-white/50 hover:border-white/[0.08] hover:text-white/70'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <span className="text-sm font-medium">Друзья</span>
          {incomingRequests.length > 0 && (
            <span className={`absolute right-3 w-5 h-5 text-xs rounded-full flex items-center justify-center font-medium ${
              showFriends ? 'bg-[#0a0a0a] text-white' : 'bg-rose-500 text-white'
            }`}>
              {incomingRequests.length}
            </span>
          )}
        </motion.button>
      </div>

      {/* Section Label */}
      <div className="px-5 py-2">
        <span className="text-[11px] font-medium tracking-widest text-white/20 uppercase">
          Сообщения
        </span>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2">
        {conversationList.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/[0.03] flex items-center justify-center">
              <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-white/30">Нет сообщений</p>
            <p className="text-xs text-white/15 mt-1">Добавьте друзей чтобы начать</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {conversationList.map((item) => {
              const isSelected = selectedConversation === item.conversationId && !showFriends
              return (
                <motion.button
                  key={item.conversationId || item.odnoklasnikBroId}
                  onClick={() => handleSelectConversation(item)}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-200 group ${
                    isSelected
                      ? 'bg-white/[0.08]'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {item.type === 'dm' ? (
                      <>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm uppercase overflow-hidden ${
                          isSelected ? 'bg-white/10' : 'bg-white/[0.06]'
                        }`}>
                          {item.avatarUrl ? (
                            <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white/40 font-medium">{item.name[0]}</span>
                          )}
                        </div>
                        {item.status && (
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${statusColors[item.status]}`}
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-10 h-10 relative">
                        {item.groupAvatarUrl ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden">
                            <img src={item.groupAvatarUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : item.participants && item.participants.length >= 2 ? (
                          <>
                            <div className="absolute top-0 left-0 w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center text-xs text-white/40 uppercase overflow-hidden border-2 border-[#0a0a0a]">
                              {item.participants[0]?.avatar_url ? (
                                <img src={item.participants[0].avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                item.participants[0]?.username[0]
                              )}
                            </div>
                            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-xs text-white/40 uppercase overflow-hidden border-2 border-[#0a0a0a]">
                              {item.participants[1]?.avatar_url ? (
                                <img src={item.participants[1].avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                item.participants[1]?.username[0]
                              )}
                            </div>
                          </>
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-white/10' : 'bg-white/[0.06]'
                          }`}>
                            <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate transition-colors ${
                        isSelected ? 'text-white' : 'text-white/70 group-hover:text-white/90'
                      }`}>
                        {item.name}
                      </span>
                      {item.type === 'group' && item.participantCount && (
                        <span className="text-[10px] text-white/20 tabular-nums">{item.participantCount}</span>
                      )}
                    </div>
                    {item.lastMessage ? (
                      <p className={`text-xs truncate mt-0.5 ${
                        isSelected ? 'text-white/50' : 'text-white/30'
                      }`}>
                        {item.isOwnMessage && <span className="text-white/20">Вы: </span>}
                        {item.lastMessage}
                      </p>
                    ) : (
                      <p className="text-xs text-white/20 mt-0.5">Нет сообщений</p>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="fixed z-50 w-48 bg-[#141414] rounded-xl border border-white/[0.06] shadow-2xl py-1.5 overflow-hidden"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              {contextMenu.item.type === 'group' ? (
                <>
                  {(contextMenu.item.ownerId === user?.id || !contextMenu.item.ownerId) && (
                    <button
                      onClick={handleEditGroup}
                      className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/[0.06] hover:text-white flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      Редактировать
                    </button>
                  )}
                  <button
                    onClick={handleLeaveGroup}
                    className="w-full px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Покинуть
                  </button>
                </>
              ) : (
                <button
                  onClick={handleBlockUser}
                  className="w-full px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                  </svg>
                  Удалить из друзей
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectConversation={onSelectConversation}
        onSelectUser={handleSearchSelectUser}
      />
    </div>
  )
}
