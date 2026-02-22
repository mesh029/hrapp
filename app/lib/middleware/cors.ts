import { NextResponse } from 'next/server';

/**
 * CORS headers for API routes
 */
export function corsHeaders(): HeadersInit {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    process.env.NEXT_PUBLIC_API_URL,
  ].filter(Boolean);

  return {
    'Access-Control-Allow-Origin': allowedOrigins.join(', ') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export function handleCorsOptions(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(),
  });
}
