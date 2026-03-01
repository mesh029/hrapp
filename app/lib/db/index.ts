import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// OPTIMIZED: Configure connection pool for better performance
// - max: 20 connections (up from default 10) for handling concurrent requests
// - min: 5 connections to maintain warm pool
// - idleTimeoutMillis: 30s to close idle connections
// - connectionTimeoutMillis: 2s to fail fast if DB is unavailable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Maximum pool size
  min: parseInt(process.env.DB_POOL_MIN || '5', 10), // Minimum pool size
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10), // 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10), // 2 seconds
  // Statement timeout to prevent long-running queries from blocking the pool
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10), // 30 seconds
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
