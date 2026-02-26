import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { declineWeekendExtraSchema, uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * POST /api/timesheets/weekend-extra/:requestId/decline
 * Decline weekend extra request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission (managers or timesheet approvers)
    // Check permission
    const userWithLocation_hasPermission = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId_hasPermission = userWithLocation_hasPermission?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId_hasPermission) {
      return errorResponse('No location available for permission check', 400);
    }

    const hasPermission = await checkPermission(user, 'timesheet.approve', { locationId: locationId_hasPermission });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.requestId);
    const body = await request.json();
    const validated = declineWeekendExtraSchema.parse(body);

    // Get request
    const extraRequest = await prisma.weekendExtraRequest.findUnique({
      where: { id: params.requestId },
    });

    if (!extraRequest) {
      return errorResponse('Weekend extra request not found', 404);
    }

    if (extraRequest.status !== 'pending') {
      return errorResponse('Request is not pending', 400);
    }

    // Update request
    const updated = await prisma.weekendExtraRequest.update({
      where: { id: params.requestId },
      data: {
        status: 'declined',
        declined_reason: validated.declined_reason,
      },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return successResponse(updated, 'Weekend extra request declined successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to decline weekend extra request', 500);
  }
}
