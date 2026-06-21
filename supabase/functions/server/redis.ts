// @ts-nocheck
import { Redis } from "npm:@upstash/redis@1.31.3";
import { supabase } from "./context.ts";

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

// Delete keys by pattern to invalidate dynamic caches
export async function invalidateCachePattern(pattern: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        const keys = await redis.keys(pattern);
        if (keys && keys.length > 0) {
            await redis.del(...keys);
        }
    } catch (err) {
        console.error(`[Redis] Pattern invalidation error for ${pattern}:`, err);
    }
}

export interface OcrCallLogEntry {
    timestamp: number;
    provider: "azure" | "ocr-space";
}

// Increment OCR service calls counter
export async function incrementOcrCount(provider: "azure" | "ocr-space" = "azure"): Promise<number> {
    const now = Date.now();

    // Log to Supabase Postgres as persistent record (asynchronous / non-blocking)
    supabase
        .from("ocr_calls_log")
        .insert({
            timestamp: now,
            provider: provider,
        })
        .then(({ error }) => {
            if (error) console.error("[Postgres] Failed to log OCR call:", error);
        })
        .catch((err) => {
            console.error("[Postgres] Failed to log OCR call error:", err);
        });

    const redis = getRedisClient();
    if (!redis) return 0;
    try {
        const rand = Math.random().toString(36).substring(2, 8);
        const member = `${now}:${provider}:${rand}`;
        
        const ninetyDaysSeconds = 90 * 24 * 60 * 60; // 90 days in seconds
        const [count] = await Promise.all([
            redis.incr("stats:ocr_calls"),
            redis.zadd("stats:ocr_calls_log", { score: now, member }),
            redis.zremrangebyscore("stats:ocr_calls_log", 0, now - 90 * 24 * 60 * 60 * 1000),
            redis.expire("stats:ocr_calls", ninetyDaysSeconds),
            redis.expire("stats:ocr_calls_log", ninetyDaysSeconds)
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
    if (redis) {
        try {
            const val = await redis.get("stats:ocr_calls");
            if (val !== null) {
                return Number(val);
            }
        } catch (err) {
            console.error("[Redis] GET error for stats:ocr_calls:", err);
        }
    }

    // Cache miss or Redis not configured: query Postgres
    try {
        const { count, error } = await supabase
            .from("ocr_calls_log")
            .select("*", { count: "exact", head: true });

        if (error) {
            console.error("[Postgres] Failed to count ocr_calls_log:", error);
            return 0;
        }

        const totalCount = count || 0;

        // Cache the count in Redis
        if (redis) {
            const ninetyDaysSeconds = 90 * 24 * 60 * 60;
            await redis.setex("stats:ocr_calls", ninetyDaysSeconds, totalCount).catch((err) => {
                console.error("[Redis] Failed to cache stats:ocr_calls:", err);
            });
        }

        return totalCount;
    } catch (err) {
        console.error("[Postgres] ocr_calls_log count query error:", err);
        return 0;
    }
}

// Get historical OCR service calls timestamps within 90 days
export async function getOcrCallsHistory(): Promise<OcrCallLogEntry[]> {
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    const redis = getRedisClient();

    let redisHistory: OcrCallLogEntry[] = [];
    let hasRedisCache = false;

    if (redis) {
        try {
            const exists = await redis.exists("stats:ocr_calls_log");
            if (exists) {
                const members = await redis.zrange<string[]>("stats:ocr_calls_log", ninetyDaysAgo, now, { byScore: true });
                if (members && Array.isArray(members)) {
                    redisHistory = members.map(m => {
                        const parts = m.split(":");
                        const timestamp = Number(parts[0]);
                        const provider = (parts[1] === "azure" || parts[1] === "ocr-space")
                            ? (parts[1] as "azure" | "ocr-space")
                            : "azure";
                        return { timestamp, provider };
                    }).filter(entry => !isNaN(entry.timestamp) && entry.timestamp > 0);
                    hasRedisCache = true;
                }
            }
        } catch (err) {
            console.error("[Redis] getOcrCallsHistory error:", err);
        }
    }

    if (hasRedisCache) {
        return redisHistory;
    }

    // Cache miss: query database
    try {
        const { data, error } = await supabase
            .from("ocr_calls_log")
            .select("timestamp, provider")
            .gte("timestamp", ninetyDaysAgo)
            .order("timestamp", { ascending: true });

        if (error) {
            console.error("[Postgres] Failed to query ocr_calls_log:", error);
            return [];
        }

        const dbHistory = (data || []).map(row => ({
            timestamp: Number(row.timestamp),
            provider: row.provider as "azure" | "ocr-space",
        }));

        // Warm up the Redis cache
        if (redis && dbHistory.length > 0) {
            try {
                const pipeline = redis.pipeline();
                dbHistory.forEach(entry => {
                    const rand = Math.random().toString(36).substring(2, 8);
                    const member = `${entry.timestamp}:${entry.provider}:${rand}`;
                    pipeline.zadd("stats:ocr_calls_log", { score: entry.timestamp, member });
                });
                const ninetyDaysSeconds = 90 * 24 * 60 * 60;
                pipeline.expire("stats:ocr_calls_log", ninetyDaysSeconds);
                await pipeline.exec();
            } catch (cacheErr) {
                console.error("[Redis] Failed to warm ocr_calls_log cache:", cacheErr);
            }
        }

        return dbHistory;
    } catch (err) {
        console.error("[Postgres] ocr_calls_log query error:", err);
        return [];
    }
}