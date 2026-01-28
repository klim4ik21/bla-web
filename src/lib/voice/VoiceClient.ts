/**
 * Discord-like Voice Client
 *
 * Custom UDP voice protocol with WebSocket signaling
 * Encryption: XSalsa20-Poly1305
 *
 * Browser limitation: Uses WebSocket for media transport
 * (browsers cannot do raw UDP)
 */

import nacl from 'tweetnacl'
import { RNNoiseProcessor } from './RNNoiseProcessor'

// Opcodes
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
  onUserJoin?: (user: VoiceUser) => void
  onUserLeave?: (userId: string) => void
  onUserSpeaking?: (userId: string, speaking: boolean) => void
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
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

  // Heartbeat
  private heartbeatInterval: number = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastHeartbeatAck: number = 0

  // Users in room
  private users: Map<string, VoiceUser> = new Map()
  private ssrcToUser: Map<number, string> = new Map()

  // Audio processing
  private sequenceNumber: number = 0
  private timestamp: number = 0
  private processorNode: ScriptProcessorNode | null = null
  private rnnoise: RNNoiseProcessor | null = null

  // State
  private _connected: boolean = false
  private speaking: boolean = false
  private noiseSuppressionEnabled: boolean = true

  constructor(options: VoiceClientOptions) {
    this.options = options
    this.noiseSuppressionEnabled = options.noiseSuppression !== false
  }

  /**
   * Check if connected to voice server
   */
  get isConnected(): boolean {
    return this._connected
  }

  /**
   * Check if noise suppression is enabled
   */
  get isNoiseSuppressionEnabled(): boolean {
    return this.noiseSuppressionEnabled && this.rnnoise !== null
  }

  /**
   * Enable/disable noise suppression
   */
  setNoiseSuppression(enabled: boolean): void {
    this.noiseSuppressionEnabled = enabled
    console.log('Noise suppression:', enabled ? 'enabled' : 'disabled')
  }

  /**
   * Connect to voice server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.wsUrl)
        this.ws.binaryType = 'arraybuffer'

        this.ws.onopen = () => {
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

        this.ws.onclose = () => {
          this.handleDisconnect()
        }

        this.ws.onerror = () => {
          this.options.onError?.(new Error('WebSocket error'))
          reject(new Error('WebSocket error'))
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
            resolve()
          }
        }

        this.ws.onmessage = setupHandler

        // Timeout
        setTimeout(() => {
          if (!resolved) {
            reject(new Error('Connection timeout'))
          }
        }, 10000)

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Disconnect from voice server
   */
  disconnect(): void {
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

    if (this.playbackContext) {
      this.playbackContext.close()
      this.playbackContext = null
    }

    this.nextPlayTime.clear()
    this.users.clear()
    this.ssrcToUser.clear()
    this.secretKey = null
    this._connected = false
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

    if (this.rnnoise) {
      this.rnnoise.destroy()
      this.rnnoise = null
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

  private send(op: number, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op, d: data }))
    }
  }

  private identify(): void {
    this.send(Op.IDENTIFY, {
      room_id: this.options.roomId,
      user_id: this.options.userId,
      session_id: crypto.randomUUID(),
      token: this.options.token,
    })
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

    // Initialize playback context
    this.playbackContext = new AudioContext({ sampleRate: 48000 })

    this._connected = true
    this.options.onConnected?.()

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

  private handleDisconnect(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    this._connected = false
    this.options.onDisconnected?.()
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send(Op.HEARTBEAT, { nonce: Date.now() })

      // Check for missed heartbeats
      if (this.lastHeartbeatAck > 0 && Date.now() - this.lastHeartbeatAck > this.heartbeatInterval * 2) {
        console.warn('Heartbeat timeout, reconnecting...')
        this.ws?.close()
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

    // Initialize RNNoise for noise suppression (if enabled)
    if (this.noiseSuppressionEnabled) {
      try {
        this.rnnoise = new RNNoiseProcessor()
        await this.rnnoise.init()
        console.log('RNNoise noise suppression enabled')
      } catch (err) {
        console.warn('RNNoise not available, continuing without noise suppression:', err)
        this.rnnoise = null
      }
    } else {
      console.log('Noise suppression disabled')
    }

    const source = this.audioContext.createMediaStreamSource(this.localStream)

    // Create a processor node to get raw audio data
    // Must be power of 2: 1024 samples ≈ 21ms at 48kHz
    this.processorNode = this.audioContext.createScriptProcessor(1024, 1, 1)

    let packetCount = 0
    let rnnoiseLogCount = 0
    this.processorNode.onaudioprocess = (event) => {
      if (!this.speaking || !this.secretKey) return

      const inputData = event.inputBuffer.getChannelData(0)

      let audioData: Float32Array | Float32Array = inputData

      // Apply RNNoise denoising if available and enabled
      if (this.rnnoise && this.noiseSuppressionEnabled) {
        try {
          // Measure input level
          let inputMax = 0
          for (let i = 0; i < inputData.length; i++) {
            inputMax = Math.max(inputMax, Math.abs(inputData[i]))
          }

          const denoised = this.rnnoise.process(new Float32Array(inputData))

          // Measure output level
          let outputMax = 0
          for (let i = 0; i < denoised.length; i++) {
            outputMax = Math.max(outputMax, Math.abs(denoised[i]))
          }

          rnnoiseLogCount++
          if (rnnoiseLogCount <= 10 || rnnoiseLogCount % 100 === 0) {
            console.log('RNNoise: in', inputData.length, 'out', denoised.length,
              'inMax', inputMax.toFixed(4), 'outMax', outputMax.toFixed(4))
          }

          if (denoised.length > 0) {
            audioData = denoised
          } else {
            // RNNoise is buffering, skip this frame
            return
          }
        } catch (err) {
          console.error('RNNoise processing error:', err)
          // Fall back to original audio
          audioData = inputData
        }
      }

      // Convert Float32 to Int16 and send
      const pcmData = new Int16Array(audioData.length)
      for (let i = 0; i < audioData.length; i++) {
        pcmData[i] = Math.max(-32768, Math.min(32767, Math.floor(audioData[i] * 32767)))
      }
      this.sendAudioPacket(pcmData)
      packetCount++

      if (packetCount % 100 === 0) {
        console.log('Sent audio packets:', packetCount, 'size:', pcmData.length)
      }
    }

    source.connect(this.processorNode)
    // Connect to a silent destination to keep the processor running
    this.processorNode.connect(this.audioContext.destination)
  }

  private sendAudioPacket(pcmData: Int16Array): void {
    // This is a simplified version
    // In production, you'd:
    // 1. Encode PCM to Opus
    // 2. Create RTP header
    // 3. Encrypt with XSalsa20-Poly1305
    // 4. Send via UDP (or WebSocket fallback)

    if (!this.secretKey) return

    // Create RTP header
    const header = new Uint8Array(12)
    const view = new DataView(header.buffer)

    header[0] = 0x80 // Version 2
    header[1] = 0x78 // Payload type 120 (Opus)
    view.setUint16(2, this.sequenceNumber++, false)
    view.setUint32(4, this.timestamp, false)
    view.setUint32(8, this.ssrc, false)

    this.timestamp += 1024 // ~21ms at 48kHz

    // For now, send through WebSocket as binary
    // In production, this should go through UDP
    const payload = new Uint8Array(pcmData.buffer)

    // Create nonce from header (padded to 24 bytes)
    const nonce = new Uint8Array(24)
    nonce.set(header)

    // Encrypt
    const encrypted = nacl.secretbox(payload, nonce, this.secretKey)

    // Combine: header + encrypted
    const packet = new Uint8Array(header.length + encrypted.length)
    packet.set(header)
    packet.set(encrypted, header.length)

    // Send (via WebSocket for now)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(packet)
    }
  }

  private receivedPackets = 0

  /**
   * Handle incoming audio packet (binary WebSocket message)
   */
  private handleAudioPacket(data: Uint8Array): void {
    if (data.length < 12) return // Minimum RTP header size

    // Parse RTP header
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const ssrc = view.getUint32(8, false)

    // Find user by SSRC
    const userId = this.ssrcToUser.get(ssrc)

    this.receivedPackets++
    if (this.receivedPackets % 50 === 1) {
      console.log('Received audio packet, SSRC:', ssrc, 'userId:', userId, 'size:', data.length, 'total:', this.receivedPackets)
    }

    if (!userId || userId === this.options.userId) return // Ignore own packets

    // Create nonce from header (first 12 bytes, padded to 24)
    const nonce = new Uint8Array(24)
    nonce.set(data.slice(0, 12))

    // Decrypt payload
    const encryptedPayload = data.slice(12)
    const decrypted = this.decrypt(encryptedPayload, nonce)

    if (!decrypted) {
      console.warn('Failed to decrypt audio packet from SSRC:', ssrc)
      return
    }

    // Play the audio
    this.playAudio(ssrc, decrypted)
  }

  private nextPlayTime: Map<number, number> = new Map()

  private playCount = 0

  /**
   * Play decrypted audio data
   */
  private playAudio(ssrc: number, pcmData: Uint8Array): void {
    if (!this.playbackContext) return

    // Resume context if suspended (browser autoplay policy)
    if (this.playbackContext.state === 'suspended') {
      this.playbackContext.resume()
    }

    // Convert Int16 PCM to Float32
    const int16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2)
    const float32 = new Float32Array(int16.length)

    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768
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
