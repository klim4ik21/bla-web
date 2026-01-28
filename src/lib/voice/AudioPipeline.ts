/**
 * Audio Pipeline
 *
 * Combines RNNoise (noise suppression) + Opus (compression) with proper buffering
 *
 * Flow:
 * 1. Input: Float32Array from ScriptProcessor (1024 samples)
 * 2. Buffer and process through RNNoise (480 samples per frame)
 * 3. Convert to Int16 and buffer for Opus (960 samples per frame)
 * 4. Output: Opus encoded packets (~100 bytes each)
 */

import { RNNoiseProcessor } from './RNNoiseProcessor'
import { OpusEncoder } from './OpusCodec'

export class AudioPipeline {
  private rnnoise: RNNoiseProcessor | null = null
  private opusEncoder: OpusEncoder | null = null
  private noiseSuppressionEnabled: boolean
  private initialized = false

  private processCount = 0

  constructor(noiseSuppressionEnabled: boolean = true) {
    this.noiseSuppressionEnabled = noiseSuppressionEnabled
  }

  async init(): Promise<void> {
    if (this.initialized) return

    // Initialize RNNoise if enabled
    if (this.noiseSuppressionEnabled) {
      try {
        this.rnnoise = new RNNoiseProcessor()
        await this.rnnoise.init()
        console.log('AudioPipeline: RNNoise enabled')
      } catch (err) {
        console.warn('AudioPipeline: RNNoise not available:', err)
        this.rnnoise = null
      }
    }

    // Initialize Opus encoder
    this.opusEncoder = new OpusEncoder()
    await this.opusEncoder.init()

    this.initialized = true
    console.log('AudioPipeline initialized')
  }

  /**
   * Process audio through the pipeline
   * Input: Float32Array from microphone (values -1 to 1)
   * Output: Array of Opus encoded packets
   */
  process(input: Float32Array): Uint8Array[] {
    if (!this.initialized || !this.opusEncoder) {
      return []
    }

    let audioData: Float32Array = input

    // Step 1: Apply RNNoise if available
    if (this.rnnoise && this.noiseSuppressionEnabled) {
      try {
        const denoised = this.rnnoise.process(new Float32Array(input))
        if (denoised.length > 0) {
          audioData = denoised
        } else {
          // RNNoise is still buffering
          return []
        }
      } catch (err) {
        console.error('AudioPipeline: RNNoise error:', err)
        audioData = input
      }
    }

    // Step 2: Convert Float32 to Int16
    const int16Data = new Int16Array(audioData.length)
    for (let i = 0; i < audioData.length; i++) {
      int16Data[i] = Math.max(-32768, Math.min(32767, Math.floor(audioData[i] * 32767)))
    }

    // Step 3: Encode with Opus
    const packets = this.opusEncoder.encode(int16Data)

    this.processCount++
    if (this.processCount <= 5 || this.processCount % 100 === 0) {
      console.log(
        'AudioPipeline: in', input.length,
        'denoised', audioData.length,
        'packets', packets.length,
        packets.length > 0 ? 'size ' + packets[0].length : ''
      )
    }

    return packets
  }

  /**
   * Flush any remaining buffered audio
   */
  flush(): Uint8Array[] {
    const packets: Uint8Array[] = []

    // Flush RNNoise
    if (this.rnnoise) {
      const flushed = this.rnnoise.flush()
      if (flushed.length > 0) {
        // Convert and encode
        const int16Data = new Int16Array(flushed.length)
        for (let i = 0; i < flushed.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, Math.floor(flushed[i] * 32767)))
        }
        if (this.opusEncoder) {
          const encoded = this.opusEncoder.encode(int16Data)
          packets.push(...encoded)
        }
      }
    }

    // Flush Opus encoder
    if (this.opusEncoder) {
      const flushedOpus = this.opusEncoder.flush()
      packets.push(...flushedOpus)
    }

    return packets
  }

  /**
   * Check if noise suppression is active
   */
  get isNoiseSuppressionActive(): boolean {
    return this.noiseSuppressionEnabled && this.rnnoise !== null
  }

  /**
   * Enable/disable noise suppression at runtime
   */
  setNoiseSuppression(enabled: boolean): void {
    this.noiseSuppressionEnabled = enabled
  }

  destroy(): void {
    if (this.rnnoise) {
      this.rnnoise.destroy()
      this.rnnoise = null
    }
    if (this.opusEncoder) {
      this.opusEncoder.destroy()
      this.opusEncoder = null
    }
    this.initialized = false
  }
}
