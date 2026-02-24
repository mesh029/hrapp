import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { updateWorkflowStepSchema, uuidSchema } from '@/lib/utils/validation';

/**
 * PATCH /api/workflows/templates/[id]/steps/[stepId]
 * Update a workflow step
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; stepId: string } }
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

    // Validate UUIDs
    const templateValidation = uuidSchema.safeParse(params.id);
    const stepValidation = uuidSchema.safeParse(params.stepId);
    
    if (!templateValidation.success || !stepValidation.success) {
      return errorResponse('Invalid workflow template ID or step ID', 400);
    }

    const body = await request.json();
    const validation = updateWorkflowStepSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if step exists and belongs to template
    const step = await prisma.workflowStep.findUnique({
      where: { id: params.stepId },
    });

    if (!step || step.workflow_template_id !== params.id) {
      return notFoundResponse('Workflow step not found');
    }

    // If updating step_order, check for conflicts
    if (validation.data.step_order !== undefined && validation.data.step_order !== step.step_order) {
      const template = await prisma.workflowTemplate.findUnique({
        where: { id: params.id },
        include: {
          steps: true,
        },
      });

      const existingStep = template?.steps.find((s) => s.step_order === validation.data.step_order && s.id !== params.stepId);
      if (existingStep) {
        return errorResponse(`Step order ${validation.data.step_order} already exists`, 409);
      }
    }

    // Validate permission if provided
    if (validation.data.required_permission) {
      const permission = await prisma.permission.findUnique({
        where: { name: validation.data.required_permission },
      });

      if (!permission) {
        return errorResponse(`Permission not found: ${validation.data.required_permission}`, 400);
      }
    }

    // Get template ID for scope syncing
    const existingStep = await prisma.workflowStep.findUnique({
      where: { id: params.stepId },
      select: { workflow_template_id: true },
    });

    if (!existingStep) {
      return notFoundResponse('Workflow step not found');
    }

    // Update step
    const updatedStep = await prisma.workflowStep.update({
      where: { id: params.stepId },
      data: {
        ...(validation.data.step_order !== undefined && { step_order: validation.data.step_order }),
        ...(validation.data.required_permission && { required_permission: validation.data.required_permission }),
        ...(validation.data.allow_decline !== undefined && { allow_decline: validation.data.allow_decline }),
        ...(validation.data.allow_adjust !== undefined && { allow_adjust: validation.data.allow_adjust }),
        ...(validation.data.approver_strategy !== undefined && { approver_strategy: validation.data.approver_strategy }),
        ...(validation.data.include_manager !== undefined && { include_manager: validation.data.include_manager }),
        ...(validation.data.required_roles !== undefined && { 
          required_roles: (validation.data.required_roles && validation.data.required_roles.length > 0)
            ? JSON.stringify(validation.data.required_roles)
            : null 
        }),
        ...(validation.data.location_scope !== undefined && { location_scope: validation.data.location_scope }),
        ...(validation.data.conditional_rules !== undefined && { 
          conditional_rules: (validation.data.conditional_rules && validation.data.conditional_rules.length > 0)
            ? JSON.stringify(validation.data.conditional_rules)
            : null 
        }),
      },
    });

    // Sync UserPermissionScope entries if roles or location_scope changed
    if (validation.data.required_roles !== undefined || validation.data.location_scope !== undefined) {
      const rolesToSync = validation.data.required_roles || 
        (updatedStep.required_roles ? JSON.parse(updatedStep.required_roles as string) : []);
      
      if (rolesToSync.length > 0) {
        try {
          const { syncScopesForWorkflowStep } = await import('@/lib/utils/sync-workflow-scopes');
          const result = await syncScopesForWorkflowStep(params.stepId, existingStep.workflow_template_id);
          console.log(`[Workflow Step] Updated scopes: created ${result.created}, skipped ${result.skipped}, errors: ${result.errors} for step ${updatedStep.step_order}`);
        } catch (syncError: any) {
          // Log error but don't fail the request
          console.error('[Workflow Step] Failed to sync scopes:', syncError.message);
        }
      }
    }

    return successResponse(updatedStep);
  } catch (error: any) {
    console.error('Update workflow step error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    if (error.code === 'P2002') {
      return errorResponse('Step order already exists for this template', 409);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * DELETE /api/workflows/templates/[id]/steps/[stepId]
 * Remove a workflow step
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; stepId: string } }
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

    // Validate UUIDs
    const templateValidation = uuidSchema.safeParse(params.id);
    const stepValidation = uuidSchema.safeParse(params.stepId);
    
    if (!templateValidation.success || !stepValidation.success) {
      return errorResponse('Invalid workflow template ID or step ID', 400);
    }

    // Check if step exists and belongs to template
    const step = await prisma.workflowStep.findUnique({
      where: { id: params.stepId },
    });

    if (!step || step.workflow_template_id !== params.id) {
      return notFoundResponse('Workflow step not found');
    }

    // Check if template has active instances (we allow deletion even with instances due to version isolation)
    // But we should warn if there are active instances

    // Delete step
    await prisma.workflowStep.delete({
      where: { id: params.stepId },
    });

    return successResponse({ message: 'Workflow step deleted successfully' });
  } catch (error: any) {
    console.error('Delete workflow step error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
