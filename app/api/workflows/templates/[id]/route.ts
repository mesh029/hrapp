import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { updateWorkflowTemplateSchema, uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/workflows/templates/[id]
 * Get a single workflow template by ID
 */
export async function GET(
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
      await requirePermission(user, 'workflows.templates.read', { locationId });
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
        return unauthorizedResponse('You do not have permission to view workflow templates');
      }
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid workflow template ID', 400);
    }

    // Get template
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        steps: {
          orderBy: { step_order: 'asc' },
        },
        _count: {
          select: {
            instances: true,
          },
        },
      },
    });

    if (!template) {
      return notFoundResponse('Workflow template not found');
    }

    return successResponse(template);
  } catch (error: any) {
    console.error('Get workflow template error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * PATCH /api/workflows/templates/[id]
 * Update a workflow template
 */
export async function PATCH(
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
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid workflow template ID', 400);
    }

    const body = await request.json();
    const validation = updateWorkflowTemplateSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if template exists
    const existing = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            instances: true,
          },
        },
      },
    });

    if (!existing) {
      return notFoundResponse('Workflow template not found');
    }

    // If template has active instances, create new version instead of updating
    if (validation.data.status === 'deprecated' && existing._count.instances > 0) {
      // Check for active instances
      const activeInstances = await prisma.workflowInstance.count({
        where: {
          workflow_template_id: params.id,
          status: {
            in: ['Draft', 'Submitted', 'UnderReview'],
          },
        },
      });

      if (activeInstances > 0) {
        return errorResponse('Cannot deprecate template with active workflow instances', 400);
      }
    }

    // Update template
    const template = await prisma.workflowTemplate.update({
      where: { id: params.id },
      data: {
        ...(validation.data.name && { name: validation.data.name }),
        ...(validation.data.status && { status: validation.data.status }),
      },
      include: {
        location: {
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

    return successResponse(template);
  } catch (error: any) {
    console.error('Update workflow template error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
