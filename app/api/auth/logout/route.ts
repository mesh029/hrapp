import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { removeRefreshToken } from '@/lib/auth/jwt';
import { successResponse, errorResponse } from '@/lib/utils/responses';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await authenticate(request);

    // Remove refresh token from Redis
    await removeRefreshToken(user.id);

    return successResponse(
      null,
      'Logout successful',
      200
    );
  } catch (error: any) {
    console.error('Logout error:', error);
    
    // Even if authentication fails, return success to prevent token enumeration
    if (error.message.includes('Unauthorized')) {
      return successResponse(null, 'Logout successful', 200);
    }
    
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
