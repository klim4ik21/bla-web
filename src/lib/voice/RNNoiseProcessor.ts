/**
 * RNNoise Noise Suppression Processor
 *
 * Uses @jitsi/rnnoise-wasm for real-time noise suppression
 */

// RNNoise works with 480 samples (10ms at 48kHz)
const RNNOISE_FRAME_SIZE = 480

interface RNNoiseModule {
  _rnnoise_create: () => number
  _rnnoise_destroy: (state: number) => void
  _rnnoise_process_frame: (state: number, inputPtr: number, outputPtr: number) => number
  _malloc: (size: number) => number
  _free: (ptr: number) => void
  HEAPF32: Float32Array
}

export class RNNoiseProcessor {
  private module: RNNoiseModule | null = null
  private state: number = 0
  private inputPtr: number = 0
  private outputPtr: number = 0
  private initialized: boolean = false

  // Buffer for accumulating samples (ScriptProcessor gives us 1024, RNNoise needs 480)
  private inputBuffer: Float32Array = new Float32Array(0)

  async init(): Promise<void> {
    if (this.initialized) return

    try {
      // Dynamic import to avoid issues with WASM loading
      const { createRNNWasmModuleSync } = await import('@jitsi/rnnoise-wasm')

      this.module = await createRNNWasmModuleSync() as RNNoiseModule

      // Create RNNoise state
      this.state = this.module._rnnoise_create()

      // Allocate memory for input/output buffers (480 floats = 1920 bytes)
      this.inputPtr = this.module._malloc(RNNOISE_FRAME_SIZE * 4)
      this.outputPtr = this.module._malloc(RNNOISE_FRAME_SIZE * 4)

      this.initialized = true
      console.log('RNNoise initialized')
    } catch (err) {
      console.error('Failed to initialize RNNoise:', err)
      throw err
    }
  }

  private processCount = 0

  /**
   * Process audio samples through RNNoise
   * Input: Float32Array with values -1 to 1
   * Output: Denoised Float32Array
   */
  process(input: Float32Array): Float32Array {
    if (!this.initialized || !this.module) {
      console.warn('RNNoise not initialized, passing through')
      return input // Pass through if not initialized
    }

    // Accumulate input
    const newBuffer = new Float32Array(this.inputBuffer.length + input.length)
    newBuffer.set(this.inputBuffer)
    newBuffer.set(input, this.inputBuffer.length)
    this.inputBuffer = newBuffer

    // Process complete frames
    const outputChunks: Float32Array[] = []

    while (this.inputBuffer.length >= RNNOISE_FRAME_SIZE) {
      // Get frame
      const frame = this.inputBuffer.slice(0, RNNOISE_FRAME_SIZE)
      this.inputBuffer = this.inputBuffer.slice(RNNOISE_FRAME_SIZE)

      // Process frame
      const processed = this.processFrame(frame)
      outputChunks.push(processed)
    }

    this.processCount++
    if (this.processCount <= 3) {
      console.log('RNNoiseProcessor: input', input.length, 'buffered', this.inputBuffer.length, 'chunks', outputChunks.length)
    }

    // Combine processed output with any previously buffered output
    if (outputChunks.length === 0) {
      return new Float32Array(0)
    }

    const totalLength = outputChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of outputChunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  }

  private frameCount = 0

  /**
   * Process a single 480-sample frame
   */
  private processFrame(frame: Float32Array): Float32Array {
    if (!this.module) return frame

    // RNNoise expects values in range [-32768, 32767]
    const inputHeap = this.module.HEAPF32.subarray(
      this.inputPtr / 4,
      this.inputPtr / 4 + RNNOISE_FRAME_SIZE
    )

    for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
      inputHeap[i] = frame[i] * 32768
    }

    this.frameCount++
    if (this.frameCount <= 3) {
      // Debug: check input values
      let inMax = 0
      for (let i = 0; i < 10; i++) {
        inMax = Math.max(inMax, Math.abs(inputHeap[i]))
      }
      console.log('processFrame: inputHeap[0..9] max:', inMax, 'state:', this.state, 'inPtr:', this.inputPtr, 'outPtr:', this.outputPtr)
    }

    // Process - rnnoise_process_frame(state, output, input)
    const vadProb = this.module._rnnoise_process_frame(this.state, this.outputPtr, this.inputPtr)

    // Read output and convert back to [-1, 1]
    const outputHeap = this.module.HEAPF32.subarray(
      this.outputPtr / 4,
      this.outputPtr / 4 + RNNOISE_FRAME_SIZE
    )

    if (this.frameCount <= 3) {
      // Debug: check output values
      let outMax = 0
      for (let i = 0; i < 10; i++) {
        outMax = Math.max(outMax, Math.abs(outputHeap[i]))
      }
      console.log('processFrame: outputHeap[0..9] max:', outMax, 'vadProb:', vadProb)
    }

    const output = new Float32Array(RNNOISE_FRAME_SIZE)
    for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
      output[i] = outputHeap[i] / 32768
    }

    return output
  }

  /**
   * Flush any remaining buffered samples
   */
  flush(): Float32Array {
    if (this.inputBuffer.length === 0) {
      return new Float32Array(0)
    }

    // Pad remaining samples to frame size
    if (this.inputBuffer.length < RNNOISE_FRAME_SIZE) {
      const padded = new Float32Array(RNNOISE_FRAME_SIZE)
      padded.set(this.inputBuffer)
      this.inputBuffer = padded
    }

    const result = this.processFrame(this.inputBuffer.slice(0, RNNOISE_FRAME_SIZE))
    this.inputBuffer = new Float32Array(0)
    return result
  }

  destroy(): void {
    if (this.module && this.initialized) {
      if (this.state) {
        this.module._rnnoise_destroy(this.state)
      }
      if (this.inputPtr) {
        this.module._free(this.inputPtr)
      }
      if (this.outputPtr) {
        this.module._free(this.outputPtr)
      }
    }
    this.initialized = false
    this.module = null
    this.state = 0
    this.inputPtr = 0
    this.outputPtr = 0
    this.inputBuffer = new Float32Array(0)
  }
}
