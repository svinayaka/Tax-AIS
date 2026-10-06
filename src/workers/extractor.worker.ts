/**
 * Extractor & Tax Diagnostic Web Worker
 * Offloads deterministic extraction and ITR form routing to a dedicated background worker thread.
 * Implements the Agent System Directive in src/workers/ROUTER_AGENT.md (TaxDiagnosticAgent).
 *
 * Guarantees zero UI freezing, smooth 60fps animations, and zero main thread jank.
 */

import { extractStructuredData } from '../lib/extractor';
import { classifyItr } from '../lib/itr-classifier';
import type { StructuredExtractionResult, ItrClassificationResult } from '../types/ais';

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

export type ExtractorWorkerResponse = ExtractorWorkerSuccessResponse | ExtractorWorkerErrorResponse;

globalThis.addEventListener('message', (event: MessageEvent<ExtractorWorkerRequest>) => {
  if (event.origin && event.origin !== globalThis.location?.origin) {
    return;
  }
  const { id, rawText, customFields } = event.data;
  try {
    const structuredData = extractStructuredData(rawText, customFields);
    const itrRecommendation = classifyItr(structuredData);
    structuredData.itrRecommendation = itrRecommendation;

    const response: ExtractorWorkerSuccessResponse = {
      id,
      type: 'SUCCESS',
      structuredData,
      itrRecommendation
    };
    globalThis.postMessage(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const response: ExtractorWorkerErrorResponse = {
      id,
      type: 'ERROR',
      error: message
    };
    globalThis.postMessage(response);
  }
});
