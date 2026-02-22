import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { canSubmitTimesheet } from '@/lib/services/timesheet-validation';
import { submitWorkflowInstance } from '@/lib/services/workflow';
import { uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * POST /api/timesheets/:id/submit
 * Submit timesheet for approval
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    // Check permission
    const userWithLocation_hasPermission = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId_hasPermission = userWithLocation_hasPermission?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId_hasPermission) {
      return errorResponse('No location available for permission check', 400);
    }

    const hasPermission = await checkPermission(user, 'timesheets.submit', { locationId: locationId_hasPermission });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);

    // Get timesheet
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
      include: {
        location: true,
      },
    });

    if (!timesheet || timesheet.deleted_at) {
      return errorResponse('Timesheet not found', 404);
    }

    // Check if user can submit this timesheet
    const isAdmin = await checkPermission(user, 'system.admin', { locationId: locationId_hasPermission });
    if (!isAdmin && timesheet.user_id !== user.id) {
      return errorResponse('Forbidden: You can only submit your own timesheets', 403);
    }

    // Check if timesheet is in draft status
    if (timesheet.status !== 'Draft') {
      return errorResponse('Timesheet can only be submitted when in Draft status', 400);
    }

    // Validate timesheet
    const { canSubmit, validation } = await canSubmitTimesheet(params.id);
    if (!canSubmit) {
      const errorMessage = validation.notes.length > 0 
        ? `Timesheet validation failed: ${validation.notes.join('; ')}`
        : 'Timesheet validation failed';
      return errorResponse(
        errorMessage,
        400,
        { validation: [JSON.stringify(validation)] }
      );
    }

    // Check if submission is enabled for this period
    const period = await prisma.timesheetPeriod.findFirst({
      where: {
        period_start: { lte: timesheet.period_start },
        period_end: { gte: timesheet.period_end },
        submission_enabled: true,
      },
    });

    if (!period) {
      return errorResponse('Timesheet submission is not enabled for this period', 400);
    }

    // Find workflow template for timesheet approval
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'timesheet',
        location_id: timesheet.location_id,
        status: 'active',
      },
      include: {
        steps: {
          orderBy: { step_order: 'asc' },
        },
      },
    });

    if (!template) {
      return errorResponse('No workflow template found for timesheet approval', 404);
    }

    // Create workflow instance
    const { createWorkflowInstance } = await import('@/lib/services/workflow');
    const workflowInstanceId = await createWorkflowInstance({
      templateId: template.id,
      resourceType: 'timesheet',
      resourceId: timesheet.id,
      createdBy: user.id,
      locationId: timesheet.location_id,
    });

    // Submit workflow
    const { submitWorkflowInstance } = await import('@/lib/services/workflow');
    await submitWorkflowInstance(workflowInstanceId);

    // Update timesheet status
    await prisma.timesheet.update({
      where: { id: params.id },
      data: {
        status: 'Submitted',
        workflow_instance_id: workflowInstanceId,
      },
    });

    const updated = await prisma.timesheet.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return successResponse(updated, 'Timesheet submitted successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to submit timesheet', 500);
  }
}
