import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/timesheets/[id]/workflow
 * Get workflow timeline for a timesheet
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

    uuidSchema.parse(params.id);

    // Get timesheet
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        user_id: true,
      },
    });

    if (!timesheet) {
      return errorResponse('Timesheet not found', 404);
    }

    // Check if user can view this timesheet
    if (timesheet.user_id !== user.id) {
      // TODO: Check if user has permission to view all timesheets
      // For now, allow if user is admin
      const userRoles = await prisma.userRole.findMany({
        where: {
          user_id: user.id,
          deleted_at: null,
        },
        include: {
          role: true,
        },
      });

      const isAdmin = userRoles.some(
        ur => ur.role.name.toLowerCase().includes('admin') && ur.role.status === 'active'
      );

      if (!isAdmin) {
        return errorResponse('Forbidden: You can only view your own timesheets', 403);
      }
    }

    // Find workflow instance for this timesheet
    // Also check if workflow_instance_id is stored on the timesheet
    const timesheetWithWorkflow = await prisma.timesheet.findUnique({
      where: { id: params.id },
      select: { workflow_instance_id: true },
    });

    let workflowInstance = null;
    
    // First try to find by workflow_instance_id if it exists
    if (timesheetWithWorkflow?.workflow_instance_id) {
      workflowInstance = await prisma.workflowInstance.findUnique({
        where: { id: timesheetWithWorkflow.workflow_instance_id },
        include: {
          template: {
            include: {
              steps: {
                orderBy: { step_order: 'asc' },
              },
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
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
    }

    // If not found by workflow_instance_id, try by resource_id and resource_type
    if (!workflowInstance) {
      workflowInstance = await prisma.workflowInstance.findFirst({
        where: {
          resource_id: params.id,
          resource_type: 'timesheet',
        },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
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

    // Debug logging
    if (!workflowInstance) {
      console.log('[Timesheet Workflow] No workflow instance found for timesheet:', params.id);
      console.log('[Timesheet Workflow] Timesheet workflow_instance_id:', timesheetWithWorkflow?.workflow_instance_id);
      
      // Check if any workflow instances exist for this resource
      const anyWorkflows = await prisma.workflowInstance.findMany({
        where: { resource_id: params.id },
        select: { id: true, resource_type: true, status: true },
      });
      console.log('[Timesheet Workflow] Any workflows for this resource:', anyWorkflows);
      
      return successResponse({
        has_workflow: false,
        timeline: [],
      });
    }

    // Build timeline
    const timeline = workflowInstance.template.steps.map((step, index) => {
      const stepInstance = workflowInstance.steps.find(s => s.step_order === step.step_order);
      const isCurrent = workflowInstance.current_step_order === step.step_order;
      const isCompleted = stepInstance?.status === 'approved' || stepInstance?.status === 'declined';
      const isPending = stepInstance?.status === 'pending' && isCurrent;
      const isUpcoming = !stepInstance || (!isCompleted && !isPending);

      return {
        step_order: step.step_order,
        required_permission: step.required_permission,
        allow_decline: step.allow_decline,
        allow_adjust: step.allow_adjust,
        status: stepInstance?.status || 'pending',
        actor: stepInstance?.actor || null,
        acted_at: stepInstance?.acted_at || null,
        comment: stepInstance?.comment || null,
        is_current: isCurrent,
        is_completed: isCompleted,
        is_pending: isPending,
        is_upcoming: isUpcoming,
      };
    });

    return successResponse({
      has_workflow: true,
      workflow_instance_id: workflowInstance.id,
      workflow_status: workflowInstance.status,
      current_step_order: workflowInstance.current_step_order,
      created_at: workflowInstance.created_at,
      updated_at: workflowInstance.updated_at,
      creator: workflowInstance.creator,
      timeline,
    });
  } catch (error: any) {
    console.error('Error getting timesheet workflow:', error);
    return errorResponse(error.message || 'Failed to get workflow timeline', 500);
  }
}
