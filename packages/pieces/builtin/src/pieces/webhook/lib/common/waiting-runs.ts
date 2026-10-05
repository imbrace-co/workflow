import { StoreScope } from '@activepieces/pieces-framework';

// Shared by "Wait for Event" and "Resume Waiting Run": a project-scoped store entry
// maps a business key (e.g. an order id) to the paused run and its pause request id.
export type WaitingRun = {
  runId: string;
  requestId: string;
};

const KEY_PREFIX = 'wait-for-event:';
const STORE_KEY_MAX_LENGTH = 128;

export const waitingRunScope = StoreScope.PROJECT;

export function waitingRunStoreKey(key: unknown): string {
  const value = typeof key === 'string' ? key.trim() : String(key ?? '').trim();
  if (!value) {
    throw new Error('Key is required');
  }
  const storeKey = KEY_PREFIX + value;
  if (storeKey.length > STORE_KEY_MAX_LENGTH) {
    throw new Error(`Key is too long (max ${STORE_KEY_MAX_LENGTH - KEY_PREFIX.length} characters)`);
  }
  return storeKey;
}

export function parseResumeUrl(resumeUrl: string): WaitingRun {
  const match = new URL(resumeUrl).pathname.match(/\/v1\/flow-runs\/([^/]+)\/requests\/([^/]+)/);
  if (!match) {
    throw new Error(`Unexpected resume URL: ${resumeUrl}`);
  }
  return { runId: match[1], requestId: match[2] };
}
