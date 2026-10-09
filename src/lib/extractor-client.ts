/**
 * Extractor Service Client
 * Dispatches extraction & ITR classification to the Web Worker.
 * Automatically falls back to synchronous main-thread execution if Web Workers are unavailable.
 */

import { extractStructuredData } from './extractor';
import { classifyItr } from './itr-classifier';
import type {
  ExtractionClientResult,
  ExtractorWorkerRequest,
  ExtractorWorkerResponse,
} from '../types/worker';

export type { ExtractionClientResult };

const WORKER_TIMEOUT_MS = 15000;
let requestIdCounter = 0;

function executeFallback(
  rawText: string,
  customFields: string[] = []
): ExtractionClientResult {
  const structuredData = extractStructuredData(rawText, customFields);
  const itrRecommendation = classifyItr(structuredData);
  structuredData.itrRecommendation = itrRecommendation;
  return {
    structuredData,
    itrRecommendation,
    executedInWorker: false
  };
}

/**
 * Extracts structured data and computes ITR classification.
 * Runs in background Web Worker when supported, with resilient main-thread fallback.
 */
export async function extractAndClassifyAis(
  rawText: string,
  customFields: string[] = []
): Promise<ExtractionClientResult> {
  if (typeof Worker === 'undefined') {
    return executeFallback(rawText, customFields);
  }

  let worker: Worker | null = null;
  try {
    worker = new Worker(
      new URL('../workers/extractor.worker.ts', import.meta.url),
      { type: 'module' }
    );
  } catch (err) {
    console.warn('Worker initialization unavailable; falling back to main thread:', err);
    return executeFallback(rawText, customFields);
  }

  requestIdCounter += 1;
  const requestId = `ext_${Date.now()}_${requestIdCounter}`;

  return new Promise<ExtractionClientResult>((resolve) => {
    let settled = false;

    const timeoutTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          worker?.terminate();
        } catch {
          // ignore
        }
        console.warn('Worker timeout exceeded; recovering on main thread.');
        resolve(executeFallback(rawText, customFields));
      }
    }, WORKER_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<ExtractorWorkerResponse>) => {
      if (settled) return;
      const data = event.data;
      if (data.id !== requestId) return;

      settled = true;
      clearTimeout(timeoutTimer);
      try {
        worker?.terminate();
      } catch {
        // ignore
      }

      if (data.type === 'SUCCESS') {
        resolve({
          structuredData: data.structuredData,
          itrRecommendation: data.itrRecommendation,
          executedInWorker: true
        });
      } else {
        console.warn('Worker error returned; recovering on main thread:', data.error);
        resolve(executeFallback(rawText, customFields));
      }
    };

    worker.onerror = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      try {
        worker?.terminate();
      } catch {
        // ignore
      }
      console.warn('Worker execution error; recovering on main thread:', err.message);
      resolve(executeFallback(rawText, customFields));
    };

    const requestPayload: ExtractorWorkerRequest = {
      id: requestId,
      rawText,
      customFields
    };

    worker.postMessage(requestPayload);
  });
}
