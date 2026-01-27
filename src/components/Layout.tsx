import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ServerSidebar } from './ServerSidebar'
import { ChannelList } from './ChannelList'
import { UserPanel } from './UserPanel'
import { ChatArea } from './ChatArea'
import { FriendsView } from './FriendsView'
import { ActiveCallBar } from './ActiveCallBar'
import { CommunitiesPage } from './CommunitiesPage'
import { useGatewayStore } from '../stores/gatewayStore'
import { useCallStore } from '../stores/callStore'

export function Layout() {
  const { conversationId: urlConversationId } = useParams()
  const navigate = useNavigate()
  const [isDM, setIsDM] = useState(true)
  const [showFriends, setShowFriends] = useState(false)
  const [showCommunities, setShowCommunities] = useState(false)
  const { connect, disconnect, isReady } = useGatewayStore()
  const { myCall } = useCallStore()

  // Derive selectedConversation from URL
  const selectedConversation = urlConversationId || null

  // Check if we're viewing a different conversation than the one with active call
  const isInCallButDifferentConversation = myCall &&
    myCall.conversationId !== selectedConversation

  // Connect to gateway on mount
  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  const handleToggleDM = () => {
    setIsDM(true)
    setShowFriends(false)
    setShowCommunities(false)
  }

  const handleToggleCommunities = () => {
    setShowCommunities(true)
    setShowFriends(false)
  }

  const handleSelectConversation = (conversationId: string) => {
    navigate(`/conversations/${conversationId}`)
    setShowFriends(false)
    setShowCommunities(false)
  }

  const handleToggleFriends = () => {
    setShowFriends(!showFriends)
  }

  const handleReturnToCall = () => {
    if (myCall?.conversationId) {
      navigate(`/conversations/${myCall.conversationId}`)
      setShowFriends(false)
      setShowCommunities(false)
    }
  }

  const handleBackFromCommunities = () => {
    setShowCommunities(false)
    setIsDM(true)
  }

  if (!isReady) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#252525] border-t-[#e5e5e5] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-[#e5e5e5] flex flex-col">
      {/* Active call bar - shows when in call but viewing different conversation */}
      <AnimatePresence>
        {isInCallButDifferentConversation && (
          <ActiveCallBar onReturnToCall={handleReturnToCall} />
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Server Sidebar - 72px */}
        <ServerSidebar
          isDM={isDM}
          showCommunities={showCommunities}
          onToggleDM={handleToggleDM}
          onToggleCommunities={handleToggleCommunities}
        />

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {showCommunities ? (
            <motion.div
              key="communities"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex min-h-0"
            >
              <CommunitiesPage onBack={handleBackFromCommunities} />
            </motion.div>
          ) : (
            <motion.div
              key="dm-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex"
            >
              {/* Channel List */}
              <ChannelList
                onSelectConversation={handleSelectConversation}
                selectedConversation={selectedConversation}
                showFriends={showFriends}
                onToggleFriends={handleToggleFriends}
                onEditGroup={handleSelectConversation}
              />

              {/* Chat or Friends */}
              {showFriends ? (
                <FriendsView onSelectConversation={handleSelectConversation} />
              ) : (
                <ChatArea
                  conversationId={selectedConversation}
                  onConversationChange={handleSelectConversation}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Panel - Floating at bottom left */}
        {!showCommunities && <UserPanel />}
      </div>

    </div>
  )
}
