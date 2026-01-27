import { motion } from 'framer-motion'

type Props = {
  isDM: boolean
  showCommunities: boolean
  onToggleDM: () => void
  onToggleCommunities: () => void
}

export function ServerSidebar({ isDM, showCommunities, onToggleDM, onToggleCommunities }: Props) {
  return (
    <div className="w-[72px] flex flex-col items-center py-4 gap-2 bg-[#050505] border-r border-white/[0.04]">
      {/* DM Button */}
      <motion.button
        onClick={onToggleDM}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-medium transition-all duration-200 ${
          isDM && !showCommunities
            ? 'bg-white text-[#050505] rounded-xl shadow-lg shadow-white/10'
            : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 hover:rounded-xl'
        }`}
      >
        <span className="tracking-tight">DM</span>
        {isDM && !showCommunities && (
          <motion.div
            layoutId="sidebar-indicator"
            className="absolute -left-[22px] w-1 h-8 bg-white rounded-r-full"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </motion.button>

      {/* Divider */}
      <div className="w-8 h-px bg-white/[0.06] my-1" />

      {/* Communities Globe Button */}
      <motion.button
        onClick={onToggleCommunities}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
          showCommunities
            ? 'bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20'
            : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 hover:rounded-xl'
        }`}
        title="Сообщества"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {showCommunities && (
          <motion.div
            layoutId="sidebar-indicator"
            className="absolute -left-[22px] w-1 h-8 bg-emerald-500 rounded-r-full"
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </motion.button>
    </div>
  )
}
