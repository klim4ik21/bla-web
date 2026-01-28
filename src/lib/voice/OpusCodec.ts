/**
 * Opus Codec using WebCodecs API
 *
 * Uses native browser AudioEncoder/AudioDecoder for Opus encoding/decoding.
 * This provides hardware acceleration and optimal performance.
 *
 * Parameters optimized for VoIP:
 * - Sample rate: 48000 Hz
 * - Channels: 1 (mono)
 * - Frame size: 960 samples (20ms)
 * - Bitrate: 48000 bps
 * - Application: VOIP
 *
 * Browser support: Chrome 94+, Edge 94+, Firefox 130+, Safari 16.4+
 */

// Opus frame size: 960 samples = 20ms at 48kHz
export const OPUS_FRAME_SIZE = 960
export const OPUS_SAMPLE_RATE = 48000
export const OPUS_CHANNELS = 1
export const OPUS_BITRATE = 48000

/**
 * Check if WebCodecs API is available
 */
export function isWebCodecsSupported(): boolean {
  return typeof AudioEncoder !== 'undefined' && typeof AudioDecoder !== 'undefined'
}

export class OpusEncoder {
  private encoder: AudioEncoder | null = null
  private pendingPackets: Uint8Array[] = []
  private inputBuffer: Float32Array = new Float32Array(0)
  private timestamp = 0
  private initialized = false
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._init()
    return this.initPromise
  }

  private async _init(): Promise<void> {
    if (!isWebCodecsSupported()) {
      throw new Error('WebCodecs API is not supported in this browser')
    }

    // Check Opus support
    const support = await AudioEncoder.isConfigSupported({
      codec: 'opus',
      sampleRate: OPUS_SAMPLE_RATE,
      numberOfChannels: OPUS_CHANNELS,
      bitrate: OPUS_BITRATE,
    })

    if (!support.supported) {
      throw new Error('Opus encoding is not supported')
    }

    this.encoder = new AudioEncoder({
      output: (chunk) => {
        // Convert EncodedAudioChunk to Uint8Array
        const data = new Uint8Array(chunk.byteLength)
        chunk.copyTo(data)
        this.pendingPackets.push(data)
      },
      error: (e) => {
        console.error('OpusEncoder error:', e)
      },
    })

    this.encoder.configure({
      codec: 'opus',
      sampleRate: OPUS_SAMPLE_RATE,
      numberOfChannels: OPUS_CHANNELS,
      bitrate: OPUS_BITRATE,
    })

    this.initialized = true
    console.log('OpusEncoder initialized (WebCodecs): bitrate', OPUS_BITRATE, 'frame', OPUS_FRAME_SIZE)
  }

  /**
   * Encode PCM samples to Opus packets
   * Input: Int16Array of PCM samples
   * Returns array of encoded Opus packets
   */
  encode(samples: Int16Array): Uint8Array[] {
    if (!this.encoder || !this.initialized) {
      throw new Error('OpusEncoder not initialized')
    }

    // Convert Int16 to Float32 (WebCodecs expects Float32)
    const float32 = new Float32Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      float32[i] = samples[i] / 32768
    }

    // Accumulate samples
    const newBuffer = new Float32Array(this.inputBuffer.length + float32.length)
    newBuffer.set(this.inputBuffer)
    newBuffer.set(float32, this.inputBuffer.length)
    this.inputBuffer = newBuffer

    // Encode complete frames
    while (this.inputBuffer.length >= OPUS_FRAME_SIZE) {
      const frame = this.inputBuffer.slice(0, OPUS_FRAME_SIZE)
      this.inputBuffer = this.inputBuffer.slice(OPUS_FRAME_SIZE)

      // Create AudioData for this frame
      const audioData = new AudioData({
        format: 'f32',
        sampleRate: OPUS_SAMPLE_RATE,
        numberOfFrames: OPUS_FRAME_SIZE,
        numberOfChannels: OPUS_CHANNELS,
        timestamp: this.timestamp,
        data: frame,
      })

      this.encoder.encode(audioData)
      audioData.close()

      // Advance timestamp (in microseconds)
      this.timestamp += (OPUS_FRAME_SIZE / OPUS_SAMPLE_RATE) * 1_000_000
    }

    // Return accumulated packets
    const packets = this.pendingPackets
    this.pendingPackets = []
    return packets
  }

  /**
   * Flush remaining buffered samples
   */
  flush(): Uint8Array[] {
    if (!this.encoder || this.inputBuffer.length === 0) {
      return []
    }

    // Pad to frame size
    const padded = new Float32Array(OPUS_FRAME_SIZE)
    padded.set(this.inputBuffer)
    this.inputBuffer = new Float32Array(0)

    const audioData = new AudioData({
      format: 'f32',
      sampleRate: OPUS_SAMPLE_RATE,
      numberOfFrames: OPUS_FRAME_SIZE,
      numberOfChannels: OPUS_CHANNELS,
      timestamp: this.timestamp,
      data: padded,
    })

    this.encoder.encode(audioData)
    audioData.close()

    const packets = this.pendingPackets
    this.pendingPackets = []
    return packets
  }

  destroy(): void {
    if (this.encoder) {
      this.encoder.close()
      this.encoder = null
    }
    this.inputBuffer = new Float32Array(0)
    this.pendingPackets = []
    this.initialized = false
    this.initPromise = null
  }
}

export class OpusDecoder {
  private decoder: AudioDecoder | null = null
  private pendingFrames: Int16Array[] = []
  private initialized = false
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._init()
    return this.initPromise
  }

  private async _init(): Promise<void> {
    if (!isWebCodecsSupported()) {
      throw new Error('WebCodecs API is not supported in this browser')
    }

    // Check Opus support
    const support = await AudioDecoder.isConfigSupported({
      codec: 'opus',
      sampleRate: OPUS_SAMPLE_RATE,
      numberOfChannels: OPUS_CHANNELS,
    })

    if (!support.supported) {
      throw new Error('Opus decoding is not supported')
    }

    this.decoder = new AudioDecoder({
      output: (audioData) => {
        // Convert AudioData to Int16Array
        const float32 = new Float32Array(audioData.numberOfFrames * audioData.numberOfChannels)
        audioData.copyTo(float32, { planeIndex: 0 })

        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.floor(float32[i] * 32767)))
        }

        this.pendingFrames.push(int16)
        audioData.close()
      },
      error: (e) => {
        console.error('OpusDecoder error:', e)
      },
    })

    this.decoder.configure({
      codec: 'opus',
      sampleRate: OPUS_SAMPLE_RATE,
      numberOfChannels: OPUS_CHANNELS,
    })

    this.initialized = true
    console.log('OpusDecoder initialized (WebCodecs)')
  }

  /**
   * Decode Opus packet to PCM samples
   * Returns Int16Array of PCM samples
   */
  decode(packet: Uint8Array): Int16Array {
    if (!this.decoder || !this.initialized) {
      throw new Error('OpusDecoder not initialized')
    }

    // Create EncodedAudioChunk
    const chunk = new EncodedAudioChunk({
      type: 'key', // Opus frames are independent
      timestamp: 0, // We don't use timestamp for playback
      data: packet,
    })

    this.decoder.decode(chunk)

    // WebCodecs is async, but we need sync output for compatibility
    // Return the first pending frame or silence
    if (this.pendingFrames.length > 0) {
      return this.pendingFrames.shift()!
    }

    // Return silence if no frame ready yet
    return new Int16Array(OPUS_FRAME_SIZE * OPUS_CHANNELS)
  }

  /**
   * Generate silence for packet loss concealment
   */
  decodeMissing(): Int16Array {
    // WebCodecs doesn't have built-in PLC, return silence
    return new Int16Array(OPUS_FRAME_SIZE * OPUS_CHANNELS)
  }

  destroy(): void {
    if (this.decoder) {
      this.decoder.close()
      this.decoder = null
    }
    this.pendingFrames = []
    this.initialized = false
    this.initPromise = null
  }
}
