import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const KEY_FILE_NAME = 'openai-key.enc'
const ALGORITHM = 'aes-256-gcm'
const SALT = 'ptv-discovery-coach-v1'

function getKeyFilePath(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require('electron') as typeof import('electron')
  return path.join(app.getPath('userData'), KEY_FILE_NAME)
}

/** Returns true if Electron safeStorage encryption is available on this OS. */
export function isSafeStorageAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { safeStorage } = require('electron') as typeof import('electron')
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/**
 * Derives a 32-byte AES key from the userData path as a machine-specific salt.
 * Used only when safeStorage is unavailable.
 */
function deriveFallbackKey(): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require('electron') as typeof import('electron')
  const userData = app.getPath('userData')
  return crypto.scryptSync(userData, SALT, 32)
}

/**
 * Saves the OpenAI key using safeStorage if available,
 * otherwise falls back to AES-256-GCM encrypted file in userData.
 */
export function saveOpenAIKey(key: string): void {
  if (isSafeStorageAvailable()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { safeStorage } = require('electron') as typeof import('electron')
    const encrypted = safeStorage.encryptString(key)
    fs.writeFileSync(getKeyFilePath(), encrypted)
  } else {
    const aesKey = deriveFallbackKey()
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, aesKey, iv)
    const encrypted = Buffer.concat([cipher.update(key, 'utf-8'), cipher.final()])
    const tag = cipher.getAuthTag()
    // Format: iv(12) + tag(16) + ciphertext
    const payload = Buffer.concat([iv, tag, encrypted])
    fs.writeFileSync(getKeyFilePath(), payload)
  }
}

/**
 * Loads the OpenAI key. Returns null if not set or decryption fails.
 */
export function loadOpenAIKey(): string | null {
  const keyFile = getKeyFilePath()
  if (!fs.existsSync(keyFile)) return null

  try {
    const data = fs.readFileSync(keyFile)

    if (isSafeStorageAvailable()) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { safeStorage } = require('electron') as typeof import('electron')
      return safeStorage.decryptString(data)
    } else {
      const aesKey = deriveFallbackKey()
      const iv = data.subarray(0, 12)
      const tag = data.subarray(12, 28)
      const ciphertext = data.subarray(28)
      const decipher = crypto.createDecipheriv(ALGORITHM, aesKey, iv)
      decipher.setAuthTag(tag)
      return decipher.update(ciphertext) + decipher.final('utf-8')
    }
  } catch {
    return null
  }
}

/** Deletes the stored OpenAI key. */
export function deleteOpenAIKey(): void {
  const keyFile = getKeyFilePath()
  if (fs.existsSync(keyFile)) {
    fs.unlinkSync(keyFile)
  }
}
