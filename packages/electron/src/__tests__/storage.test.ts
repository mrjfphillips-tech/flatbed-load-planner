import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// In-memory store for mocked safeStorage
let mockStore: Buffer | null = null
let encryptionAvailable = true

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/mock-userData' },
  safeStorage: {
    isEncryptionAvailable: () => encryptionAvailable,
    encryptString: (s: string) => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

vi.mock('fs', () => ({
  existsSync: (p: string) => mockStore !== null && p.includes('openai-key.enc'),
  writeFileSync: (_p: string, data: Buffer) => { mockStore = data },
  readFileSync: (_p: string) => mockStore!,
  unlinkSync: () => { mockStore = null },
}))

import { saveOpenAIKey, loadOpenAIKey, deleteOpenAIKey } from '../storage'

describe('storage', () => {
  beforeEach(() => {
    mockStore = null
    encryptionAvailable = true
  })

  // Feature: electron-packaging, Property 3: safeStorage round-trip
  it('saveOpenAIKey then loadOpenAIKey returns the original key for any non-empty string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (key: string) => {
          saveOpenAIKey(key)
          const loaded = loadOpenAIKey()
          expect(loaded).toBe(key)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('loadOpenAIKey returns null when no key is stored', () => {
    expect(loadOpenAIKey()).toBeNull()
  })

  it('deleteOpenAIKey removes the stored key', () => {
    saveOpenAIKey('sk-test-key')
    deleteOpenAIKey()
    expect(loadOpenAIKey()).toBeNull()
  })

  it('round-trip works with AES fallback when safeStorage unavailable', () => {
    encryptionAvailable = false
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (key: string) => {
          saveOpenAIKey(key)
          const loaded = loadOpenAIKey()
          expect(loaded).toBe(key)
        }
      ),
      { numRuns: 50 }
    )
  })
})
