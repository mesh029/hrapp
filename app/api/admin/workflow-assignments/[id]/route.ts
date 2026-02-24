import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { z } from 'zod';
import { uuidSchema } from '@/lib/utils/validation';

const updateAssignmentSchema = z.object({
  location_id: z.string().uuid().optional(),
  workflow_template_id: z.string().uuid().optional(),
  notes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * PATCH /api/admin/workflow-assignments/[id]
 * Update a workflow template assignment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Check permission (admin only)
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    const { checkPermission } = await import('@/lib/middleware/permissions');
    const hasPermission = await checkPermission(user, 'system.admin', { locationId });
    if (!hasPermission) {
      return unauthorizedResponse('Only administrators can update workflow template assignments');
    }

    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid assignment ID', 400);
    }

    const body = await request.json();
    const validation = updateAssignmentSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if assignment exists
    const existingAssignment = await prisma.workflowTemplateAssignment.findUnique({
      where: { id: params.id },
    });

    if (!existingAssignment) {
      return notFoundResponse('Workflow template assignment not found');
    }

    // If activating, deactivate other active assignments for same location + resource_type
    if (validation.data.status === 'active') {
      await prisma.workflowTemplateAssignment.updateMany({
        where: {
          location_id: existingAssignment.location_id,
          resource_type: existingAssignment.resource_type,
          status: 'active',
          id: { not: params.id },
        },
        data: {
          status: 'inactive',
        },
      });
    }

    // Update assignment
    const updated = await prisma.workflowTemplateAssignment.update({
      where: { id: params.id },
      data: {
        ...(validation.data.location_id && { location_id: validation.data.location_id }),
        ...(validation.data.workflow_template_id && { workflow_template_id: validation.data.workflow_template_id }),
        ...(validation.data.notes !== undefined && { notes: validation.data.notes }),
        ...(validation.data.status && { status: validation.data.status }),
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        workflow_template: {
          select: {
            id: true,
            name: true,
            resource_type: true,
          },
        },
      },
    });

    return successResponse(updated, 'Assignment updated successfully');
  } catch (error: any) {
    console.error('Update workflow assignment error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Failed to update workflow assignment', 500);
  }
}

/**
 * DELETE /api/admin/workflow-assignments/[id]
 * Delete (deactivate) a workflow template assignment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Check permission (admin only)
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    const { checkPermission } = await import('@/lib/middleware/permissions');
    const hasPermission = await checkPermission(user, 'system.admin', { locationId });
    if (!hasPermission) {
      return unauthorizedResponse('Only administrators can delete workflow template assignments');
    }

    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid assignment ID', 400);
    }

    // Check if assignment exists
    const assignment = await prisma.workflowTemplateAssignment.findUnique({
      where: { id: params.id },
    });

    if (!assignment) {
      return notFoundResponse('Workflow template assignment not found');
    }

    // Soft delete by setting status to inactive
    await prisma.workflowTemplateAssignment.update({
      where: { id: params.id },
      data: {
        status: 'inactive',
      },
    });

    return successResponse(null, 'Assignment deactivated successfully');
  } catch (error: any) {
    console.error('Delete workflow assignment error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Failed to delete workflow assignment', 500);
  }
}
