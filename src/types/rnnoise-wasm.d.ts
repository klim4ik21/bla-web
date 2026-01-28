declare module '@jitsi/rnnoise-wasm' {
  export function createRNNWasmModule(): Promise<RNNoiseModule>
  export function createRNNWasmModuleSync(): Promise<RNNoiseModule>

  interface RNNoiseModule {
    _rnnoise_create: () => number
    _rnnoise_destroy: (state: number) => void
    _rnnoise_process_frame: (state: number, inputPtr: number, outputPtr: number) => number
    _malloc: (size: number) => number
    _free: (ptr: number) => void
    HEAPF32: Float32Array
  }
}
