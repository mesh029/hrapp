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
  
  // Prevent build cache corruption
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  
  // Improve CSS handling and prevent cache corruption
  experimental: {
    optimizeCss: true,
  },
  
  // Prevent build cache issues
  generateBuildId: async () => {
    // Use timestamp-based build ID to prevent cache conflicts
    return `build-${Date.now()}`;
  },
  
  // Note: Server Actions are available by default in Next.js 14+
  // We use API routes for all backend operations
};

module.exports = nextConfig;
