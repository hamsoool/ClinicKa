// @ts-nocheck
import { Redis } from "npm:@upstash/redis@1.31.3";

let redisClient: Redis | null | undefined = undefined;

// Initialize the Redis client safely
export const getRedisClient = () => {
    if (redisClient !== undefined) return redisClient;

    try {
        const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
        const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

        if (!url || !token) {
            console.warn("[Redis] Configuration missing. Cache will be bypassed.");
            redisClient = null;
            return null;
        }

        if (!url.startsWith("http")) {
            console.error("[Redis] URL must start with https://. Bypassing.");
            redisClient = null;
            return null;
        }

        redisClient = new Redis({ url, token });
    } catch (error) {
        console.error("[Redis] Failed to initialize client:", error);
        redisClient = null;
    }

    return redisClient;
};

// Retrieve data from cache
export async function getCachedData<T>(key: string): Promise<T | null> {
    const redis = getRedisClient();
    if (!redis) return null;
    try { return await redis.get<T>(key); }
    catch (err) { console.error(`[Redis] GET error for ${key}:`, err); return null; }
}

// Save data to cache with a Time-To-Live (TTL) in seconds
export async function setCachedData(key: string, data: any, ttlSeconds = 3600): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try { await redis.setex(key, ttlSeconds, data); }
    catch (err) { console.error(`[Redis] SET error for ${key}:`, err); }
}

// Delete specified keys to invalidate the cache
export async function invalidateCache(keys: string | string[]): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        if (keysArray.length > 0) await redis.del(...keysArray);
    } catch (err) { console.error(`[Redis] DEL error:`, err); }
}