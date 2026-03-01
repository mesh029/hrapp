import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { checkPermission } from '@/lib/middleware/permissions';
import { bulkResetLeaveBalances } from '@/lib/services/contract-leave-management';
import { bulkResetLeaveBalanceSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';

/**
 * POST /api/leave/balances/bulk-reset
 * Bulk reset leave balances by filters (role, category, staff type, or individual users)
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
      return errorResponse('Forbidden: Only administrators can bulk reset leave balances', 403);
    }

    const body = await request.json();
    const validated = bulkResetLeaveBalanceSchema.parse(body);

    const result = await bulkResetLeaveBalances(
      {
        user_ids: validated.user_ids,
        role_ids: validated.role_ids,
        category_ids: validated.category_ids,
        staff_type_ids: validated.staff_type_ids,
        leave_type_id: validated.leave_type_id || null,
      },
      validated.reason,
      user.id
    );

    return successResponse(result, `Successfully reset ${result.reset} leave balances. ${result.errors} errors occurred.`);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to bulk reset leave balances', 500);
  }
}
