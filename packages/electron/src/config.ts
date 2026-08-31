import * as fs from 'fs'
import * as path from 'path'

export interface ElectronConfig {
  backendUrl: string
  auth0Domain: string
  auth0ClientId: string
  auth0RedirectUri: string
  environment: 'development' | 'staging' | 'production'
}

interface RuntimeConfig {
  backendUrl?: string
  environment?: string
  auth0Domain?: string
  auth0ClientId?: string
}

/**
 * Resolves config in priority order:
 * 1. userData/config.json (runtime override)
 * 2. resources/app.json (injected by electron-builder extraMetadata)
 * 3. Environment variables (development)
 * 4. Hardcoded production defaults
 */
export function resolveConfig(overrides?: Partial<RuntimeConfig>): ElectronConfig {
  const merged: RuntimeConfig = {}

  // Priority 3: env vars
  if (process.env['BACKEND_URL']) merged.backendUrl = process.env['BACKEND_URL']
  if (process.env['AUTH0_DOMAIN']) merged.auth0Domain = process.env['AUTH0_DOMAIN']
  if (process.env['AUTH0_CLIENT_ID']) merged.auth0ClientId = process.env['AUTH0_CLIENT_ID']
  if (process.env['NODE_ENV']) merged.environment = process.env['NODE_ENV']

  // Priority 2: resources/app.json (electron-builder extraMetadata)
  try {
    const appJsonPath = path.join(process.resourcesPath ?? '', 'app.json')
    if (fs.existsSync(appJsonPath)) {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8')) as RuntimeConfig
      Object.assign(merged, appJson)
    }
  } catch {
    // not available in dev
  }

  // Priority 1: userData/config.json (runtime override)
  try {
    // app module may not be available in tests
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron')
    const userConfigPath = path.join(app.getPath('userData'), 'config.json')
    if (fs.existsSync(userConfigPath)) {
      const userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf-8')) as RuntimeConfig
      Object.assign(merged, userConfig)
    }
  } catch {
    // electron not available in test environment
  }

  // Caller overrides (for testing)
  if (overrides) Object.assign(merged, overrides)

  const environment = (merged.environment as ElectronConfig['environment']) ?? 'production'

  return {
    backendUrl: merged.backendUrl ?? 'https://app.ptv-discovery-coach.com',
    auth0Domain: merged.auth0Domain ?? '',
    auth0ClientId: merged.auth0ClientId ?? '',
    auth0RedirectUri: 'ptv-discovery-coach://auth/callback',
    environment,
  }
}
