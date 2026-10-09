/**
 * Web Worker & Background Dispatcher Types
 * Structured message contracts between main thread and background Web Worker.
 */

import type {
  StructuredExtractionResult,
  ItrClassificationResult,
} from './ais';

export interface ExtractorWorkerRequest {
  id: string;
  rawText: string;
  customFields?: string[];
}

export interface ExtractorWorkerSuccessResponse {
  id: string;
  type: 'SUCCESS';
  structuredData: StructuredExtractionResult;
  itrRecommendation: ItrClassificationResult;
}

export interface ExtractorWorkerErrorResponse {
  id: string;
  type: 'ERROR';
  error: string;
}

export type ExtractorWorkerResponse =
  | ExtractorWorkerSuccessResponse
  | ExtractorWorkerErrorResponse;

export interface ExtractionClientResult {
  structuredData: StructuredExtractionResult;
  itrRecommendation: ItrClassificationResult;
  executedInWorker: boolean;
}
