/**
 * Client-Side Storage & Session Types
 * Strict IndexedDB session persistence model with 24-hour TTL.
 */

import type {
  StructuredExtractionResult,
  ItrClassificationResult,
} from './ais';

export interface StoredSession {
  id: string; // Fixed key 'active_session'
  fileName: string;
  fileType: string;
  fileBuffer: ArrayBuffer;
  rawText: string;
  structuredData: StructuredExtractionResult;
  itrRecommendation?: ItrClassificationResult;
  savedAt: number; // Unix epoch ms
  expiresAt: number; // Unix epoch ms (savedAt + 24 hours)
}
