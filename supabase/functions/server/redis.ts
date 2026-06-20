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

export interface OcrCallLogEntry {
    timestamp: number;
    provider: "azure" | "ocr-space";
}

// Increment OCR service calls counter
export async function incrementOcrCount(provider: "azure" | "ocr-space" = "azure"): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return 0;
    try {
        const now = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        const member = `${now}:${provider}:${rand}`;
        
        const [count] = await Promise.all([
            redis.incr("stats:ocr_calls"),
            redis.zadd("stats:ocr_calls_log", { score: now, member }),
            redis.zremrangebyscore("stats:ocr_calls_log", 0, now - 90 * 24 * 60 * 60 * 1000)
        ]);
        return count;
    } catch (err) {
        console.error("[Redis] INCR and ZADD error for stats:ocr_calls:", err);
        return 0;
    }
}

// Get OCR service calls count
export async function getOcrCount(): Promise<number> {
    const redis = getRedisClient();
    if (!redis) return 0;
    try {
        const val = await redis.get("stats:ocr_calls");
        return Number(val || 0);
    } catch (err) {
        console.error("[Redis] GET error for stats:ocr_calls:", err);
        return 0;
    }
}

// Get historical OCR service calls timestamps within 90 days
export async function getOcrCallsHistory(): Promise<OcrCallLogEntry[]> {
    const redis = getRedisClient();
    if (!redis) return [];
    try {
        const now = Date.now();
        const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
        const members = await redis.zrange<string[]>("stats:ocr_calls_log", ninetyDaysAgo, now, { byScore: true });
        if (!members || !Array.isArray(members)) return [];
        return members.map(m => {
            const parts = m.split(":");
            const timestamp = Number(parts[0]);
            const provider = (parts[1] === "azure" || parts[1] === "ocr-space")
                ? (parts[1] as "azure" | "ocr-space")
                : "azure";
            return { timestamp, provider };
        }).filter(entry => !isNaN(entry.timestamp) && entry.timestamp > 0);
    } catch (err) {
        console.error("[Redis] getOcrCallsHistory error:", err);
        return [];
    }
}