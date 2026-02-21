import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { getUserLeaveBalances } from '@/lib/services/leave-balance';

/**
 * GET /api/leave/balances
 * Get leave balances (scope-filtered by user's location access)
 */
export async function GET(request: NextRequest) {
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
        return unauthorizedResponse('You do not have permission to view leave balances');
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id') || user.id; // Default to current user
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);

    // If requesting another user's balance, check permission
    if (user_id !== user.id) {
      try {
        await requirePermission(user, 'leave.balances.read', { locationId });
      } catch {
        return unauthorizedResponse('You do not have permission to view other users\' leave balances');
      }
    }

    // Get leave balances
    const balances = await getUserLeaveBalances(user_id, year);

    return successResponse({
      user_id,
      year,
      balances,
    });
  } catch (error: any) {
    console.error('Get leave balances error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
