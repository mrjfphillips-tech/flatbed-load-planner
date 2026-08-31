/**
 * TranscriptionEngineFactory
 *
 * Factory function that returns either the online (Azure Speech Services)
 * or offline (Whisper WASM) transcription engine based on current connectivity status.
 *
 * Requirements: 24.1, 24.3, 24.7
 */

import type { TranscriptionEngine } from '@ptv-discovery-coach/shared';
import { WhisperWasmTranscriptionEngine, type WhisperWasmConfig } from './WhisperWasmTranscriptionEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TranscriptionMode = 'online' | 'offline';

export interface TranscriptionEngineFactoryConfig {
  /** Configuration for the offline Whisper WASM engine */
  whisperConfig?: WhisperWasmConfig;
  /** Factory or instance for the online Azure engine. Lazy-loaded when online. */
  createOnlineEngine?: () => TranscriptionEngine;
  /** Override connectivity check (useful for testing) */
  connectivityCheck?: () => boolean;
}

export interface TranscriptionEngineResult {
  engine: TranscriptionEngine;
  mode: TranscriptionMode;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Singleton instance of the offline engine (reused across mode switches) */
let offlineEngineInstance: WhisperWasmTranscriptionEngine | null = null;

/**
 * Creates or returns the appropriate transcription engine based on
 * current network connectivity.
 *
 * - When online: returns the Azure Speech Services engine for full-quality transcription
 * - When offline: returns the Whisper WASM engine for on-device transcription
 *
 * The factory caches the offline engine instance since its WASM model
 * persists in memory once loaded.
 */
export function createTranscriptionEngine(
  config: TranscriptionEngineFactoryConfig = {},
): TranscriptionEngineResult {
  const isOnline = config.connectivityCheck
    ? config.connectivityCheck()
    : checkConnectivity();

  if (isOnline && config.createOnlineEngine) {
    return {
      engine: config.createOnlineEngine(),
      mode: 'online',
    };
  }

  // Use offline engine (Whisper WASM)
  if (!offlineEngineInstance) {
    offlineEngineInstance = new WhisperWasmTranscriptionEngine(config.whisperConfig);
  }

  return {
    engine: offlineEngineInstance,
    mode: 'offline',
  };
}

/**
 * Pre-load the Whisper WASM model so it's ready for instant offline switching.
 * Call this during app initialization while online to cache the model.
 */
export async function preloadOfflineModel(config?: WhisperWasmConfig): Promise<void> {
  if (!offlineEngineInstance) {
    offlineEngineInstance = new WhisperWasmTranscriptionEngine(config);
  }
  await offlineEngineInstance.ensureModelLoaded();
}

/**
 * Get the current offline engine instance (if created).
 * Useful for checking model load status.
 */
export function getOfflineEngineInstance(): WhisperWasmTranscriptionEngine | null {
  return offlineEngineInstance;
}

/**
 * Reset the offline engine instance (for testing or cleanup).
 */
export function resetOfflineEngineInstance(): void {
  offlineEngineInstance = null;
}

// ─── Connectivity Check ───────────────────────────────────────────────────────

/**
 * Check current network connectivity using the Navigator.onLine API.
 * This is a basic check — more robust connectivity detection should
 * be implemented at the app level (e.g., periodic pings to the API).
 */
function checkConnectivity(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  // Default to online if Navigator API unavailable
  return true;
}
