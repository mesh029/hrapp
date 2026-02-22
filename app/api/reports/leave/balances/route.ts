import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { getLeaveBalanceSummary } from '@/lib/services/reporting';

/**
 * GET /api/reports/leave/balances
 * Get leave balance summary report
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

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
      await requirePermission(user, 'leave.read', { locationId });
    } catch {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const reportLocationId = searchParams.get('location_id') || undefined;
    const staffTypeId = searchParams.get('staff_type_id') || undefined;
    const leaveTypeId = searchParams.get('leave_type_id') || undefined;
    const userId = searchParams.get('user_id') || undefined;

    const report = await getLeaveBalanceSummary({
      locationId: reportLocationId,
      staffTypeId: staffTypeId,
      leaveTypeId,
      userId,
    });

    return successResponse(report);
  } catch (error: any) {
    console.error('Error getting leave balance summary:', error);
    return errorResponse(error.message || 'Failed to get leave balance summary', 500);
  }
}
