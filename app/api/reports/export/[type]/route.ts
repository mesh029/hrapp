import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/utils/responses';
import {
  getLeaveUtilization,
  getLeaveBalanceSummary,
  getTimesheetSummary,
} from '@/lib/services/reporting';
import {
  leaveUtilizationToCSV,
  leaveBalanceToCSV,
  timesheetSummaryToCSV,
} from '@/lib/utils/csv-export';

/**
 * GET /api/reports/export/:type
 * Export report as CSV
 * 
 * Types: leave-utilization, leave-balances, timesheets
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { type } = params;
    const { searchParams } = new URL(request.url);

    let csv: string;
    let filename: string;

    switch (type) {
      case 'leave-utilization': {
        // Check permission
        const userWithLocation = await prisma.user.findUnique({
          where: { id: user.id },
          select: { primary_location_id: true },
        });

        const permissionLocationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
        
        if (!permissionLocationId) {
          return errorResponse('No location available for permission check', 400);
        }

        try {
          await requirePermission(user, 'leave.read', { locationId: permissionLocationId });
        } catch {
          return errorResponse('Forbidden: Insufficient permissions', 403);
        }

        const locationId = searchParams.get('location_id') || undefined;
        const staffTypeId = searchParams.get('staff_type_id') || undefined;
        const leaveTypeId = searchParams.get('leave_type_id') || undefined;
        const userId = searchParams.get('user_id') || undefined;
        const startDate = searchParams.get('start_date') ? new Date(searchParams.get('start_date')!) : undefined;
        const endDate = searchParams.get('end_date') ? new Date(searchParams.get('end_date')!) : undefined;

        const report = await getLeaveUtilization({
          locationId,
          staffTypeId: staffTypeId,
          leaveTypeId,
          userId,
          startDate,
          endDate,
        });

        csv = leaveUtilizationToCSV(report);
        filename = `leave-utilization-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'leave-balances': {
        // Check permission
        const userWithLocation = await prisma.user.findUnique({
          where: { id: user.id },
          select: { primary_location_id: true },
        });

        const permissionLocationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
        
        if (!permissionLocationId) {
          return errorResponse('No location available for permission check', 400);
        }

        try {
          await requirePermission(user, 'leave.read', { locationId: permissionLocationId });
        } catch {
          return errorResponse('Forbidden: Insufficient permissions', 403);
        }

        const locationId = searchParams.get('location_id') || undefined;
        const staffTypeId = searchParams.get('staff_type_id') || undefined;
        const leaveTypeId = searchParams.get('leave_type_id') || undefined;
        const userId = searchParams.get('user_id') || undefined;

        const report = await getLeaveBalanceSummary({
          locationId,
          staffTypeId: staffTypeId,
          leaveTypeId,
          userId,
        });

        csv = leaveBalanceToCSV(report);
        filename = `leave-balances-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'timesheets': {
        // Check permission
        const userWithLocation = await prisma.user.findUnique({
          where: { id: user.id },
          select: { primary_location_id: true },
        });

        const permissionLocationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
        
        if (!permissionLocationId) {
          return errorResponse('No location available for permission check', 400);
        }

        try {
          await requirePermission(user, 'timesheet.read', { locationId: permissionLocationId });
        } catch {
          return errorResponse('Forbidden: Insufficient permissions', 403);
        }

        const locationId = searchParams.get('location_id') || undefined;
        const staffTypeId = searchParams.get('staff_type_id') || undefined;
        const userId = searchParams.get('user_id') || undefined;
        const status = searchParams.get('status') || undefined;
        const startDate = searchParams.get('start_date') ? new Date(searchParams.get('start_date')!) : undefined;
        const endDate = searchParams.get('end_date') ? new Date(searchParams.get('end_date')!) : undefined;

        const report = await getTimesheetSummary({
          locationId,
          staffTypeId: staffTypeId,
          userId,
          status,
          startDate,
          endDate,
        });

        csv = timesheetSummaryToCSV(report);
        filename = `timesheets-summary-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      default:
        return errorResponse('Invalid export type', 400);
    }

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting report:', error);
    return errorResponse(error.message || 'Failed to export report', 500);
  }
}
