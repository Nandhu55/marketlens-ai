// Shared in-memory cache — used by both ai-service.ts and market-data/
// Single cache instance. No duplicate caching systems.

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const MAX_CACHE_SIZE = 500;
const EVICTION_BATCH = 100;

/** Get a cached value if it hasn't expired. Returns null on miss or expiry. */
export function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttlMs) return entry.data as T;
  if (entry) cache.delete(key); // expired
  return null;
}

/** Store a value in the cache. Evicts oldest entries when full. */
export function setCache<T>(key: string, data: T): void {
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = [...cache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, EVICTION_BATCH);
    for (const [k] of oldest) cache.delete(k);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

/** Get approximate cache stats (for debugging, not exposed to client). */
export function getCacheStats() {
  return { size: cache.size, max: MAX_CACHE_SIZE };
}
