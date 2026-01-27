import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFriendsStore } from '../stores/friendsStore'
import { useMessagesStore } from '../stores/messagesStore'

type Tab = 'online' | 'all' | 'pending' | 'add'

type Props = {
  onSelectConversation: (conversationId: string) => void
}

export function FriendsView({ onSelectConversation }: Props) {
  const [tab, setTab] = useState<Tab>('online')
  const [username, setUsername] = useState('')
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    isLoading,
    error,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    clearError,
  } = useFriendsStore()
  const { openDM } = useMessagesStore()

  const onlineFriends = friends.filter((f) => f.user.status === 'online')

  const handleMessage = async (userId: string) => {
    const convId = await openDM(userId)
    if (convId) {
      onSelectConversation(convId)
    }
  }

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    const success = await sendRequest(username.trim())
    if (success) {
      setUsername('')
    }
  }

  const tabs = [
    { id: 'online' as Tab, label: 'В сети', count: onlineFriends.length },
    { id: 'all' as Tab, label: 'Все', count: friends.length },
    { id: 'pending' as Tab, label: 'Ожидание', count: incomingRequests.length },
    { id: 'add' as Tab, label: 'Добавить', count: null },
  ]

  const statusColors: Record<string, string> = {
    online: 'bg-emerald-400',
    idle: 'bg-amber-400',
    dnd: 'bg-rose-400',
    offline: 'bg-white/20',
  }

  const statusLabels: Record<string, string> = {
    online: 'В сети',
    idle: 'Неактивен',
    dnd: 'Не беспокоить',
    offline: 'Не в сети',
  }

  const renderFriendCard = (friend: typeof friends[0]) => (
    <motion.div
      key={friend.friendship_id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.06] transition-all group"
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center text-sm text-white/40 uppercase overflow-hidden">
          {friend.user.avatar_url ? (
            <img src={friend.user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-medium">{friend.user.username?.[0] || '?'}</span>
          )}
        </div>
        <span
          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[3px] border-[#050505] ${
            statusColors[friend.user.status || 'offline']
          }`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-white font-medium truncate">{friend.user.username}</div>
        <div className="text-xs text-white/30">{statusLabels[friend.user.status || 'offline']}</div>
      </div>

      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <motion.button
          onClick={() => handleMessage(friend.user.id)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white transition-colors"
          title="Написать"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </motion.button>
        <motion.button
          onClick={() => removeFriend(friend.user.id)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/30 hover:bg-rose-500/15 hover:text-rose-400 transition-colors"
          title="Удалить"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  )

  return (
    <div className="flex-1 flex flex-col bg-[#050505]">
      {/* Header */}
      <div className="h-14 border-b border-white/[0.04] flex items-center px-6 gap-6">
        <span className="text-base text-white font-medium">Друзья</span>
        <div className="flex gap-1 bg-white/[0.02] rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                tab === t.id
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab === t.id && (
                <motion.div
                  layoutId="friends-tab"
                  className="absolute inset-0 bg-white/[0.08] rounded-lg"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                    tab === t.id ? 'bg-white/10' : 'bg-white/[0.04]'
                  }`}>
                    {t.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {tab === 'online' && (
            <motion.div
              key="online"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <h3 className="text-[11px] font-medium tracking-widest text-white/20 uppercase mb-4 px-1">
                В сети — {onlineFriends.length}
              </h3>
              {onlineFriends.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.02] flex items-center justify-center">
                    <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                    </svg>
                  </div>
                  <p className="text-white/30">Никого нет в сети</p>
                  <p className="text-sm text-white/15 mt-1">Друзья появятся когда будут онлайн</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {onlineFriends.map(renderFriendCard)}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'all' && (
            <motion.div
              key="all"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <h3 className="text-[11px] font-medium tracking-widest text-white/20 uppercase mb-4 px-1">
                Все друзья — {friends.length}
              </h3>
              {friends.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.02] flex items-center justify-center">
                    <svg className="w-8 h-8 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                  <p className="text-white/30">Пока нет друзей</p>
                  <p className="text-sm text-white/15 mt-1">Добавьте друзей чтобы начать общение</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(renderFriendCard)}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'pending' && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* Incoming */}
              <div>
                <h3 className="text-[11px] font-medium tracking-widest text-white/20 uppercase mb-4 px-1">
                  Входящие — {incomingRequests.length}
                </h3>
                {incomingRequests.length === 0 ? (
                  <p className="text-white/20 text-sm px-1">Нет входящих запросов</p>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.map((req) => (
                      <motion.div
                        key={req.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
                      >
                        <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center text-sm text-white/40 uppercase overflow-hidden">
                          {req.user.avatar_url ? (
                            <img src={req.user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-medium">{req.user.username?.[0] || '?'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{req.user.username}</div>
                          <div className="text-xs text-white/30">Хочет добавить вас в друзья</div>
                        </div>
                        <div className="flex gap-2">
                          <motion.button
                            onClick={() => acceptRequest(req.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                            title="Принять"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </motion.button>
                          <motion.button
                            onClick={() => declineRequest(req.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/30 hover:bg-rose-500/15 hover:text-rose-400 transition-colors"
                            title="Отклонить"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing */}
              <div>
                <h3 className="text-[11px] font-medium tracking-widest text-white/20 uppercase mb-4 px-1">
                  Исходящие — {outgoingRequests.length}
                </h3>
                {outgoingRequests.length === 0 ? (
                  <p className="text-white/20 text-sm px-1">Нет исходящих запросов</p>
                ) : (
                  <div className="space-y-2">
                    {outgoingRequests.map((req) => (
                      <motion.div
                        key={req.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
                      >
                        <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center text-sm text-white/40 uppercase overflow-hidden">
                          {req.user.avatar_url ? (
                            <img src={req.user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-medium">{req.user.username?.[0] || '?'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{req.user.username}</div>
                          <div className="text-xs text-white/30">Запрос отправлен</div>
                        </div>
                        <motion.button
                          onClick={() => cancelRequest(req.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/30 hover:bg-rose-500/15 hover:text-rose-400 transition-colors"
                          title="Отменить"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {tab === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-lg"
            >
              <h3 className="text-xl font-medium text-white mb-2">Добавить друга</h3>
              <p className="text-sm text-white/30 mb-6">
                Введите имя пользователя чтобы отправить запрос в друзья
              </p>

              <form onSubmit={handleSendRequest} className="space-y-4">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-rose-400 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      clearError()
                    }}
                    placeholder="Имя пользователя"
                    className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading || !username.trim()}
                    className="px-6 py-3.5 bg-white text-[#050505] rounded-xl font-medium hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-[#050505]/20 border-t-[#050505] rounded-full animate-spin" />
                    ) : (
                      'Отправить'
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
