import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import * as path from 'path'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/mock-userData' },
}))

import { resolveWasmPaths } from '../wasm'

describe('wasm', () => {
  // Feature: electron-packaging, Property 5: WASM resource path resolution
  it('resolveWasmPaths returns paths rooted at the provided basePath', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).map(s => path.join('/tmp/mock-install', s.replace(/[<>:"|?*]/g, '_'))),
        (basePath) => {
          const paths = resolveWasmPaths(basePath)
          expect(paths.whisperWasm).toBe(path.join(basePath, 'whisper.wasm'))
          expect(paths.whisperModel).toBe(path.join(basePath, 'ggml-base.en.bin'))
          expect(paths.tesseractWasm).toBe(path.join(basePath, 'tesseract-core.wasm'))
          expect(paths.tesseractLang).toBe(path.join(basePath, 'eng.traineddata'))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('all four WASM paths are returned', () => {
    const paths = resolveWasmPaths('/some/base')
    expect(Object.keys(paths)).toHaveLength(4)
    expect(paths.whisperWasm).toBeTruthy()
    expect(paths.whisperModel).toBeTruthy()
    expect(paths.tesseractWasm).toBeTruthy()
    expect(paths.tesseractLang).toBeTruthy()
  })
})
