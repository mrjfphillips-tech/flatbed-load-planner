/**
 * Transcription Service Module
 *
 * Exports both online and offline transcription engines
 * plus the factory function for automatic mode selection.
 *
 * Requirements: 24.1, 24.3
 */

export {
  WhisperWasmTranscriptionEngine,
  WHISPER_MODEL_CACHE_NAME,
  initWhisperWasm,
  type WhisperWasmConfig,
  type WhisperWasmModule,
  type WhisperTranscribeResult,
} from './WhisperWasmTranscriptionEngine';

export {
  createTranscriptionEngine,
  preloadOfflineModel,
  getOfflineEngineInstance,
  resetOfflineEngineInstance,
  type TranscriptionMode,
  type TranscriptionEngineFactoryConfig,
  type TranscriptionEngineResult,
} from './TranscriptionEngineFactory';
