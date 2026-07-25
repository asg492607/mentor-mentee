// ─── LUMINA CLIENT CACHE MANAGER ─────────────────────────────────────────────
// In-memory & sessionStorage cache with TTL & instant invalidation

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes default

class MemoryCacheManager {
  constructor() {
    this.memoryStore = new Map();
  }

  get(key) {
    // 1. Try memory cache first
    if (this.memoryStore.has(key)) {
      const entry = this.memoryStore.get(key);
      if (Date.now() < entry.expiry) {
        return entry.data;
      }
      this.memoryStore.delete(key);
    }

    // 2. Fallback to sessionStorage
    try {
      const raw = sessionStorage.getItem(`lumina_cache_${key}`);
      if (raw) {
        const entry = JSON.parse(raw);
        if (Date.now() < entry.expiry) {
          // Re-hydrate memory store
          this.memoryStore.set(key, entry);
          return entry.data;
        }
        sessionStorage.removeItem(`lumina_cache_${key}`);
      }
    } catch (e) {
      console.warn('SessionStorage read error:', e);
    }

    return null;
  }

  set(key, data, ttlMs = DEFAULT_TTL_MS) {
    const expiry = Date.now() + ttlMs;
    const entry = { data, expiry };

    this.memoryStore.set(key, entry);

    try {
      sessionStorage.setItem(`lumina_cache_${key}`, JSON.stringify(entry));
    } catch (e) {
      console.warn('SessionStorage write error:', e);
    }
  }

  // Instant Cache Invalidation on Mutation
  invalidate(key) {
    this.memoryStore.delete(key);
    try {
      sessionStorage.removeItem(`lumina_cache_${key}`);
    } catch (e) {
      console.warn('SessionStorage removal error:', e);
    }
  }

  clear() {
    this.memoryStore.clear();
    try {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('lumina_cache_')) {
          sessionStorage.removeItem(k);
        }
      });
    } catch (e) {
      console.warn('SessionStorage clear error:', e);
    }
  }
}

export const CacheManager = new MemoryCacheManager();
