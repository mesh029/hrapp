import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { checkPermission } from '@/lib/middleware/permissions';
import { adjustLeaveBalance, getAdjustmentHistory } from '@/lib/services/leave-balance-adjustment';
import { adjustLeaveBalanceSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';

/**
 * POST /api/leave/balances/adjust
 * Adjust leave balance (add or subtract days)
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

    // Primary location is now required for all users
    if (!userWithLocation?.primary_location_id) {
      return errorResponse('User must have a primary location assigned. Please contact your administrator.', 400);
    }

    const locationId = userWithLocation.primary_location_id;

    // Check for leave.balances.manage or system.admin permission
    const hasManagePermission = await checkPermission(user, 'leave.balances.manage', { locationId });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });
    
    if (!hasManagePermission && !isAdmin) {
      return errorResponse('Forbidden: Only administrators can adjust leave balances', 403);
    }

    const body = await request.json();
    const validated = adjustLeaveBalanceSchema.parse(body);

    await adjustLeaveBalance(
      validated.user_id,
      validated.leave_type_id,
      validated.year,
      validated.days,
      validated.reason,
      user.id
    );

    return successResponse(null, 'Leave balance adjusted successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to adjust leave balance', 500);
  }
}

/**
 * GET /api/leave/balances/adjust
 * Get adjustment history
 */
export async function GET(request: NextRequest) {
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

    // Primary location is now required for all users
    if (!userWithLocation?.primary_location_id) {
      return errorResponse('User must have a primary location assigned. Please contact your administrator.', 400);
    }

    const locationId = userWithLocation.primary_location_id;

    // Check for leave.balances.manage or system.admin permission
    const hasManagePermission = await checkPermission(user, 'leave.balances.manage', { locationId });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });
    
    if (!hasManagePermission && !isAdmin) {
      return errorResponse('Forbidden: Only administrators can view adjustment history', 403);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const leaveTypeId = searchParams.get('leave_type_id');
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;

    if (!userId) {
      return errorResponse('user_id query parameter is required', 400);
    }

    const history = await getAdjustmentHistory(
      userId,
      leaveTypeId ?? undefined,
      year
    );

    return successResponse(history, 'Adjustment history retrieved successfully');
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to retrieve adjustment history', 500);
  }
}
