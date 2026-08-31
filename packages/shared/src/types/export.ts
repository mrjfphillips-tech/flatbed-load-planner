// ─── Export Types ─────────────────────────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

/**
 * Export target platforms.
 */
export type ExportPlatform = 'salesforce' | 'microsoft365' | 'sms' | 'email';

/**
 * Request to export session data to an external platform.
 */
export interface ExportRequest {
  sessionId: string;
  target: ExportTarget;
  includeTranscript: boolean;
  includeCoverage: boolean;
  includeContacts: boolean;
}

/**
 * Export target specification including platform, credentials, and config.
 */
export interface ExportTarget {
  platform: ExportPlatform;
  credentials: OAuthCredentials;
  config: PlatformConfig;
}

/**
 * OAuth credentials for export platform authentication.
 */
export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

/**
 * Platform-specific configuration for exports.
 */
export interface PlatformConfig {
  instanceUrl?: string;
  tenantId?: string;
  customFields?: Record<string, string>;
}

/**
 * Result of an export operation.
 */
export interface ExportResult {
  success: boolean;
  externalId?: string;
  error?: ExportError;
  retryable: boolean;
}

/**
 * Preview of export payload before confirming.
 */
export interface ExportPreview {
  platform: ExportPlatform;
  recordCount: number;
  payload: Record<string, unknown>;
}

/**
 * Error details from a failed export.
 */
export interface ExportError {
  code: string;
  message: string;
  retryAfterMs?: number;
}

/**
 * Result of a background sync operation.
 */
export interface SyncResult {
  itemsSynced: number;
  failures: number;
  lastSyncAt: Date;
}

/**
 * Current status of background sync.
 */
export interface BufferStatus {
  state: 'idle' | 'syncing' | 'completed' | 'failed';
  pendingItems: number;
  lastSyncAt?: Date;
  error?: string;
}

/**
 * Error from sync process.
 */
export interface SyncError {
  code: string;
  message: string;
  itemType: string;
  timestamp: Date;
}
