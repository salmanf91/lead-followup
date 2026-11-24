import { LRUCache } from 'lru-cache';

// Cache key format: dashboard:${tenantId}:${campaignId || 'ALL'}
const cache = new LRUCache<string, any>({
  max: 500,
  ttl: 60_000, // 60 seconds TTL
});

export function getDashboardCacheKey(tenantId: string, campaignId?: string): string {
  return `dashboard:${tenantId}:${campaignId || 'ALL'}`;
}

export function getDashboardCache<T>(tenantId: string, campaignId?: string): T | undefined {
  const key = getDashboardCacheKey(tenantId, campaignId);
  return cache.get(key) as T | undefined;
}

export function setDashboardCache<T>(tenantId: string, data: T, campaignId?: string): void {
  const key = getDashboardCacheKey(tenantId, campaignId);
  cache.set(key, data);
}

/**
 * Invalidates all cache entries for a given tenant.
 * Triggered whenever a lead note is saved, status is updated, or sync finishes.
 */
export function invalidateTenantDashboardCache(tenantId: string): void {
  const prefix = `dashboard:${tenantId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export function clearAllDashboardCache(): void {
  cache.clear();
}

