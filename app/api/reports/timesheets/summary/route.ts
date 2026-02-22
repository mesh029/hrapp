import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { getTimesheetSummary } from '@/lib/services/reporting';

/**
 * GET /api/reports/timesheets/summary
 * Get timesheet summary report
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
      await requirePermission(user, 'timesheet.read', { locationId });
    } catch {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const reportLocationId = searchParams.get('location_id') || undefined;
    const staffTypeId = searchParams.get('staff_type_id') || undefined;
    const userId = searchParams.get('user_id') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('start_date') ? new Date(searchParams.get('start_date')!) : undefined;
    const endDate = searchParams.get('end_date') ? new Date(searchParams.get('end_date')!) : undefined;

    const report = await getTimesheetSummary({
      locationId: reportLocationId,
      staffTypeId: staffTypeId,
      userId,
      status,
      startDate,
      endDate,
    });

    return successResponse(report);
  } catch (error: any) {
    console.error('Error getting timesheet summary:', error);
    return errorResponse(error.message || 'Failed to get timesheet summary', 500);
  }
}
