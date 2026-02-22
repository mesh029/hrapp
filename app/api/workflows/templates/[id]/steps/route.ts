import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { createWorkflowStepSchema, uuidSchema } from '@/lib/utils/validation';

/**
 * POST /api/workflows/templates/[id]/steps
 * Add a workflow step to a template
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

    try {
      await requirePermission(user, 'workflows.templates.update', { locationId });
    } catch {
      const hasSystemAdmin = await prisma.userRole.findFirst({
        where: {
          user_id: user.id,
          deleted_at: null,
          role: {
            status: 'active',
            role_permissions: {
              some: {
                permission: {
                  name: 'system.admin',
                },
              },
            },
          },
        },
      });

      if (!hasSystemAdmin) {
        return unauthorizedResponse('You do not have permission to update workflow templates');
      }
    }

    // Validate UUID
    const templateValidation = uuidSchema.safeParse(params.id);
    if (!templateValidation.success) {
      return errorResponse('Invalid workflow template ID', 400);
    }

    const body = await request.json();
    const validation = createWorkflowStepSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if template exists
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      include: {
        steps: {
          orderBy: { step_order: 'asc' },
        },
      },
    });

    if (!template) {
      return notFoundResponse('Workflow template not found');
    }

    // Check if step order already exists
    const existingStep = template.steps.find((s) => s.step_order === validation.data.step_order);
    if (existingStep) {
      return errorResponse(`Step order ${validation.data.step_order} already exists`, 409);
    }

    // Validate permission exists
    const permission = await prisma.permission.findUnique({
      where: { name: validation.data.required_permission },
    });

    if (!permission) {
      return errorResponse(`Permission not found: ${validation.data.required_permission}`, 400);
    }

    // Create step
    const step = await prisma.workflowStep.create({
      data: {
        workflow_template_id: params.id,
        step_order: validation.data.step_order,
        required_permission: validation.data.required_permission,
        allow_decline: validation.data.allow_decline,
        allow_adjust: validation.data.allow_adjust,
      },
    });

    return successResponse(step, undefined, 201);
  } catch (error: any) {
    console.error('Create workflow step error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    if (error.code === 'P2002') {
      return errorResponse('Step order already exists for this template', 409);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
