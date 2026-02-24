import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { corsHeaders, handleCorsOptions } from '@/lib/middleware/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

/**
 * GET /api/auth/quick-login/users
 * Get list of active users for quick login selection
 * This endpoint does not require authentication - it's safe because:
 * 1. It only returns basic info (id, name, email, location)
 * 2. Actual login still requires admin credentials
 * 3. No sensitive data is exposed
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const status = searchParams.get('status') || 'active';

    const where: any = {
      deleted_at: null,
    };

    if (status) {
      where.status = status;
    }

    const users = await prisma.user.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        primary_location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return successResponse(
      {
        users,
        count: users.length,
      },
      'Users retrieved successfully',
      200
    );
  } catch (error: any) {
    console.error('Get quick login users error:', error);
    return errorResponse(error.message || 'Failed to retrieve users', 500);
  }
}
