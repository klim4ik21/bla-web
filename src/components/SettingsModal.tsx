import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { useGatewayStore } from '../stores/gatewayStore'
import { useCallStore } from '../stores/callStore'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type SettingsSection = 'profile' | 'voice' | 'connection'

type AudioDevice = {
  deviceId: string
  label: string
}

export function SettingsModal({ isOpen, onClose }: Props) {
  const { user, uploadAvatar, isLoading, logout } = useAuthStore()
  const { isConnected, isReady } = useGatewayStore()
  const { voiceClient, myCall } = useCallStore()

  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Audio devices
  const [audioInputs, setAudioInputs] = useState<AudioDevice[]>([])
  const [audioOutputs, setAudioOutputs] = useState<AudioDevice[]>([])
  const [selectedInput, setSelectedInput] = useState<string>('')
  const [selectedOutput, setSelectedOutput] = useState<string>('')
  const [inputVolume, setInputVolume] = useState(100)
  const [outputVolume, setOutputVolume] = useState(100)
  const [inputDropdownOpen, setInputDropdownOpen] = useState(false)
  const [outputDropdownOpen, setOutputDropdownOpen] = useState(false)

  // Connection debug
  const [pingTime, setPingTime] = useState<number | null>(null)

  // Load audio devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ audio: true })

        const devices = await navigator.mediaDevices.enumerateDevices()

        const inputs = devices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Микрофон ${d.deviceId.slice(0, 5)}` }))

        const outputs = devices
          .filter(d => d.kind === 'audiooutput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Динамик ${d.deviceId.slice(0, 5)}` }))

        setAudioInputs(inputs)
        setAudioOutputs(outputs)

        // Set defaults
        if (inputs.length > 0 && !selectedInput) {
          setSelectedInput(inputs[0].deviceId)
        }
        if (outputs.length > 0 && !selectedOutput) {
          setSelectedOutput(outputs[0].deviceId)
        }
      } catch (err) {
        console.error('Failed to load audio devices:', err)
      }
    }

    if (isOpen && activeSection === 'voice') {
      loadDevices()
    }
  }, [isOpen, activeSection])

  // Ping measurement
  useEffect(() => {
    if (isOpen && activeSection === 'connection' && isConnected) {
      const measurePing = () => {
        const start = performance.now()
        // Simulate ping - in real app you'd send a ping to server
        setTimeout(() => {
          setPingTime(Math.round(performance.now() - start + Math.random() * 20))
        }, 50)
      }

      measurePing()
      const interval = setInterval(measurePing, 3000)
      return () => clearInterval(interval)
    }
  }, [isOpen, activeSection, isConnected])

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    const success = await uploadAvatar(file)
    if (success) {
      setPreview(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const avatarUrl = preview || user?.avatar_url

  const sections = [
    { id: 'profile' as const, label: 'Мой профиль', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    )},
    { id: 'voice' as const, label: 'Голос и видео', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    )},
    { id: 'connection' as const, label: 'Соединение', icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    )},
  ]

  const handleClose = () => {
    setActiveSection('profile')
    onClose()
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] overflow-y-auto pointer-events-none"
          >
            <div className="min-h-full flex items-center justify-center p-4 md:p-10">
              <div
                className="w-full max-w-5xl bg-[#0a0a0a] rounded-2xl border border-white/[0.06] shadow-2xl overflow-hidden flex pointer-events-auto"
                style={{ height: 'calc(100vh - 80px)', maxHeight: '800px' }}
                onClick={(e) => e.stopPropagation()}
              >
              {/* Sidebar */}
              <div className="w-60 bg-[#080808] border-r border-white/[0.04] flex flex-col">
                <div className="flex-1 p-3 space-y-1 overflow-y-auto">
                  <div className="px-3 py-2 text-[10px] font-semibold tracking-widest text-white/30 uppercase">
                    Настройки
                  </div>

                  {sections.map((section) => (
                    <motion.button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        activeSection === section.id
                          ? 'bg-white/[0.08] text-white'
                          : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                      }`}
                    >
                      {section.icon}
                      {section.label}
                    </motion.button>
                  ))}

                  <div className="!mt-4 px-3 py-2 text-[10px] font-semibold tracking-widest text-white/30 uppercase">
                    Аккаунт
                  </div>

                  <motion.button
                    onClick={logout}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Выйти
                  </motion.button>
                </div>

                {/* User info at bottom */}
                <div className="p-3 border-t border-white/[0.04]">
                  <div className="flex items-center gap-3 px-2 py-2">
                    <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-sm text-white/40 uppercase overflow-hidden">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user?.username?.[0] || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{user?.username}</p>
                      <p className="text-xs text-white/30 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="h-14 border-b border-white/[0.04] flex items-center justify-between px-6 flex-shrink-0">
                  <h2 className="text-lg font-medium text-white">
                    {sections.find(s => s.id === activeSection)?.label}
                  </h2>
                  <motion.button
                    onClick={handleClose}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-y-auto p-6">
                  <AnimatePresence mode="wait">
                    {activeSection === 'profile' && (
                      <motion.div
                        key="profile"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="max-w-2xl space-y-8"
                      >
                        {/* Avatar Section */}
                        <div>
                          <h3 className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-4">
                            Аватар
                          </h3>
                          <div className="flex items-start gap-6">
                            {/* Current Avatar */}
                            <div className="relative group">
                              <div className={`w-28 h-28 rounded-full flex items-center justify-center text-3xl uppercase overflow-hidden ${
                                avatarUrl ? '' : 'bg-white/[0.06] text-white/30'
                              }`}>
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-medium">{user?.username?.[0] || 'U'}</span>
                                )}
                              </div>
                              {isLoading && (
                                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                </div>
                              )}
                              <motion.button
                                onClick={() => fileInputRef.current?.click()}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                              >
                                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                                </svg>
                              </motion.button>
                            </div>

                            {/* Upload Area */}
                            <div className="flex-1">
                              <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                                  dragOver
                                    ? 'border-white/30 bg-white/[0.04]'
                                    : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]'
                                }`}
                              >
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/jpeg,image/png,image/gif,image/webp"
                                  onChange={handleInputChange}
                                  className="hidden"
                                />
                                <svg className="w-10 h-10 mx-auto mb-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                                <p className="text-sm text-white/40">
                                  <span className="text-white/60">Нажмите для загрузки</span> или перетащите файл
                                </p>
                                <p className="text-xs text-white/20 mt-2">PNG, JPG, GIF до 5MB</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Profile Info */}
                        <div>
                          <h3 className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-4">
                            Информация профиля
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm text-white/50 mb-2">Имя пользователя</label>
                              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white/60">
                                {user?.username || 'Не задано'}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm text-white/50 mb-2">Email</label>
                              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white/60">
                                {user?.email}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSection === 'voice' && (
                      <motion.div
                        key="voice"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="max-w-2xl space-y-8"
                      >
                        {/* Input Device */}
                        <div>
                          <h3 className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-4">
                            Устройство ввода
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm text-white/50 mb-2">Микрофон</label>
                              <div className="relative">
                                <motion.button
                                  onClick={() => setInputDropdownOpen(!inputDropdownOpen)}
                                  whileTap={{ scale: 0.995 }}
                                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-left text-white/80 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                      </svg>
                                    </div>
                                    <span className="truncate">
                                      {audioInputs.find(d => d.deviceId === selectedInput)?.label || 'Выберите микрофон'}
                                    </span>
                                  </div>
                                  <svg className={`w-5 h-5 text-white/30 transition-transform ${inputDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                  </svg>
                                </motion.button>
                                <AnimatePresence>
                                  {inputDropdownOpen && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setInputDropdownOpen(false)} />
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-[#141414] border border-white/[0.08] rounded-xl shadow-2xl z-20 overflow-hidden"
                                      >
                                        <div className="max-h-64 overflow-y-auto py-1">
                                          {audioInputs.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-white/30">Нет доступных устройств</div>
                                          ) : (
                                            audioInputs.map((device) => (
                                              <motion.button
                                                key={device.deviceId}
                                                onClick={() => {
                                                  setSelectedInput(device.deviceId)
                                                  setInputDropdownOpen(false)
                                                }}
                                                whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                                                className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors ${
                                                  selectedInput === device.deviceId ? 'text-white bg-white/[0.04]' : 'text-white/60'
                                                }`}
                                              >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                  selectedInput === device.deviceId ? 'bg-emerald-500/20' : 'bg-white/[0.04]'
                                                }`}>
                                                  <svg className={`w-4 h-4 ${selectedInput === device.deviceId ? 'text-emerald-400' : 'text-white/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                                  </svg>
                                                </div>
                                                <span className="flex-1 truncate">{device.label}</span>
                                                {selectedInput === device.deviceId && (
                                                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                  </svg>
                                                )}
                                              </motion.button>
                                            ))
                                          )}
                                        </div>
                                      </motion.div>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-white/50">Громкость ввода</label>
                                <span className="text-sm text-white/30 tabular-nums">{inputVolume}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={inputVolume}
                                onChange={(e) => setInputVolume(Number(e.target.value))}
                                className="w-full h-2 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Output Device */}
                        <div>
                          <h3 className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-4">
                            Устройство вывода
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm text-white/50 mb-2">Динамики/Наушники</label>
                              <div className="relative">
                                <motion.button
                                  onClick={() => setOutputDropdownOpen(!outputDropdownOpen)}
                                  whileTap={{ scale: 0.995 }}
                                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-left text-white/80 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                                      </svg>
                                    </div>
                                    <span className="truncate">
                                      {audioOutputs.find(d => d.deviceId === selectedOutput)?.label || 'Выберите устройство'}
                                    </span>
                                  </div>
                                  <svg className={`w-5 h-5 text-white/30 transition-transform ${outputDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                  </svg>
                                </motion.button>
                                <AnimatePresence>
                                  {outputDropdownOpen && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setOutputDropdownOpen(false)} />
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-[#141414] border border-white/[0.08] rounded-xl shadow-2xl z-20 overflow-hidden"
                                      >
                                        <div className="max-h-64 overflow-y-auto py-1">
                                          {audioOutputs.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-white/30">Нет доступных устройств</div>
                                          ) : (
                                            audioOutputs.map((device) => (
                                              <motion.button
                                                key={device.deviceId}
                                                onClick={() => {
                                                  setSelectedOutput(device.deviceId)
                                                  setOutputDropdownOpen(false)
                                                }}
                                                whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                                                className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors ${
                                                  selectedOutput === device.deviceId ? 'text-white bg-white/[0.04]' : 'text-white/60'
                                                }`}
                                              >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                  selectedOutput === device.deviceId ? 'bg-emerald-500/20' : 'bg-white/[0.04]'
                                                }`}>
                                                  <svg className={`w-4 h-4 ${selectedOutput === device.deviceId ? 'text-emerald-400' : 'text-white/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                                                  </svg>
                                                </div>
                                                <span className="flex-1 truncate">{device.label}</span>
                                                {selectedOutput === device.deviceId && (
                                                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                  </svg>
                                                )}
                                              </motion.button>
                                            ))
                                          )}
                                        </div>
                                      </motion.div>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-white/50">Громкость вывода</label>
                                <span className="text-sm text-white/30 tabular-nums">{outputVolume}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={outputVolume}
                                onChange={(e) => setOutputVolume(Number(e.target.value))}
                                className="w-full h-2 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Test */}
                        <div>
                          <h3 className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-4">
                            Проверка
                          </h3>
                          <div className="flex gap-3">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                              </svg>
                              Проверить микрофон
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-all"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                              </svg>
                              Проверить звук
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeSection === 'connection' && (
                      <motion.div
                        key="connection"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="max-w-2xl space-y-8"
                      >
                        {/* Connection Status */}
                        <div>
                          <h3 className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-4">
                            Статус подключения
                          </h3>
                          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                <span className="text-white/70">WebSocket</span>
                              </div>
                              <span className={`text-sm ${isConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isConnected ? 'Подключено' : 'Отключено'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <span className="text-white/70">Синхронизация</span>
                              </div>
                              <span className={`text-sm ${isReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {isReady ? 'Готово' : 'Ожидание...'}
                              </span>
                            </div>
                            {myCall && (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full ${voiceClient ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                  <span className="text-white/70">Голосовое соединение</span>
                                </div>
                                <span className={`text-sm ${voiceClient ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {voiceClient ? 'Активно' : 'Подключение...'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Ping */}
                        <div>
                          <h3 className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-4">
                            Задержка
                          </h3>
                          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                            <div className="flex items-center justify-between">
                              <span className="text-white/70">Пинг до сервера</span>
                              <span className={`text-lg font-medium tabular-nums ${
                                pingTime === null ? 'text-white/30' :
                                pingTime < 50 ? 'text-emerald-400' :
                                pingTime < 100 ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {pingTime !== null ? `${pingTime} мс` : '—'}
                              </span>
                            </div>
                            <div className="mt-3 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: pingTime ? `${Math.min(pingTime / 2, 100)}%` : '0%' }}
                                className={`h-full rounded-full ${
                                  pingTime === null ? 'bg-white/20' :
                                  pingTime < 50 ? 'bg-emerald-400' :
                                  pingTime < 100 ? 'bg-amber-400' : 'bg-rose-400'
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Debug Info */}
                        <div>
                          <h3 className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-4">
                            Информация для отладки
                          </h3>
                          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 font-mono text-xs space-y-2">
                            <div className="flex justify-between">
                              <span className="text-white/40">User ID</span>
                              <span className="text-white/60">{user?.id || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/40">Session</span>
                              <span className="text-white/60">{isReady ? 'Active' : 'Inactive'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/40">Call ID</span>
                              <span className="text-white/60">{myCall?.id || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/40">Voice State</span>
                              <span className="text-white/60">{voiceClient ? 'Connected' : '—'}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
