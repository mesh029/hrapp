import Redis from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  // During build, Redis may not be available, return a dummy URL
  return 'redis://localhost:6379';
};

let redisInstance: Redis | null = null;

const getRedis = () => {
  if (!redisInstance) {
    try {
      redisInstance = new Redis(getRedisUrl(), {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true, // Don't connect immediately
      });

      redisInstance.on('error', (err) => {
        // Only log errors in runtime, not during build
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
          console.error('Redis Client Error:', err);
        }
      });

      redisInstance.on('connect', () => {
        if (typeof window === 'undefined') {
          console.log('Redis Client Connected');
        }
      });
    } catch (error) {
      // Silently fail during build
      if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
        console.error('Failed to initialize Redis:', error);
      }
    }
  }
  return redisInstance;
};

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const instance = getRedis();
    if (!instance) {
      // Return a mock Redis instance for build time
      const mockFn = async () => {};
      return typeof prop === 'string' && ['setex', 'get', 'del', 'set', 'exists'].includes(prop)
        ? mockFn
        : undefined;
    }
    const value = (instance as any)[prop];
    // Bind methods to the instance to ensure proper context
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
