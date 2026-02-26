import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { checkPermission } from '@/lib/middleware/permissions';
import { canSubmitTimesheet } from '@/lib/services/timesheet-validation';
import { uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';

/**
 * GET /api/timesheets/:id/validate
 * Validate timesheet before submission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    // Check permission
    const userWithLocation_hasPermission = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId_hasPermission = userWithLocation_hasPermission?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId_hasPermission) {
      return errorResponse('No location available for permission check', 400);
    }

    const hasReadPermission = await checkPermission(user, 'timesheet.read', { locationId: locationId_hasPermission });
    const hasCreatePermission = await checkPermission(user, 'timesheet.create', { locationId: locationId_hasPermission });
    const hasSubmitPermission = await checkPermission(user, 'timesheet.submit', { locationId: locationId_hasPermission });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId: locationId_hasPermission });
    if (!hasReadPermission && !hasCreatePermission && !hasSubmitPermission && !isAdmin) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);

    // Use canSubmitTimesheet to get both validation and canSubmit status
    const { canSubmit, validation } = await canSubmitTimesheet(params.id);

    return successResponse({
      canSubmit,
      validation,
    }, 'Timesheet validation completed');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to validate timesheet', 500);
  }
}
