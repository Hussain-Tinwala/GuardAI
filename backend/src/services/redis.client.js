const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient = null;

// In-memory fallback if Redis is down or not installed locally
const memoryFallback = new Map();

try {
    // We set a low maxRetriesPerRequest so it fails fast and falls back to memory
    redisClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
            if (times > 2) return null; // stop retrying after 2 attempts
            return Math.min(times * 50, 2000);
        }
    });

    redisClient.on('error', (err) => {
        console.warn(`[REDIS] Connection error, falling back to in-memory store. (Is Redis running?)`);
    });

    redisClient.on('connect', () => {
        console.log(`[REDIS] Successfully connected to queue/ledger.`);
    });
} catch (error) {
    console.warn(`[REDIS] Initialization failed, using in-memory fallback.`);
}

/**
 * Wrapper to handle standard get/set operations seamlessly 
 * between Redis and the Memory fallback.
 */
const cache = {
    async get(key) {
        if (redisClient && redisClient.status === 'ready') {
            return await redisClient.get(key);
        }
        return memoryFallback.get(key) || null;
    },
    
    async set(key, value, ttlSeconds) {
        if (redisClient && redisClient.status === 'ready') {
            if (ttlSeconds) {
                await redisClient.set(key, value, 'EX', ttlSeconds);
            } else {
                await redisClient.set(key, value);
            }
        } else {
            memoryFallback.set(key, value);
            if (ttlSeconds) {
                setTimeout(() => memoryFallback.delete(key), ttlSeconds * 1000);
            }
        }
    },

    async increment(key) {
        if (redisClient && redisClient.status === 'ready') {
            return await redisClient.incr(key);
        }
        const val = parseInt(memoryFallback.get(key) || '0', 10) + 1;
        memoryFallback.set(key, val.toString());
        return val;
    }
};

module.exports = cache;