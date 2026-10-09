/**
 * Extractor & Tax Diagnostic Web Worker
 * Offloads deterministic extraction and ITR form routing to a dedicated background worker thread.
 * Implements the Agent System Directive in src/workers/ROUTER_AGENT.md (TaxDiagnosticAgent).
 *
 * Guarantees zero UI freezing, smooth 60fps animations, and zero main thread jank.
 */

import { extractStructuredData } from '../lib/extractor';
import { classifyItr } from '../lib/itr-classifier';
import type {
  ExtractorWorkerRequest,
  ExtractorWorkerSuccessResponse,
  ExtractorWorkerErrorResponse,
} from '../types/worker';

export type {
  ExtractorWorkerRequest,
  ExtractorWorkerSuccessResponse,
  ExtractorWorkerErrorResponse,
};
export type { ExtractorWorkerResponse } from '../types/worker';

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
