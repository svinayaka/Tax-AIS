/**
 * Client-Side Tax Session Persistence Manager (IndexedDB)
 *
 * Privacy Guarantees:
 * - 100% Client-Side In-Browser execution: Zero server transmission.
 * - Stores uploaded document binary, parsed text, and structured extraction schema.
 * - 24-hour expiration window: Automatically purges data older than 24 hours.
 * - Overwritten whenever a new file is uploaded or explicitly cleared by user.
 */

import type { StructuredExtractionResult } from '../types/ais';

export interface StoredSession {
  id: string; // Fixed key 'active_session'
  fileName: string;
  fileType: string;
  fileBuffer: ArrayBuffer;
  rawText: string;
  structuredData: StructuredExtractionResult;
  savedAt: number; // Unix epoch ms
  expiresAt: number; // Unix epoch ms (savedAt + 24 hours)
}

const DB_NAME = 'tax_ais_local_storage';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const SESSION_KEY = 'active_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours in milliseconds

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open database'));
  });
}

/**
 * Saves current parsed tax session into IndexedDB with 24h validity.
 */
export async function saveTaxSession(
  file: File | { name: string; type?: string },
  fileBuffer: ArrayBuffer,
  rawText: string,
  structuredData: StructuredExtractionResult
): Promise<void> {
  try {
    const db = await openDatabase();
    const now = Date.now();
    const session: StoredSession = {
      id: SESSION_KEY,
      fileName: file.name || 'document',
      fileType: file.type || 'application/octet-stream',
      fileBuffer,
      rawText,
      structuredData,
      savedAt: now,
      expiresAt: now + SESSION_TTL_MS
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putRequest = store.put(session);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error || new Error('Failed to save tax session to IndexedDB'));
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error || new Error('Transaction error while saving tax session'));
    });
  } catch (error) {
    console.warn('Could not persist tax session to IndexedDB:', error);
  }
}

/**
 * Retrieves the stored tax session if it exists and has not expired (within 24h).
 * If expired, automatically purges the session.
 */
export async function loadTaxSession(): Promise<StoredSession | null> {
  try {
    const db = await openDatabase();
    return await new Promise<StoredSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(SESSION_KEY);

      getRequest.onsuccess = () => {
        const session = getRequest.result as StoredSession | undefined;
        if (!session) {
          resolve(null);
          return;
        }

        const now = Date.now();
        if (now > session.expiresAt) {
          // Expired after 24 hours - remove it
          store.delete(SESSION_KEY);
          resolve(null);
        } else {
          resolve(session);
        }
      };

      getRequest.onerror = () => reject(getRequest.error || new Error('Failed to retrieve tax session from IndexedDB'));
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error || new Error('Transaction error while reading tax session'));
    });
  } catch (error) {
    console.warn('Could not retrieve tax session from IndexedDB:', error);
    return null;
  }
}

/**
 * Completely purges the active session from IndexedDB.
 */
export async function clearTaxSession(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const deleteRequest = store.delete(SESSION_KEY);

      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error || new Error('Failed to delete tax session from IndexedDB'));
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error || new Error('Transaction error while deleting tax session'));
    });
  } catch (error) {
    console.warn('Could not clear tax session from IndexedDB:', error);
  }
}

/**
 * Formats remaining validity duration into human-readable hours and minutes.
 */
export function formatRemainingTime(expiresAt: number): string {
  const diffMs = Math.max(0, expiresAt - Date.now());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
