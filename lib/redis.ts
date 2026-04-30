import Redis from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function makeClient(): Redis {
  const client = new Redis(env.REDIS_URL || "redis://127.0.0.1:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });
  // Don't crash the process when Redis isn't reachable — operations using
  // it (cache, pub/sub) gracefully fall through where possible.
  client.on("error", (err) => {
    if (process.env.NODE_ENV !== "test") {
      console.error("[redis]", err.message);
    }
  });
  return client;
}

export const redis = globalForRedis.redis ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

/**
 * Read-through cache: returns cached JSON if present, else runs `loader`
 * and stores the result with the given TTL (seconds).
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // Redis unavailable — fall through and do the work uncached.
  }

  const value = await loader();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // best-effort cache
  }
  return value;
}

export function productCacheKey(
  productId: string,
  source: string,
  view: string,
): string {
  return `product:${productId}:${source}:${view}`;
}
