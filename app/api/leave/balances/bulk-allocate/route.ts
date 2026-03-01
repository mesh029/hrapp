import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { checkPermission } from '@/lib/middleware/permissions';
import { bulkAllocateLeaveDays } from '@/lib/services/contract-leave-management';
import { bulkAllocateLeaveBalanceSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';

/**
 * POST /api/leave/balances/bulk-allocate
 * Bulk allocate leave days by filters (role, category, staff type, or individual users)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - allow system.admin or leave.balances.manage
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    if (!userWithLocation?.primary_location_id) {
      return errorResponse('User must have a primary location assigned. Please contact your administrator.', 400);
    }

    const locationId = userWithLocation.primary_location_id;

    const hasManagePermission = await checkPermission(user, 'leave.balances.manage', { locationId });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });
    
    if (!hasManagePermission && !isAdmin) {
      return errorResponse('Forbidden: Only administrators can bulk allocate leave days', 403);
    }

    const body = await request.json();
    const validated = bulkAllocateLeaveBalanceSchema.parse(body);

    const result = await bulkAllocateLeaveDays(
      {
        user_ids: validated.user_ids,
        role_ids: validated.role_ids,
        staff_type_ids: validated.staff_type_ids,
      },
      validated.leave_type_id,
      validated.year,
      validated.days,
      user.id
    );

    return successResponse(result, `Successfully allocated ${validated.days} days to ${result.allocated} users. ${result.errors} errors occurred.`);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to bulk allocate leave days', 500);
  }
}
