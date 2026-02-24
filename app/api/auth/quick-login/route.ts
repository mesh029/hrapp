import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { generateAccessToken, generateRefreshToken, storeRefreshToken } from '@/lib/auth/jwt';
import { z } from 'zod';
import { corsHeaders, handleCorsOptions } from '@/lib/middleware/cors';

const quickLoginSchema = z.object({
  adminEmail: z.string().email(),
  adminPassword: z.string().min(1),
  userId: z.string().uuid(),
});

export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * POST /api/auth/quick-login
 * Allow admins to quickly login as any user using admin credentials
 * This endpoint does not require authentication - it verifies admin credentials instead
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = quickLoginSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const { adminEmail, adminPassword, userId } = validationResult.data;

    // Find admin user
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: {
        id: true,
        email: true,
        password_hash: true,
        status: true,
        deleted_at: true,
        primary_location_id: true,
      },
    });

    if (!admin || admin.deleted_at) {
      return errorResponse('Invalid admin credentials', 401);
    }

    if (admin.status !== 'active') {
      return errorResponse('Admin account is not active', 403);
    }

    // Verify admin password
    if (!admin.password_hash || !(await verifyPassword(adminPassword, admin.password_hash))) {
      return errorResponse('Invalid admin credentials', 401);
    }

    // Check if admin has system.admin permission
    const locationId = admin.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    const { checkPermission } = await import('@/lib/middleware/permissions');
    const isAdmin = await checkPermission(
      { id: admin.id, email: admin.email, name: '', status: admin.status },
      'system.admin',
      { locationId }
    );
    
    if (!isAdmin) {
      return errorResponse('Only administrators can use quick login', 403);
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

    if (!targetUser || targetUser.deleted_at) {
      return errorResponse('Target user not found', 404);
    }

    if (targetUser.status !== 'active') {
      return errorResponse('Target user account is not active', 403);
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
    return errorResponse(error.message || 'Failed to perform quick login', 500);
  }
}
