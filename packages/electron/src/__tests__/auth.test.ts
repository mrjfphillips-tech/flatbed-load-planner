import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'

// Mock electron shell so no browser opens during tests
vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() },
}))

import { parseAuth0Redirect, initiateAuth0Login } from '../auth'
import type { ElectronConfig } from '../config'

const mockConfig: ElectronConfig = {
  backendUrl: 'https://app.ptv-discovery-coach.com',
  auth0Domain: 'test.auth0.com',
  auth0ClientId: 'test-client-id',
  auth0RedirectUri: 'ptv-discovery-coach://auth/callback',
  environment: 'production',
}

describe('auth', () => {
  // Feature: electron-packaging, Property 2: Auth0 PKCE redirect handling
  it('parseAuth0Redirect extracts code and state from any valid callback URL', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 20, maxLength: 100 }).filter((s: string) => !s.includes('&') && !s.includes('=')),
        fc.string({ minLength: 16, maxLength: 64 }).filter((s: string) => !s.includes('&') && !s.includes('=')),
        (code: string, state: string) => {
          const url = `ptv-discovery-coach://auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
          const { extractedCode, extractedState } = parseAuth0Redirect(url)
          expect(extractedCode).toBe(code)
          expect(extractedState).toBe(state)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('parseAuth0Redirect throws when code is missing', () => {
    expect(() =>
      parseAuth0Redirect('ptv-discovery-coach://auth/callback?state=abc')
    ).toThrow('Missing authorization code')
  })

  it('parseAuth0Redirect throws when state is missing', () => {
    expect(() =>
      parseAuth0Redirect('ptv-discovery-coach://auth/callback?code=abc')
    ).toThrow('Missing state')
  })

  it('initiateAuth0Login returns a PKCESession with non-empty fields', () => {
    const session = initiateAuth0Login(mockConfig)
    expect(session.codeVerifier.length).toBeGreaterThan(0)
    expect(session.state.length).toBeGreaterThan(0)
    expect(session.nonce.length).toBeGreaterThan(0)
  })

  it('initiateAuth0Login generates unique sessions on each call', () => {
    const s1 = initiateAuth0Login(mockConfig)
    const s2 = initiateAuth0Login(mockConfig)
    expect(s1.state).not.toBe(s2.state)
    expect(s1.codeVerifier).not.toBe(s2.codeVerifier)
  })
})
