import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../../stores/authStore'

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { register, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await register(email, password)
    if (success) {
      navigate('/auth/username')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-2xl font-semibold text-[#e5e5e5] mb-2"
        >
          Create account
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-[#666666]"
        >
          Enter your email and create a password
        </motion.p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
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
          <label className="block text-sm text-[#a3a3a3]">Email</label>
          <motion.input
            whileFocus={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearError()
            }}
            placeholder="you@example.com"
            required
            className="w-full bg-[#111111] border border-[#252525] rounded-lg px-4 py-3 text-[#e5e5e5] placeholder-[#525252] focus:outline-none focus:border-[#404040] transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-[#a3a3a3]">Password</label>
          <motion.input
            whileFocus={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearError()
            }}
            placeholder="Min. 8 characters"
            required
            minLength={8}
            className="w-full bg-[#111111] border border-[#252525] rounded-lg px-4 py-3 text-[#e5e5e5] placeholder-[#525252] focus:outline-none focus:border-[#404040] transition-colors"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
          type="submit"
          disabled={isLoading}
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
              Creating...
            </motion.span>
          ) : (
            'Continue'
          )}
        </motion.button>
      </motion.form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="text-center mt-6 text-[#666666]"
      >
        Already have an account?{' '}
        <Link to="/auth/login" className="text-[#a3a3a3] hover:text-[#e5e5e5] transition-colors">
          Sign in
        </Link>
      </motion.p>
    </motion.div>
  )
}
