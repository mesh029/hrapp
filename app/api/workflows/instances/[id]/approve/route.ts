import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { approveWorkflowSchema, uuidSchema } from '@/lib/utils/validation';
import { approveWorkflowStep } from '@/lib/services/workflow';

/**
 * POST /api/workflows/instances/[id]/approve
 * Approve a workflow step
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid workflow instance ID', 400);
    }

    const body = await request.json();
    const validation = approveWorkflowSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Get IP address and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Approve workflow step
    await approveWorkflowStep({
      instanceId: params.id,
      userId: user.id,
      locationId,
      comment: validation.data.comment,
      ipAddress,
      userAgent,
    });

    // Fetch updated instance
    const updatedInstance = await prisma.workflowInstance.findUnique({
      where: { id: params.id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
        steps: {
          orderBy: { step_order: 'asc' },
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return successResponse(updatedInstance);
  } catch (error: any) {
    console.error('Approve workflow step error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
