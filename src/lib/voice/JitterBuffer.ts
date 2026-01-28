/**
 * Jitter Buffer for Voice
 *
 * Handles:
 * - Packet reordering (out-of-order packets)
 * - Packet loss concealment (PLC)
 * - Smooth playback timing
 *
 * Uses Opus decoder's built-in PLC when packets are lost.
 */

import { OpusDecoder, OPUS_FRAME_SIZE, OPUS_SAMPLE_RATE } from './OpusCodec'

// Frame duration in ms
const FRAME_DURATION_MS = (OPUS_FRAME_SIZE / OPUS_SAMPLE_RATE) * 1000 // 20ms

// Buffer configuration
const MIN_BUFFER_MS = 60   // Minimum buffer before playback starts
const MAX_BUFFER_MS = 200  // Maximum buffer size (drop old packets)
const MAX_MISSING_FRAMES = 5 // Max consecutive PLC frames before silence

interface BufferedPacket {
  sequence: number
  timestamp: number
  opusData: Uint8Array
  receivedAt: number
}

export class JitterBuffer {
  private decoder: OpusDecoder
  private buffer: Map<number, BufferedPacket> = new Map()
  private nextSequence: number = -1
  private lastPlayedSequence: number = -1
  private consecutivePLC: number = 0
  private initialized = false

  // Stats
  private stats = {
    received: 0,
    played: 0,
    lost: 0,
    reordered: 0,
    dropped: 0,
  }

  constructor() {
    this.decoder = new OpusDecoder()
  }

  async init(): Promise<void> {
    if (this.initialized) return
    await this.decoder.init()
    this.initialized = true
  }

  /**
   * Add a packet to the buffer
   */
  push(sequence: number, timestamp: number, opusData: Uint8Array): void {
    if (!this.initialized) return

    this.stats.received++

    // Initialize sequence tracking
    if (this.nextSequence === -1) {
      this.nextSequence = sequence
    }

    // Check for reordering
    if (sequence < this.nextSequence && this.lastPlayedSequence !== -1) {
      // Check if it's a late packet (within reasonable window)
      const sequenceDiff = this.sequenceDiff(sequence, this.lastPlayedSequence)
      if (sequenceDiff < 0) {
        // Too late, already played past this
        this.stats.dropped++
        return
      }
      this.stats.reordered++
    }

    // Check buffer size limit
    const maxPackets = Math.ceil(MAX_BUFFER_MS / FRAME_DURATION_MS)
    if (this.buffer.size >= maxPackets) {
      // Drop oldest packet
      let oldest: number | null = null
      let oldestTime = Infinity
      for (const [seq, pkt] of this.buffer) {
        if (pkt.receivedAt < oldestTime) {
          oldestTime = pkt.receivedAt
          oldest = seq
        }
      }
      if (oldest !== null) {
        this.buffer.delete(oldest)
        this.stats.dropped++
      }
    }

    // Add to buffer
    this.buffer.set(sequence, {
      sequence,
      timestamp,
      opusData,
      receivedAt: performance.now(),
    })
  }

  /**
   * Check if buffer has enough data to start playback
   */
  isReady(): boolean {
    if (!this.initialized || this.buffer.size === 0) return false

    const bufferedMs = this.buffer.size * FRAME_DURATION_MS
    return bufferedMs >= MIN_BUFFER_MS
  }

  /**
   * Get the next frame for playback
   * Returns decoded PCM or null if buffer is empty
   */
  pop(): Int16Array | null {
    if (!this.initialized) return null

    // Wait for minimum buffer on startup
    if (this.lastPlayedSequence === -1 && !this.isReady()) {
      return null
    }

    const packet = this.buffer.get(this.nextSequence)

    if (packet) {
      // Got the expected packet
      this.buffer.delete(this.nextSequence)
      this.lastPlayedSequence = this.nextSequence
      this.nextSequence = (this.nextSequence + 1) & 0xFFFF
      this.consecutivePLC = 0
      this.stats.played++

      try {
        return this.decoder.decode(packet.opusData)
      } catch (err) {
        console.error('JitterBuffer: decode error', err)
        return this.generateSilence()
      }
    } else {
      // Packet is missing
      this.stats.lost++
      this.consecutivePLC++

      // Check if we have a future packet (confirms loss vs. just late)
      const hasFuturePacket = this.hasFuturePackets()

      if (!hasFuturePacket && this.buffer.size === 0) {
        // Buffer empty, wait for more data
        return null
      }

      if (this.consecutivePLC > MAX_MISSING_FRAMES) {
        // Too many losses, output silence and try to resync
        this.lastPlayedSequence = this.nextSequence
        this.nextSequence = (this.nextSequence + 1) & 0xFFFF
        return this.generateSilence()
      }

      // Use Opus PLC
      this.lastPlayedSequence = this.nextSequence
      this.nextSequence = (this.nextSequence + 1) & 0xFFFF

      try {
        return this.decoder.decodeMissing()
      } catch {
        return this.generateSilence()
      }
    }
  }

  /**
   * Check if there are packets after the expected sequence
   */
  private hasFuturePackets(): boolean {
    for (const seq of this.buffer.keys()) {
      if (this.sequenceDiff(seq, this.nextSequence) > 0) {
        return true
      }
    }
    return false
  }

  /**
   * Calculate sequence number difference (handles wraparound)
   */
  private sequenceDiff(a: number, b: number): number {
    const diff = a - b
    if (diff > 32768) return diff - 65536
    if (diff < -32768) return diff + 65536
    return diff
  }

  /**
   * Generate silence frame
   */
  private generateSilence(): Int16Array {
    return new Int16Array(OPUS_FRAME_SIZE)
  }

  /**
   * Reset buffer state (e.g., after long pause)
   */
  reset(): void {
    this.buffer.clear()
    this.nextSequence = -1
    this.lastPlayedSequence = -1
    this.consecutivePLC = 0
  }

  /**
   * Get buffer statistics
   */
  getStats(): typeof this.stats & { bufferSize: number; bufferMs: number } {
    return {
      ...this.stats,
      bufferSize: this.buffer.size,
      bufferMs: this.buffer.size * FRAME_DURATION_MS,
    }
  }

  destroy(): void {
    this.decoder.destroy()
    this.buffer.clear()
    this.initialized = false
  }
}
