import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { invalidateCache } from '@/lib/utils/cache-invalidation';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one timesheet ID is required'),
});

/**
 * POST /api/timesheets/bulk-delete
 * Soft delete multiple timesheets (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - admin only
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    // Check for timesheet.delete permission or system.admin
    const hasDeletePermission = await checkPermission(user, 'timesheet.delete', { locationId });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });

    if (!hasDeletePermission && !isAdmin) {
      return errorResponse('Forbidden: Only administrators can delete timesheets', 403);
    }

    const body = await request.json();
    const validation = bulkDeleteSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const { ids } = validation.data;

    // Check if all timesheets exist and are not already deleted
    const existingTimesheets = await prisma.timesheet.findMany({
      where: {
        id: { in: ids },
        deleted_at: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingTimesheets.length === 0) {
      return errorResponse('No valid timesheets found to delete', 404);
    }

    // Soft delete all valid timesheets
    const result = await prisma.timesheet.updateMany({
      where: {
        id: { in: existingTimesheets.map(t => t.id) },
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
      },
    });

    // Invalidate cache for timesheets and dashboard
    await invalidateCache('timesheet:*').catch(err => console.error('Cache invalidation error:', err));
    await invalidateCache('dashboard:*').catch(err => console.error('Cache invalidation error:', err));

    return successResponse({
      deletedCount: result.count,
      requestedCount: ids.length,
      validCount: existingTimesheets.length,
    }, `Successfully deleted ${result.count} timesheet(s)`);
  } catch (error: any) {
    console.error('Bulk delete timesheets error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return errorResponse(error.message, 403);
    }
    return errorResponse(error.message || 'Failed to delete timesheets', 500);
  }
}
