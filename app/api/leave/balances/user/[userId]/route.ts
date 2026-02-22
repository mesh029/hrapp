import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { getUserLeaveBalances } from '@/lib/services/leave-balance';

/**
 * GET /api/leave/balances/user/[userId]
 * Get all leave balances for a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.userId);
    if (!validationResult.success) {
      return errorResponse('Invalid user ID', 400);
    }

    // If requesting another user's balance, check permission
    if (params.userId !== user.id) {
      try {
        await requirePermission(user, 'leave.balances.read', { locationId });
      } catch {
        const hasSystemAdmin = await prisma.userRole.findFirst({
          where: {
            user_id: user.id,
            deleted_at: null,
            role: {
              status: 'active',
              role_permissions: {
                some: {
                  permission: {
                    name: 'system.admin',
                  },
                },
              },
            },
          },
        });

        if (!hasSystemAdmin) {
          return unauthorizedResponse('You do not have permission to view other users\' leave balances');
        }
      }
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, name: true, email: true, deleted_at: true },
    });

    if (!targetUser || targetUser.deleted_at) {
      return notFoundResponse('User not found');
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);

    // Get leave balances
    const balances = await getUserLeaveBalances(params.userId, year);

    return successResponse({
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
      year,
      balances,
    });
  } catch (error: any) {
    console.error('Get user leave balances error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
