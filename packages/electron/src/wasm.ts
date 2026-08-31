import * as path from 'path'

export interface WasmPaths {
  whisperWasm: string
  whisperModel: string
  tesseractWasm: string
  tesseractLang: string
}

/**
 * Resolves absolute paths to WASM resources bundled in extraResources.
 * - Production: <exe-dir>/resources/wasm/
 * - Development: <__dirname>/../../resources/wasm/
 *
 * @param basePath Optional override for the wasm directory (used in tests)
 */
export function resolveWasmPaths(basePath?: string): WasmPaths {
  let wasmDir: string

  if (basePath) {
    wasmDir = basePath
  } else if (process.env['NODE_ENV'] === 'development') {
    wasmDir = path.join(__dirname, '..', '..', 'resources', 'wasm')
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { app } = require('electron') as typeof import('electron')
      wasmDir = path.join(path.dirname(app.getPath('exe')), 'resources', 'wasm')
    } catch {
      wasmDir = path.join(__dirname, '..', '..', 'resources', 'wasm')
    }
  }

  return {
    whisperWasm: path.join(wasmDir, 'whisper.wasm'),
    whisperModel: path.join(wasmDir, 'ggml-base.en.bin'),
    tesseractWasm: path.join(wasmDir, 'tesseract-core.wasm'),
    tesseractLang: path.join(wasmDir, 'eng.traineddata'),
  }
}
