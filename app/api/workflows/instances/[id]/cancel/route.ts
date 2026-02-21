import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { cancelWorkflowInstance } from '@/lib/services/workflow';

/**
 * POST /api/workflows/instances/[id]/cancel
 * Cancel a workflow instance
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid workflow instance ID', 400);
    }

    // Cancel workflow instance
    await cancelWorkflowInstance(params.id, user.id);

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
      },
    });

    return successResponse(updatedInstance);
  } catch (error: any) {
    console.error('Cancel workflow instance error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
