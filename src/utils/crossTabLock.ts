/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cross-tab coordination and distributed locking utility for Kho Tri Thuc.
 * 
 * Provides:
 * 1. Distributed mutex execution using the native Web Locks API (`navigator.locks`)
 *    when supported, with an atomic timestamped lease fallback in `localStorage`.
 * 2. Cross-tab communication via `BroadcastChannel` with fallback.
 */

const TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export interface LockOptions {
  /**
   * If true, non-blocking mode: attempts to acquire the lock immediately.
   * If held by another tab, returns `{ acquired: false }` instead of waiting.
   * Defaults to false (blocking wait).
   */
  ifAvailable?: boolean;

  /**
   * Maximum lease duration in milliseconds before a lock is deemed expired/stale.
   * Only used by the localStorage fallback to prevent deadlocks from crashed tabs.
   * Defaults to 15,000ms (15 seconds).
   */
  leaseMs?: number;

  /**
   * Maximum time in milliseconds to wait to acquire a blocking lock (localStorage fallback).
   * Defaults to 5,000ms.
   */
  timeoutMs?: number;
}

export interface LockResult<T> {
  acquired: boolean;
  result?: T;
}

interface LocalStorageLockData {
  owner: string;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// BroadcastChannel Cross-Tab Messaging
// ---------------------------------------------------------------------------

let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    syncChannel = new BroadcastChannel('kt_cross_tab_sync');
  }
} catch {
  // Restricted environment or private mode without BroadcastChannel
}

export interface BroadcastPayload {
  type: string;
  payload?: unknown;
  tabId: string;
  timestamp: number;
}

/**
 * Broadcasts an event to all other open tabs in the same origin.
 */
export function broadcastMessage(type: string, payload?: unknown): void {
  if (!syncChannel) return;
  try {
    syncChannel.postMessage({
      type,
      payload,
      tabId: TAB_ID,
      timestamp: Date.now(),
    });
  } catch {
    // Non-fatal if posting fails
  }
}

/**
 * Subscribes to messages sent by other tabs.
 * Returns an unsubscribe callback.
 */
export function onBroadcastMessage(
  handler: (msg: BroadcastPayload) => void
): () => void {
  if (!syncChannel) return () => {};

  const listener = (event: MessageEvent) => {
    try {
      const data = event.data as BroadcastPayload;
      if (data && typeof data === 'object' && data.tabId !== TAB_ID) {
        handler(data);
      }
    } catch {
      // Ignore malformed messages
    }
  };

  syncChannel.addEventListener('message', listener);
  return () => {
    syncChannel?.removeEventListener('message', listener);
  };
}

// ---------------------------------------------------------------------------
// LocalStorage Fallback Helpers
// ---------------------------------------------------------------------------

function getStorageLockKey(lockName: string): string {
  return `kt_lock_${lockName}`;
}

function tryAcquireLocalStorageLock(
  key: string,
  leaseMs: number
): boolean {
  if (typeof localStorage === 'undefined') return true;

  const now = Date.now();
  const raw = localStorage.getItem(key);

  if (raw) {
    try {
      const existing: LocalStorageLockData = JSON.parse(raw);
      if (
        existing &&
        typeof existing.expiresAt === 'number' &&
        existing.expiresAt > now &&
        existing.owner !== TAB_ID
      ) {
        // Lock currently held by another active tab
        return false;
      }
    } catch {
      // Corrupt payload; allow overwrite
    }
  }

  // Attempt write
  const lockData: LocalStorageLockData = {
    owner: TAB_ID,
    expiresAt: now + leaseMs,
  };
  localStorage.setItem(key, JSON.stringify(lockData));

  // Verify write ownership
  try {
    const check = localStorage.getItem(key);
    if (check) {
      const parsed: LocalStorageLockData = JSON.parse(check);
      return parsed.owner === TAB_ID;
    }
  } catch {
    return false;
  }

  return false;
}

function releaseLocalStorageLock(key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: LocalStorageLockData = JSON.parse(raw);
      if (parsed.owner === TAB_ID) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Non-fatal
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Main Cross-Tab Lock Wrapper
// ---------------------------------------------------------------------------

/**
 * Executes `action` while exclusively holding a named cross-tab lock.
 * 
 * - If native Web Locks API (`navigator.locks`) is available, it guarantees
 *   deadlock-free, zero-polling exclusive execution across tabs and workers.
 * - Otherwise falls back to an atomic lease-based localStorage mutex.
 */
export async function withCrossTabLock<T>(
  lockName: string,
  action: () => Promise<T>,
  options?: LockOptions
): Promise<LockResult<T>> {
  const leaseMs = options?.leaseMs ?? 15000;
  const ifAvailable = options?.ifAvailable ?? false;
  const timeoutMs = options?.timeoutMs ?? 5000;

  // 1. Prefer native Web Locks API if supported by the browser engine
  if (
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    navigator.locks &&
    typeof navigator.locks.request === 'function'
  ) {
    try {
      if (ifAvailable) {
        return await navigator.locks.request(
          lockName,
          { ifAvailable: true },
          async (lock) => {
            if (!lock) {
              return { acquired: false };
            }
            const result = await action();
            return { acquired: true, result };
          }
        );
      } else {
        return await navigator.locks.request(lockName, async () => {
          const result = await action();
          return { acquired: true, result };
        });
      }
    } catch (err) {
      // If Web Locks API throws (e.g. permission or security restriction), fallback to localStorage
      console.warn(`[CrossTabLock] Web Locks error for "${lockName}", falling back:`, err);
    }
  }

  // 2. LocalStorage Lease Fallback
  const storageKey = getStorageLockKey(lockName);

  if (ifAvailable) {
    const acquired = tryAcquireLocalStorageLock(storageKey, leaseMs);
    if (!acquired) {
      return { acquired: false };
    }
    try {
      const result = await action();
      return { acquired: true, result };
    } finally {
      releaseLocalStorageLock(storageKey);
    }
  }

  // Blocking wait with backoff
  const startTime = Date.now();
  let acquired = false;

  while (Date.now() - startTime < timeoutMs) {
    acquired = tryAcquireLocalStorageLock(storageKey, leaseMs);
    if (acquired) break;
    // Jittered backoff (30ms - 80ms)
    await sleep(30 + Math.random() * 50);
  }

  if (!acquired) {
    return { acquired: false };
  }

  try {
    const result = await action();
    return { acquired: true, result };
  } finally {
    releaseLocalStorageLock(storageKey);
  }
}
