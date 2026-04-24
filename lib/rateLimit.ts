import { NextRequest, NextResponse } from 'next/server';

/**
 * In-memory sliding-window rate limiter.
 * Keyed by Clerk userId (from header) or fallback IP.
 * Each instance tracks a separate limit (e.g. extract vs inject).
 */

interface RateLimitEntry {
  timestamps: number[];
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

/**
 * Check if a request should be rate-limited.
 * @returns null if allowed, or a NextResponse 429 if blocked.
 */
export function rateLimit(
  request: NextRequest,
  opts: {
    /** Unique name for this limiter bucket (e.g. 'extract', 'inject') */
    name: string;
    /** Max requests allowed in the window */
    maxRequests: number;
    /** Window size in seconds */
    windowSeconds: number;
  }
): NextResponse | null {
  const { name, maxRequests, windowSeconds } = opts;
  const store = getStore(name);

  // Identify caller: prefer Clerk userId, then x-forwarded-for, then fallback
  const key =
    request.headers.get('x-user-id') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'anonymous';

  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Prune timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

    return NextResponse.json(
      {
        error: 'Too many requests. Please slow down.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((oldestInWindow + windowMs) / 1000)),
        },
      }
    );
  }

  // Allow — record this request
  entry.timestamps.push(now);

  // Periodic cleanup: evict keys with no recent activity (every ~100 checks)
  if (Math.random() < 0.01) {
    for (const [k, v] of store.entries()) {
      if (v.timestamps.length === 0 || v.timestamps[v.timestamps.length - 1] < now - windowMs * 2) {
        store.delete(k);
      }
    }
  }

  return null;
}
