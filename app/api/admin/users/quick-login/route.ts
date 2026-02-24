import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { generateAccessToken, generateRefreshToken, storeRefreshToken } from '@/lib/auth/jwt';

/**
 * POST /api/admin/users/quick-login
 * Allow admins to quickly login as any user (for testing purposes)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await authenticate(request);

    // Check if admin has system.admin permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    const { checkPermission } = await import('@/lib/middleware/permissions');
    const isAdmin = await checkPermission(admin, 'system.admin', { locationId });
    
    if (!isAdmin) {
      return unauthorizedResponse('Only administrators can use quick login');
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return errorResponse('User ID is required', 400);
    }

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        deleted_at: true,
      },
    });

    if (!targetUser) {
      return errorResponse('User not found', 404);
    }

    if (targetUser.status !== 'active') {
      return errorResponse('Target user account is not active', 403);
    }

    if (targetUser.deleted_at) {
      return errorResponse('Target user account has been deleted', 403);
    }

    // Generate tokens for the target user
    const accessToken = generateAccessToken({
      userId: targetUser.id,
      email: targetUser.email,
    });

    const refreshToken = generateRefreshToken({
      userId: targetUser.id,
      email: targetUser.email,
    });

    // Store refresh token
    await storeRefreshToken(targetUser.id, refreshToken);

    return successResponse(
      {
        accessToken,
        refreshToken,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          status: targetUser.status,
        },
      },
      'Quick login successful',
      200
    );
  } catch (error: any) {
    console.error('Quick login error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Failed to perform quick login', 500);
  }
}
