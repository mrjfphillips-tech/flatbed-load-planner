// ─── Ingestion Types ──────────────────────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

import type { Framework, IngestionStatus, SupportedMimeType } from './framework';
import type { RightsProfile } from './entities';

/**
 * A document submitted for ingestion.
 */
export interface SourceDocumentUpload {
  file: Buffer;
  filename: string;
  mimeType: SupportedMimeType;
  metadata: DocumentMetadata;
  rightsProfile: RightsProfile;
  frameworkAffiliation: Framework[];
}

/**
 * Metadata associated with a source document.
 */
export interface DocumentMetadata {
  title: string;
  author?: string;
  chapter?: string;
  section?: string;
  pageCount?: number;
}

/**
 * Result of an ingestion operation.
 */
export interface IngestionResult {
  documentId: string;
  chunksCreated: number;
  duplicatesDetected: number;
  processingTimeMs: number;
  status: IngestionStatus;
}

/**
 * Report of detected duplicates during ingestion.
 */
export interface DuplicateReport {
  duplicates: DuplicateMatch[];
  totalChecked: number;
}

/**
 * A single duplicate match between a new chunk and existing indexed content.
 */
export interface DuplicateMatch {
  newChunkIndex: number;
  existingChunkId: string;
  existingDocumentId: string;
  similarityScore: number;
}
