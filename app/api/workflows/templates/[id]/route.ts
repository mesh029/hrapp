import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { updateWorkflowTemplateSchema, uuidSchema } from '@/lib/utils/validation';

/**
 * Route matcher to exclude 'preview-approvers' from this dynamic route
 */
export const dynamicParams = false;

/**
 * GET /api/workflows/templates/[id]
 * Get a single workflow template by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Exclude 'preview-approvers' from this route
  if (params.id === 'preview-approvers') {
    return errorResponse('Not found', 404);
  }

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

    // Parse JSON fields in steps
    const templateWithParsedSteps = {
      ...template,
      steps: template.steps.map(step => ({
        ...step,
        required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
        conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
      })),
    };

    return successResponse(templateWithParsedSteps);
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
  // Exclude 'preview-approvers' from this route
  if (params.id === 'preview-approvers') {
    return errorResponse('Not found', 404);
  }

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

    await requirePermission(user, 'workflows.templates.update', { locationId });

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

    // Check template exists
    const existingTemplate = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
    });

    if (!existingTemplate) {
      return notFoundResponse('Workflow template not found');
    }

    // Update template
    const updatedTemplate = await prisma.workflowTemplate.update({
      where: { id: params.id },
      data: {
        ...(validation.data.name !== undefined && { name: validation.data.name }),
        ...(validation.data.status !== undefined && { status: validation.data.status }),
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

    // Parse JSON fields
    const templateWithParsedSteps = {
      ...updatedTemplate,
      steps: updatedTemplate.steps.map(step => ({
        ...step,
        required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
        conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
      })),
    };

    return successResponse(templateWithParsedSteps);
  } catch (error: any) {
    console.error('Update workflow template error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * DELETE /api/workflows/templates/[id]
 * Delete a workflow template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Exclude 'preview-approvers' from this route
  if (params.id === 'preview-approvers') {
    return errorResponse('Not found', 404);
  }

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

    await requirePermission(user, 'workflows.templates.delete', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid workflow template ID', 400);
    }

    // Check template exists
    const existingTemplate = await prisma.workflowTemplate.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            instances: true,
          },
        },
      },
    });

    if (!existingTemplate) {
      return notFoundResponse('Workflow template not found');
    }

    // Check if template has instances
    if (existingTemplate._count.instances > 0) {
      return errorResponse('Cannot delete template with active instances. Deprecate it instead.', 400);
    }

    // Delete template (cascade will delete steps)
    await prisma.workflowTemplate.delete({
      where: { id: params.id },
    });

    return successResponse({ message: 'Template deleted successfully' });
  } catch (error: any) {
    console.error('Delete workflow template error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
