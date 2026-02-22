/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API routes only (no pages)
  output: 'standalone', // For Docker optimization
  
  // Environment variables
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  },
  
  // Note: Server Actions are available by default in Next.js 14+
  // We use API routes for all backend operations
};

module.exports = nextConfig;
