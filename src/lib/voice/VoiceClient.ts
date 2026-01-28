/**
 * Discord-like Voice Client
 *
 * Custom UDP voice protocol with WebSocket signaling
 * Encryption: XSalsa20-Poly1305
 *
 * Browser limitation: Uses WebSocket for media transport
 * (browsers cannot do raw UDP)
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Session persistence across reconnects
 * - State machine for connection states
 */

import nacl from 'tweetnacl'
import { AudioPipeline } from './AudioPipeline'
import { OPUS_FRAME_SIZE } from './OpusCodec'
import { JitterBuffer } from './JitterBuffer'

// Connection states
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
} as const

export type ConnectionState = typeof ConnectionState[keyof typeof ConnectionState]

// Opcodes (must match SFU server)
const Op = {
  // Client -> Server
  IDENTIFY: 0,
  SELECT_PROTOCOL: 1,
  HEARTBEAT: 3,
  SPEAKING: 5,
  VIDEO: 12,
  CLIENT_DISCONNECT: 13,

  // Server -> Client
  READY: 2,
  SESSION_DESC: 4,
  HEARTBEAT_ACK: 6,
  USER_JOIN: 7,
  USER_LEAVE: 8,
  USER_SPEAKING: 9,
  USER_VIDEO: 10,
  RESUMED: 11,
}

// Speaking flags
const SpeakingFlags = {
  MICROPHONE: 1 << 0,
  SOUNDSHARE: 1 << 1,
  PRIORITY: 1 << 2,
}

interface VoiceUser {
  userId: string
  ssrc: number
  speaking: number
  videoSSRC?: number
  audioElement?: HTMLAudioElement
}

interface VoiceClientOptions {
  wsUrl: string
  roomId: string
  userId: string
  token: string
  noiseSuppression?: boolean // Enable RNNoise (default: true)
  maxReconnectAttempts?: number // Max reconnect attempts (default: 5)
  onUserJoin?: (user: VoiceUser) => void
  onUserLeave?: (userId: string) => void
  onUserSpeaking?: (userId: string, speaking: boolean) => void
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onReconnecting?: (attempt: number, maxAttempts: number) => void
  onStateChange?: (state: ConnectionState) => void
}

interface ReadyData {
  ssrc: number
  ip: string
  port: number
  modes: string[]
  heartbeat_interval: number
}

interface SessionDescData {
  mode: string
  secret_key: string // base64 encoded
  audio_codec: string
  video_codec?: string
}

export class VoiceClient {
  private options: VoiceClientOptions
  private ws: WebSocket | null = null
  private localStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private playbackContext: AudioContext | null = null

  // Connection state
  private ssrc: number = 0
  private secretKey: Uint8Array | null = null
  private sessionId: string // Persists across reconnects
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED

  // Reconnect settings
  private readonly maxReconnectAttempts: number
  private reconnectAttempt: number = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalDisconnect: boolean = false

  // Heartbeat
  private heartbeatInterval: number = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastHeartbeatAck: number = 0
  private missedHeartbeats: number = 0

  // Users in room
  private users: Map<string, VoiceUser> = new Map()
  private ssrcToUser: Map<number, string> = new Map()

  // Audio processing
  private sequenceNumber: number = 0
  private timestamp: number = 0
  private processorNode: ScriptProcessorNode | null = null
  private audioPipeline: AudioPipeline | null = null

  // Jitter buffers for each remote user (by SSRC)
  private jitterBuffers: Map<number, JitterBuffer> = new Map()
  private playbackTimer: ReturnType<typeof setInterval> | null = null

  // State
  private speaking: boolean = false
  private noiseSuppressionEnabled: boolean = true

  // Track if we were speaking before disconnect (to resume)
  private wasSpeaking: boolean = false

  constructor(options: VoiceClientOptions) {
    this.options = options
    this.noiseSuppressionEnabled = options.noiseSuppression !== false
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5
    this.sessionId = crypto.randomUUID() // Generate once, reuse on reconnect
  }

  /**
   * Check if connected to voice server
   */
  get isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED
  }

  /**
   * Get current connection state
   */
  get state(): ConnectionState {
    return this.connectionState
  }

  /**
   * Check if currently reconnecting
   */
  get isReconnecting(): boolean {
    return this.connectionState === ConnectionState.RECONNECTING
  }

  /**
   * Check if noise suppression is enabled
   */
  get isNoiseSuppressionEnabled(): boolean {
    return this.noiseSuppressionEnabled && this.audioPipeline?.isNoiseSuppressionActive === true
  }

  /**
   * Enable/disable noise suppression
   */
  setNoiseSuppression(enabled: boolean): void {
    this.noiseSuppressionEnabled = enabled
    if (this.audioPipeline) {
      this.audioPipeline.setNoiseSuppression(enabled)
    }
    console.log('Noise suppression:', enabled ? 'enabled' : 'disabled')
  }

  /**
   * Connect to voice server
   */
  async connect(): Promise<void> {
    // Don't connect if already connecting/connected
    if (this.connectionState === ConnectionState.CONNECTING ||
        this.connectionState === ConnectionState.CONNECTED) {
      console.warn('VoiceClient: Already connecting or connected')
      return
    }

    this.intentionalDisconnect = false
    this.setState(ConnectionState.CONNECTING)

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.wsUrl)
        this.ws.binaryType = 'arraybuffer'

        this.ws.onopen = () => {
          console.log('VoiceClient: WebSocket opened, identifying...')
          this.identify()
        }

        this.ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            // Binary message = audio packet
            this.handleAudioPacket(new Uint8Array(event.data))
          } else {
            // JSON message = signaling
            this.handleMessage(JSON.parse(event.data))
          }
        }

        this.ws.onclose = (event) => {
          console.log('VoiceClient: WebSocket closed, code:', event.code, 'reason:', event.reason)
          this.handleDisconnect()
        }

        this.ws.onerror = (event) => {
          console.error('VoiceClient: WebSocket error', event)
          this.options.onError?.(new Error('WebSocket error'))
          if (this.connectionState === ConnectionState.CONNECTING) {
            this.setState(ConnectionState.DISCONNECTED)
            reject(new Error('WebSocket error'))
          }
        }

        // Track if resolved
        let resolved = false

        // Store original handler to use after setup
        const setupHandler = (event: MessageEvent) => {
          if (event.data instanceof ArrayBuffer) {
            this.handleAudioPacket(new Uint8Array(event.data))
            return
          }

          const msg = JSON.parse(event.data)
          this.handleMessage(msg)

          if (msg.op === Op.SESSION_DESC && !resolved) {
            resolved = true
            this.reconnectAttempt = 0 // Reset on successful connection
            resolve()
          }
        }

        this.ws.onmessage = setupHandler

        // Timeout
        setTimeout(() => {
          if (!resolved) {
            this.setState(ConnectionState.DISCONNECTED)
            reject(new Error('Connection timeout'))
          }
        }, 10000)

      } catch (error) {
        this.setState(ConnectionState.DISCONNECTED)
        reject(error)
      }
    })
  }

  /**
   * Disconnect from voice server (intentional disconnect, no reconnect)
   */
  disconnect(): void {
    console.log('VoiceClient: Intentional disconnect')
    this.intentionalDisconnect = true

    // Cancel any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.stopSpeaking()

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.ws) {
      this.send(Op.CLIENT_DISCONNECT, {})
      this.ws.close()
      this.ws = null
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    if (this.playbackTimer) {
      clearInterval(this.playbackTimer)
      this.playbackTimer = null
    }

    if (this.playbackContext) {
      this.playbackContext.close()
      this.playbackContext = null
    }

    // Clean up jitter buffers
    for (const jitterBuffer of this.jitterBuffers.values()) {
      jitterBuffer.destroy()
    }
    this.jitterBuffers.clear()

    this.nextPlayTime.clear()
    this.users.clear()
    this.ssrcToUser.clear()
    this.secretKey = null
    this.setState(ConnectionState.DISCONNECTED)
    this.options.onDisconnected?.()
  }

  /**
   * Start capturing and sending audio
   */
  async startSpeaking(): Promise<void> {
    if (this.speaking) return

    try {
      // Get microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      })

      // Create audio context for processing
      this.audioContext = new AudioContext({ sampleRate: 48000 })

      // Set up audio encoding pipeline
      await this.setupAudioPipeline()

      this.speaking = true
      this.sendSpeaking(SpeakingFlags.MICROPHONE)

    } catch (error) {
      this.options.onError?.(error as Error)
    }
  }

  /**
   * Stop sending audio
   */
  stopSpeaking(): void {
    if (!this.speaking) return

    this.speaking = false
    this.sendSpeaking(0)

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }

    if (this.audioPipeline) {
      this.audioPipeline.destroy()
      this.audioPipeline = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  /**
   * Mute/unmute
   */
  setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted
      })
    }
    this.sendSpeaking(muted ? 0 : SpeakingFlags.MICROPHONE)
  }

  /**
   * Get users in room
   */
  getUsers(): VoiceUser[] {
    return Array.from(this.users.values())
  }

  // --- Private methods ---

  /**
   * Update connection state and notify listeners
   */
  private setState(newState: ConnectionState): void {
    if (this.connectionState === newState) return
    const oldState = this.connectionState
    this.connectionState = newState
    console.log(`VoiceClient state: ${oldState} -> ${newState}`)
    this.options.onStateChange?.(newState)
  }

  private send(op: number, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op, d: data }))
    }
  }

  private identify(): void {
    // Use persistent sessionId for reconnect identification
    this.send(Op.IDENTIFY, {
      room_id: this.options.roomId,
      user_id: this.options.userId,
      session_id: this.sessionId,
      token: this.options.token,
    })
    console.log('VoiceClient: Sent IDENTIFY with session:', this.sessionId.slice(0, 8) + '...')
  }

  private handleMessage(msg: { op: number; d: unknown }): void {
    switch (msg.op) {
      case Op.READY:
        this.handleReady(msg.d as ReadyData)
        break

      case Op.SESSION_DESC:
        this.handleSessionDesc(msg.d as SessionDescData)
        break

      case Op.HEARTBEAT_ACK:
        this.lastHeartbeatAck = Date.now()
        this.missedHeartbeats = 0
        break

      case Op.USER_JOIN:
        this.handleUserJoin(msg.d as { user_id: string; ssrc: number })
        break

      case Op.USER_LEAVE:
        this.handleUserLeave(msg.d as { user_id: string })
        break

      case Op.USER_SPEAKING:
        this.handleUserSpeaking(msg.d as { user_id: string; ssrc: number; speaking: number })
        break
    }
  }

  private handleReady(data: ReadyData): void {
    this.ssrc = data.ssrc
    this.heartbeatInterval = data.heartbeat_interval

    // Start heartbeat
    this.startHeartbeat()

    console.log('Voice ready, SSRC:', this.ssrc, 'Server:', data.ip, data.port)

    // Send protocol selection
    // In browser, we can't do UDP directly, so we'll use a WebSocket-based approach
    // or rely on a WebRTC data channel for the actual media
    this.send(Op.SELECT_PROTOCOL, {
      protocol: 'udp',
      data: {
        address: '0.0.0.0', // Will be discovered
        port: 0,
        mode: 'xsalsa20_poly1305',
      },
    })
  }

  private handleSessionDesc(data: SessionDescData): void {
    // Decode base64 secret key
    const binaryString = atob(data.secret_key)
    this.secretKey = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      this.secretKey[i] = binaryString.charCodeAt(i)
    }

    // Initialize playback context if needed (might exist from before reconnect)
    if (!this.playbackContext || this.playbackContext.state === 'closed') {
      this.playbackContext = new AudioContext({ sampleRate: 48000 })
    }

    // Start playback timer (20ms intervals for Opus frames)
    this.startPlaybackTimer()

    this.setState(ConnectionState.CONNECTED)
    // Note: onConnected is called by reconnect() if this is a reconnection

    console.log('Voice connected with codec:', data.audio_codec, 'key length:', this.secretKey.length)
  }

  private handleUserJoin(data: { user_id: string; ssrc: number }): void {
    const user: VoiceUser = {
      userId: data.user_id,
      ssrc: data.ssrc,
      speaking: 0,
    }
    this.users.set(data.user_id, user)
    this.ssrcToUser.set(data.ssrc, data.user_id)
    this.options.onUserJoin?.(user)
  }

  private handleUserLeave(data: { user_id: string }): void {
    const user = this.users.get(data.user_id)
    if (user) {
      this.ssrcToUser.delete(user.ssrc)
      this.users.delete(data.user_id)

      // Clean up jitter buffer for this user
      const jitterBuffer = this.jitterBuffers.get(user.ssrc)
      if (jitterBuffer) {
        jitterBuffer.destroy()
        this.jitterBuffers.delete(user.ssrc)
      }

      // Clean up playback timing
      this.nextPlayTime.delete(user.ssrc)
    }
    this.options.onUserLeave?.(data.user_id)
  }

  private handleUserSpeaking(data: { user_id: string; ssrc: number; speaking: number }): void {
    const user = this.users.get(data.user_id)
    if (user) {
      user.speaking = data.speaking
    }
    this.options.onUserSpeaking?.(data.user_id, data.speaking !== 0)
  }

  /**
   * Handle unexpected disconnect - attempt reconnect
   */
  private handleDisconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // If intentional disconnect, don't try to reconnect
    if (this.intentionalDisconnect) {
      console.log('VoiceClient: Intentional disconnect, not reconnecting')
      return
    }

    // If already reconnecting, don't start another attempt
    if (this.connectionState === ConnectionState.RECONNECTING) {
      return
    }

    // Save speaking state to resume after reconnect
    this.wasSpeaking = this.speaking

    // Stop sending audio during reconnect but keep stream alive
    if (this.speaking) {
      this.speaking = false
    }

    // Clear WebSocket reference
    this.ws = null

    // Check if we should reconnect
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      console.log('VoiceClient: Max reconnect attempts reached, giving up')
      this.setState(ConnectionState.DISCONNECTED)
      this.cleanupResources()
      this.options.onDisconnected?.()
      return
    }

    // Start reconnection
    this.setState(ConnectionState.RECONNECTING)
    this.reconnect()
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private async reconnect(): Promise<void> {
    this.reconnectAttempt++

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), 16000)

    console.log(`VoiceClient: Reconnect attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts} in ${delay}ms`)
    this.options.onReconnecting?.(this.reconnectAttempt, this.maxReconnectAttempts)

    // Wait before reconnecting
    await new Promise<void>((resolve) => {
      this.reconnectTimer = setTimeout(resolve, delay)
    })

    // Check if disconnect was called during wait
    if (this.intentionalDisconnect) {
      console.log('VoiceClient: Reconnect cancelled (intentional disconnect)')
      return
    }

    try {
      // Create new WebSocket connection
      this.ws = new WebSocket(this.options.wsUrl)
      this.ws.binaryType = 'arraybuffer'

      await new Promise<void>((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('WebSocket is null'))
          return
        }

        const timeout = setTimeout(() => {
          reject(new Error('Reconnect timeout'))
        }, 10000)

        this.ws.onopen = () => {
          console.log('VoiceClient: Reconnect WebSocket opened')
          this.identify()
        }

        this.ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            this.handleAudioPacket(new Uint8Array(event.data))
            return
          }

          const msg = JSON.parse(event.data)
          this.handleMessage(msg)

          if (msg.op === Op.SESSION_DESC) {
            clearTimeout(timeout)
            resolve()
          }
        }

        this.ws.onclose = () => {
          clearTimeout(timeout)
          reject(new Error('WebSocket closed during reconnect'))
        }

        this.ws.onerror = () => {
          clearTimeout(timeout)
          reject(new Error('WebSocket error during reconnect'))
        }
      })

      // Successfully reconnected
      console.log('VoiceClient: Reconnected successfully')
      this.reconnectAttempt = 0
      this.missedHeartbeats = 0

      // Resume speaking if we were before
      if (this.wasSpeaking) {
        console.log('VoiceClient: Resuming speaking after reconnect')
        this.speaking = true
        this.sendSpeaking(SpeakingFlags.MICROPHONE)
      }

      this.options.onConnected?.()

    } catch (error) {
      console.error('VoiceClient: Reconnect failed:', error)

      // Try again or give up
      if (this.reconnectAttempt < this.maxReconnectAttempts && !this.intentionalDisconnect) {
        this.reconnect()
      } else {
        console.log('VoiceClient: Giving up reconnection')
        this.setState(ConnectionState.DISCONNECTED)
        this.cleanupResources()
        this.options.onDisconnected?.()
      }
    }
  }

  /**
   * Clean up all resources (called on final disconnect)
   */
  private cleanupResources(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }

    if (this.audioPipeline) {
      this.audioPipeline.destroy()
      this.audioPipeline = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.playbackTimer) {
      clearInterval(this.playbackTimer)
      this.playbackTimer = null
    }

    if (this.playbackContext) {
      this.playbackContext.close()
      this.playbackContext = null
    }

    for (const jitterBuffer of this.jitterBuffers.values()) {
      jitterBuffer.destroy()
    }
    this.jitterBuffers.clear()
    this.nextPlayTime.clear()
    this.users.clear()
    this.ssrcToUser.clear()
    this.secretKey = null
  }

  private startHeartbeat(): void {
    this.lastHeartbeatAck = Date.now()
    this.missedHeartbeats = 0

    // Clear existing timer if any
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    this.heartbeatTimer = setInterval(() => {
      this.send(Op.HEARTBEAT, { nonce: Date.now() })

      // Check for missed heartbeats (allow 2 missed before considering dead)
      const timeSinceAck = Date.now() - this.lastHeartbeatAck
      if (timeSinceAck > this.heartbeatInterval * 1.5) {
        this.missedHeartbeats++
        console.warn(`VoiceClient: Missed heartbeat #${this.missedHeartbeats}, last ack ${timeSinceAck}ms ago`)

        if (this.missedHeartbeats >= 2) {
          console.warn('VoiceClient: Heartbeat timeout, triggering reconnect...')
          this.ws?.close() // This will trigger handleDisconnect -> reconnect
        }
      }
    }, this.heartbeatInterval)
  }

  private sendSpeaking(flags: number): void {
    this.send(Op.SPEAKING, {
      speaking: flags,
      delay: 0,
      ssrc: this.ssrc,
    })
  }

  private async setupAudioPipeline(): Promise<void> {
    if (!this.localStream || !this.audioContext) return

    // Initialize AudioPipeline (RNNoise + Opus)
    this.audioPipeline = new AudioPipeline(this.noiseSuppressionEnabled)
    await this.audioPipeline.init()
    console.log('Audio pipeline initialized')

    const source = this.audioContext.createMediaStreamSource(this.localStream)

    // Create a processor node to get raw audio data
    // Must be power of 2: 1024 samples ≈ 21ms at 48kHz
    this.processorNode = this.audioContext.createScriptProcessor(1024, 1, 1)

    let packetCount = 0
    this.processorNode.onaudioprocess = (event) => {
      if (!this.speaking || !this.secretKey || !this.audioPipeline) return

      const inputData = event.inputBuffer.getChannelData(0)

      // Process through AudioPipeline (RNNoise + Opus encoding)
      const opusPackets = this.audioPipeline.process(inputData)

      // Send each Opus packet
      for (const packet of opusPackets) {
        this.sendAudioPacket(packet)
        packetCount++

        if (packetCount % 100 === 0) {
          console.log('Sent Opus packets:', packetCount, 'size:', packet.length, 'bytes')
        }
      }
    }

    source.connect(this.processorNode)
    // Connect to a silent destination to keep the processor running
    this.processorNode.connect(this.audioContext.destination)
  }

  private sendAudioPacket(opusData: Uint8Array): void {
    if (!this.secretKey) return

    // Create RTP header
    const header = new Uint8Array(12)
    const view = new DataView(header.buffer)

    header[0] = 0x80 // Version 2
    header[1] = 0x78 // Payload type 120 (Opus)
    view.setUint16(2, this.sequenceNumber, false)
    view.setUint32(4, this.timestamp, false)
    view.setUint32(8, this.ssrc, false)

    // Wrap sequence number at 16-bit boundary
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xFFFF
    // Opus frame is 960 samples (20ms at 48kHz), wrap at 32-bit
    this.timestamp = (this.timestamp + OPUS_FRAME_SIZE) >>> 0

    // Create nonce from header (padded to 24 bytes)
    const nonce = new Uint8Array(24)
    nonce.set(header)

    // Encrypt Opus packet
    const encrypted = nacl.secretbox(opusData, nonce, this.secretKey)

    // Combine: header + encrypted
    const packet = new Uint8Array(header.length + encrypted.length)
    packet.set(header)
    packet.set(encrypted, header.length)

    // Send via WebSocket
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(packet)
    }
  }

  private receivedPackets = 0

  /**
   * Handle incoming audio packet (binary WebSocket message)
   */
  private async handleAudioPacket(data: Uint8Array): Promise<void> {
    if (data.length < 12) return // Minimum RTP header size

    // Parse RTP header
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const sequence = view.getUint16(2, false)
    const timestamp = view.getUint32(4, false)
    const ssrc = view.getUint32(8, false)

    // Find user by SSRC
    const userId = this.ssrcToUser.get(ssrc)

    this.receivedPackets++
    if (this.receivedPackets % 50 === 1) {
      console.log('Received Opus packet, SSRC:', ssrc, 'seq:', sequence, 'size:', data.length, 'total:', this.receivedPackets)
    }

    if (!userId || userId === this.options.userId) return // Ignore own packets

    // Create nonce from header (first 12 bytes, padded to 24)
    const nonce = new Uint8Array(24)
    nonce.set(data.slice(0, 12))

    // Decrypt payload (Opus data)
    const encryptedPayload = data.slice(12)
    const opusData = this.decrypt(encryptedPayload, nonce)

    if (!opusData) {
      console.warn('Failed to decrypt audio packet from SSRC:', ssrc)
      return
    }

    // Get or create jitter buffer for this SSRC
    let jitterBuffer = this.jitterBuffers.get(ssrc)
    if (!jitterBuffer) {
      jitterBuffer = new JitterBuffer()
      await jitterBuffer.init()
      this.jitterBuffers.set(ssrc, jitterBuffer)
      console.log('Created JitterBuffer for SSRC:', ssrc)
    }

    // Add packet to jitter buffer
    jitterBuffer.push(sequence, timestamp, opusData)
  }

  /**
   * Start the playback timer that pulls from jitter buffers
   */
  private startPlaybackTimer(): void {
    if (this.playbackTimer) return

    // 20ms interval matches Opus frame duration
    this.playbackTimer = setInterval(() => {
      this.processPlayback()
    }, 20)
  }

  /**
   * Process all jitter buffers and play audio
   */
  private processPlayback(): void {
    for (const [ssrc, jitterBuffer] of this.jitterBuffers) {
      const pcmData = jitterBuffer.pop()
      if (pcmData && pcmData.length > 0) {
        this.playAudio(ssrc, pcmData)
      }
    }
  }

  private nextPlayTime: Map<number, number> = new Map()

  private playCount = 0

  /**
   * Play decoded audio data (Int16 PCM from Opus decoder)
   */
  private playAudio(ssrc: number, pcmData: Int16Array): void {
    if (!this.playbackContext) return

    // Resume context if suspended (browser autoplay policy)
    if (this.playbackContext.state === 'suspended') {
      this.playbackContext.resume()
    }

    // Convert Int16 PCM to Float32
    const float32 = new Float32Array(pcmData.length)

    for (let i = 0; i < pcmData.length; i++) {
      float32[i] = pcmData[i] / 32768
    }

    this.playCount++
    if (this.playCount <= 5 || this.playCount % 100 === 0) {
      // Check if there's actual audio content
      let maxVal = 0
      for (let i = 0; i < float32.length; i++) {
        maxVal = Math.max(maxVal, Math.abs(float32[i]))
      }
      console.log('playAudio: samples', float32.length, 'maxVal', maxVal.toFixed(4), 'total', this.playCount)
    }

    // Create audio buffer
    const audioBuffer = this.playbackContext.createBuffer(1, float32.length, 48000)
    audioBuffer.getChannelData(0).set(float32)

    // Schedule playback with proper timing
    const now = this.playbackContext.currentTime
    let startTime = this.nextPlayTime.get(ssrc) || now

    // If we're behind, catch up
    if (startTime < now) {
      startTime = now + 0.05 // 50ms buffer
    }

    const source = this.playbackContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.playbackContext.destination)
    source.start(startTime)

    // Schedule next packet
    this.nextPlayTime.set(ssrc, startTime + audioBuffer.duration)
  }

  /**
   * Decrypt data using XSalsa20-Poly1305
   */
  private decrypt(data: Uint8Array, nonce: Uint8Array): Uint8Array | null {
    if (!this.secretKey) throw new Error('No secret key')
    return nacl.secretbox.open(data, nonce, this.secretKey)
  }
}

export { SpeakingFlags }
