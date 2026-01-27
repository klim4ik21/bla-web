import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'

export function UsernamePage() {
  const [username, setUsername] = useState('')
  const { setUsername: saveUsername, isLoading, error, clearError, user } = useAuthStore()
  const navigate = useNavigate()

  // Redirect if no user or already has username
  useEffect(() => {
    if (!user) {
      navigate('/auth/login')
    } else if (user.username) {
      navigate('/')
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await saveUsername(username)
    if (success) {
      navigate('/')
    }
  }

  const isValidUsername = username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl"
          >
            {username ? username[0].toUpperCase() : '?'}
          </motion.span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-2xl font-semibold text-[#e5e5e5] mb-2"
        >
          Choose your username
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-[#666666]"
        >
          This is how others will see you
        </motion.p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3 text-rose-400 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <label className="block text-sm text-[#a3a3a3]">Username</label>
          <div className="relative">
            <motion.input
              whileFocus={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
              type="text"
              value={username}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                setUsername(value)
                clearError()
              }}
              placeholder="your_username"
              required
              minLength={3}
              maxLength={32}
              className="w-full bg-[#111111] border border-[#252525] rounded-lg px-4 py-3 text-[#e5e5e5] placeholder-[#525252] focus:outline-none focus:border-[#404040] transition-colors"
            />
            <AnimatePresence>
              {username.length > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${
                    isValidUsername ? 'text-emerald-400' : 'text-[#525252]'
                  }`}
                >
                  {isValidUsername ? '✓' : `${username.length}/3`}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xs text-[#525252]"
          >
            Letters, numbers, and underscores only. 3-32 characters.
          </motion.p>
        </div>

        <motion.button
          whileHover={{ scale: isValidUsername ? 1.02 : 1 }}
          whileTap={{ scale: isValidUsername ? 0.98 : 1 }}
          transition={{ duration: 0.2 }}
          type="submit"
          disabled={isLoading || !isValidUsername}
          className="w-full bg-[#e5e5e5] text-[#0a0a0a] rounded-lg px-4 py-3 font-medium hover:bg-[#d4d4d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-[#0a0a0a]/20 border-t-[#0a0a0a] rounded-full"
              />
              Saving...
            </motion.span>
          ) : (
            'Complete setup'
          )}
        </motion.button>
      </motion.form>
    </motion.div>
  )
}
