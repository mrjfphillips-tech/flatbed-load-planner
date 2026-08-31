import * as crypto from 'crypto'
import { shell } from 'electron'
import type { ElectronConfig } from './config'

export interface PKCESession {
  codeVerifier: string
  state: string
  nonce: string
}

export interface TokenResponse {
  accessToken: string
  idToken: string
  refreshToken?: string
  expiresIn: number
}

export interface ParsedAuth0Redirect {
  extractedCode: string
  extractedState: string
}

/** Generates a cryptographically random base64url string of the given byte length. */
function randomBase64Url(bytes: number): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

/** Derives the PKCE code challenge (S256) from a code verifier. */
function codeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

/**
 * Initiates Auth0 PKCE flow by opening the system browser with the authorization URL.
 * Returns the PKCE session containing the code verifier and state for later validation.
 */
export function initiateAuth0Login(config: ElectronConfig): PKCESession {
  const codeVerifier = randomBase64Url(32)
  const state = randomBase64Url(16)
  const nonce = randomBase64Url(16)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.auth0ClientId,
    redirect_uri: config.auth0RedirectUri,
    scope: 'openid profile email offline_access',
    state,
    nonce,
    code_challenge: codeChallenge(codeVerifier),
    code_challenge_method: 'S256',
  })

  const authUrl = `https://${config.auth0Domain}/authorize?${params.toString()}`
  shell.openExternal(authUrl)

  return { codeVerifier, state, nonce }
}

/**
 * Parses the ptv-discovery-coach://auth/callback URL and extracts code and state.
 * Throws if the URL is malformed or missing required parameters.
 */
export function parseAuth0Redirect(url: string): ParsedAuth0Redirect {
  const parsed = new URL(url)
  const extractedCode = parsed.searchParams.get('code')
  const extractedState = parsed.searchParams.get('state')

  if (!extractedCode) throw new Error('Missing authorization code in redirect URL')
  if (!extractedState) throw new Error('Missing state in redirect URL')

  return { extractedCode, extractedState }
}

/**
 * Handles the Auth0 PKCE callback URL.
 * Validates state, exchanges the authorization code for tokens.
 */
export async function handleAuth0Redirect(
  url: string,
  session: PKCESession,
  config: ElectronConfig
): Promise<TokenResponse> {
  const { extractedCode, extractedState } = parseAuth0Redirect(url)

  if (extractedState !== session.state) {
    throw new Error('State mismatch — possible CSRF attack')
  }

  const tokenUrl = `https://${config.auth0Domain}/oauth/token`
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.auth0ClientId,
    code: extractedCode,
    redirect_uri: config.auth0RedirectUri,
    code_verifier: session.codeVerifier,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${text}`)
  }

  const data = await response.json() as {
    access_token: string
    id_token: string
    refresh_token?: string
    expires_in: number
  }

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}
