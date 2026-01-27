import { motion } from 'framer-motion'

type Props = {
  onBack: () => void
}

const communities = [
  {
    title: 'Спорт',
    subtitle: 'Sport',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 2C16 2 20 8 20 16C20 24 16 30 16 30" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 2C16 2 12 8 12 16C12 24 16 30 16 30" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 16H30" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    color: '#22c55e',
  },
  {
    title: 'Игры',
    subtitle: 'Games',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <rect x="3" y="8" width="26" height="16" rx="5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="22" cy="13" r="1.5" fill="currentColor" />
        <circle cx="22" cy="19" r="1.5" fill="currentColor" />
      </svg>
    ),
    color: '#a855f7',
  },
  {
    title: 'Музыка',
    subtitle: 'Music',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <path d="M12 6V22" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 6L26 3V19" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="22" r="4" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="22" cy="19" r="4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    color: '#f43f5e',
  },
  {
    title: 'Кино',
    subtitle: 'Cinema',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <rect x="4" y="4" width="24" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 11H28M4 21H28M11 4V28M21 4V28" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    color: '#f59e0b',
  },
  {
    title: 'Tech',
    subtitle: 'Technology',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <path d="M10 24L4 16L10 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 8L28 16L22 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 6L14 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    color: '#06b6d4',
  },
  {
    title: 'Арт',
    subtitle: 'Art',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="20" cy="11" r="2" fill="currentColor" />
        <circle cx="10" cy="19" r="2" fill="currentColor" />
        <circle cx="18" cy="21" r="2" fill="currentColor" />
      </svg>
    ),
    color: '#ec4899',
  },
]

export function CommunitiesPage({ onBack }: Props) {
  return (
    <div className="flex-1 min-h-0 bg-[#060606] overflow-y-auto relative">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={onBack}
        className="fixed top-8 left-[calc(72px+2rem)] z-10 flex items-center gap-3 text-white/40 hover:text-white transition-colors group"
      >
        <span className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-white/30 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </span>
        <span className="text-sm tracking-wide">Назад</span>
      </motion.button>

      {/* Content */}
      <div className="flex flex-col px-8 md:px-16 lg:px-24 py-32 min-h-full">

          {/* Header section */}
          <div className="mb-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-4 mb-8"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs tracking-[0.3em] text-white/30 uppercase">Coming Soon</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-[clamp(3rem,12vw,10rem)] font-extralight leading-[0.85] tracking-tight text-white mb-8"
            >
              Сооб
              <br />
              <span className="text-white/20">щества</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-lg md:text-xl text-white/30 max-w-md leading-relaxed font-light"
            >
              Тематические пространства для миллионов людей по всему миру
            </motion.p>
          </div>

          {/* Categories */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-32"
          >
            {communities.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                whileHover={{ y: -4 }}
                className="group relative aspect-[4/3] p-6 md:p-8 rounded-3xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500 cursor-pointer overflow-hidden"
              >
                {/* Corner accent */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle at top right, ${item.color}40, transparent 70%)`
                  }}
                />

                {/* Icon */}
                <div
                  className="w-10 h-10 md:w-12 md:h-12 mb-auto opacity-40 group-hover:opacity-70 transition-opacity duration-500"
                  style={{ color: item.color }}
                >
                  {item.icon}
                </div>

                {/* Text */}
                <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8">
                  <p className="text-[10px] tracking-[0.2em] text-white/20 uppercase mb-1">
                    {item.subtitle}
                  </p>
                  <h3 className="text-xl md:text-2xl font-light text-white/80 group-hover:text-white transition-colors duration-500">
                    {item.title}
                  </h3>
                </div>

                {/* Hover line */}
                <div
                  className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500"
                  style={{ backgroundColor: item.color }}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="mt-auto flex items-end justify-between"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-6 text-white/20">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span className="text-xs tracking-wide">Global</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                  <span className="text-xs tracking-wide">Voice</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <span className="text-xs tracking-wide">Events</span>
                </div>
              </div>
            </div>

            <p className="text-[clamp(4rem,15vw,12rem)] font-extralight leading-none text-white/[0.04] select-none tracking-tighter">
              2026
            </p>
          </motion.div>

      </div>
    </div>
  )
}
