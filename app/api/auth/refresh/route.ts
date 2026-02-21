import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  verifyRefreshToken,
  getRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
} from '@/lib/auth/jwt';
import { refreshTokenSchema } from '@/lib/utils/validation';
import { errorResponse, successResponse } from '@/lib/utils/responses';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = refreshTokenSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const { refreshToken } = validationResult.data;

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error: any) {
      return errorResponse('Invalid or expired refresh token', 401);
    }

    // Check if token exists in Redis (not revoked)
    const storedToken = await getRefreshToken(decoded.userId);
    if (!storedToken || storedToken !== refreshToken) {
      return errorResponse('Refresh token has been revoked', 401);
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        deleted_at: true,
      },
    });

    if (!user) {
      return errorResponse('User not found', 404);
    }

    if (user.status !== 'active') {
      return errorResponse('User account is not active', 403);
    }

    if (user.deleted_at) {
      return errorResponse('User account has been deleted', 403);
    }

    // Verify email matches
    if (user.email !== decoded.email) {
      return errorResponse('Token email mismatch', 401);
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const newRefreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Store new refresh token in Redis
    await storeRefreshToken(user.id, newRefreshToken);

    // Return new tokens
    return successResponse(
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      'Token refreshed successfully',
      200
    );
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
