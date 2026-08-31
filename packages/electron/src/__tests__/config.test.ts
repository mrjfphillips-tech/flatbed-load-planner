import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// Mock electron before importing config
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/mock-userData' },
}))

// Mock fs so no real file reads happen
vi.mock('fs', () => ({
  existsSync: () => false,
  readFileSync: () => '{}',
}))

import { resolveConfig } from '../config'

describe('config', () => {
  beforeEach(() => {
    delete process.env['BACKEND_URL']
    delete process.env['AUTH0_DOMAIN']
    delete process.env['AUTH0_CLIENT_ID']
    delete process.env['NODE_ENV']
  })

  // Feature: electron-packaging, Property 1: BACKEND_URL resolution
  it('resolveConfig returns correct backendUrl for any valid environment config', () => {
    fc.assert(
      fc.property(
        fc.record({
          environment: fc.constantFrom('development', 'staging', 'production') as fc.Arbitrary<'development' | 'staging' | 'production'>,
          backendUrl: fc.webUrl(),
        }),
        (overrides: { environment: 'development' | 'staging' | 'production'; backendUrl: string }) => {
          const result = resolveConfig(overrides)
          expect(result.backendUrl).toBe(overrides.backendUrl)
          expect(result.backendUrl).toMatch(/^https?:\/\//)
          expect(result.environment).toBe(overrides.environment)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('always sets auth0RedirectUri to the custom protocol callback', () => {
    const result = resolveConfig({ backendUrl: 'https://example.com', environment: 'production' })
    expect(result.auth0RedirectUri).toBe('ptv-discovery-coach://auth/callback')
  })

  it('falls back to production defaults when no overrides provided', () => {
    const result = resolveConfig()
    expect(result.backendUrl).toBe('https://app.ptv-discovery-coach.com')
    expect(result.environment).toBe('production')
  })
})
