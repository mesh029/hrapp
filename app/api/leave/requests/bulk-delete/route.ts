import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { invalidateCache } from '@/lib/utils/cache-invalidation';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one leave request ID is required'),
});

/**
 * POST /api/leave/requests/bulk-delete
 * Soft delete multiple leave requests (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission for admin
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    // Check for system.admin permission
    const isAdmin = await prisma.userRole.findFirst({
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

    if (!isAdmin) {
      return errorResponse('Forbidden: Only administrators can delete leave requests', 403);
    }

    const body = await request.json();
    const validation = bulkDeleteSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const { ids } = validation.data;

    // Check if all leave requests exist and are not already deleted
    const existingLeaveRequests = await prisma.leaveRequest.findMany({
      where: {
        id: { in: ids },
        deleted_at: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingLeaveRequests.length === 0) {
      return errorResponse('No valid leave requests found to delete', 404);
    }

    // Soft delete all valid leave requests
    const result = await prisma.leaveRequest.updateMany({
      where: {
        id: { in: existingLeaveRequests.map(lr => lr.id) },
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
      },
    });

    // Invalidate cache for leave requests and dashboard
    await invalidateCache('leave:requests:*').catch(err => console.error('Cache invalidation error:', err));
    await invalidateCache('dashboard:*').catch(err => console.error('Cache invalidation error:', err));

    return successResponse({
      deletedCount: result.count,
      requestedCount: ids.length,
      validCount: existingLeaveRequests.length,
    }, `Successfully deleted ${result.count} leave request(s)`);
  } catch (error: any) {
    console.error('Bulk delete leave requests error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return errorResponse(error.message, 403);
    }
    return errorResponse(error.message || 'Failed to delete leave requests', 500);
  }
}
