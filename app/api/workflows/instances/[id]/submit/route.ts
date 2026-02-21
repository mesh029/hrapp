import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { submitWorkflowInstance } from '@/lib/services/workflow';

/**
 * POST /api/workflows/instances/[id]/submit
 * Submit a workflow instance for approval
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

    // Check if instance exists and user is creator
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: params.id },
    });

    if (!instance) {
      return notFoundResponse('Workflow instance not found');
    }

    if (instance.created_by !== user.id) {
      return unauthorizedResponse('Only the creator can submit the workflow instance');
    }

    // Submit workflow
    await submitWorkflowInstance(params.id);

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
        },
      },
    });

    return successResponse(updatedInstance);
  } catch (error: any) {
    console.error('Submit workflow instance error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
