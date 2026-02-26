import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { getDashboardData } from '@/lib/services/reporting';

/**
 * GET /api/reports/dashboard
 * Get dashboard data (aggregated metrics)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const reportLocationId = searchParams.get('location_id') || undefined;
    const staffTypeId = searchParams.get('staff_type_id') || undefined;
    const requestedUserId = searchParams.get('user_id') || undefined; // For employee-specific data
    const startDate = searchParams.get('start_date') ? new Date(searchParams.get('start_date')!) : undefined;
    const endDate = searchParams.get('end_date') ? new Date(searchParams.get('end_date')!) : undefined;

    // Resolve current user's primary location for scope checks
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    // Check if user is admin
    const { checkPermission } = await import('@/lib/middleware/permissions');
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });
    const isSelfDashboardRequest = !requestedUserId || requestedUserId === user.id;

    // Non-admins can always view their own dashboard.
    // Cross-user reporting still requires read permissions.
    if (!isAdmin && !isSelfDashboardRequest) {
      try {
        await requirePermission(user, 'leave.read', { locationId });
      } catch {
        // Try timesheet.read as fallback
        try {
          await requirePermission(user, 'timesheet.read', { locationId });
        } catch {
          return errorResponse('Forbidden: Insufficient permissions', 403);
        }
      }
    }

    // Determine scope based on user permissions
    let effectiveLocationId = reportLocationId;
    let effectiveUserId = requestedUserId;
    
    // If user is admin, show all data (no filters unless explicitly specified)
    if (isAdmin) {
      // Admin can see everything - use provided filters or show all
      effectiveLocationId = reportLocationId; // Use provided location or show all
      effectiveUserId = requestedUserId; // Use provided user or show all
    } else {
      // Non-admin users: filter by their scope
      if (!effectiveLocationId && userWithLocation?.primary_location_id) {
        effectiveLocationId = userWithLocation.primary_location_id;
      }
      
      // If no userId provided and user is not admin, filter to their own data
      // (unless they have approval permissions, in which case they see team/location data)
      const hasApprovalPermission = await checkPermission(user, 'leave.approve', { locationId }) ||
                                    await checkPermission(user, 'timesheet.approve', { locationId });
      
      if (!effectiveUserId && !hasApprovalPermission) {
        // Employee: show only their own data
        effectiveUserId = user.id;
      }
      // Managers/HR: show team/location data (no userId filter)
    }

    const dashboard = await getDashboardData({
      locationId: effectiveLocationId,
      staffTypeId: staffTypeId,
      userId: effectiveUserId, // Pass user ID for employee-specific filtering
      startDate,
      endDate,
    });

    return successResponse(dashboard);
  } catch (error: any) {
    console.error('Error getting dashboard data:', error);
    return errorResponse(error.message || 'Failed to get dashboard data', 500);
  }
}
