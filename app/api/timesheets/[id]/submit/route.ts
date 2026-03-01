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

    const hasSubmitPermission =
      (await checkPermission(user, 'timesheet.submit', { locationId: locationId_hasPermission })) ||
      (await checkPermission(user, 'timesheet.create', { locationId: locationId_hasPermission })) ||
      (await checkPermission(user, 'system.admin', { locationId: locationId_hasPermission }));
    if (!hasSubmitPermission) {
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

    // ENHANCED: Validate timesheet with detailed error messages
    const { canSubmit, validation } = await canSubmitTimesheet(params.id);
    if (!canSubmit) {
      // Extract detailed validation errors
      const validationErrors: string[] = [];
      
      if (validation.notes && validation.notes.length > 0) {
        validation.notes.forEach((note: any) => {
          if (typeof note === 'string') {
            validationErrors.push(note);
          } else if (note.issue) {
            validationErrors.push(note.issue);
          } else if (note.message) {
            validationErrors.push(note.message);
          }
        });
      }
      
      if (validation.errors && Array.isArray(validation.errors)) {
        validation.errors.forEach((err: any) => {
          if (typeof err === 'string') {
            validationErrors.push(err);
          } else if (err.issue) {
            validationErrors.push(err.issue);
          }
        });
      }
      
      const errorMessage = validationErrors.length > 0
        ? `Timesheet validation failed: ${validationErrors.join('; ')}`
        : 'Timesheet validation failed. Please check all entries and ensure required hours are filled.';
      
      return errorResponse(
        errorMessage,
        400,
        { 
          errors: validationErrors,
          validation: validation,
        }
      );
    }

    // ENHANCED: Check if submission is enabled for this period with better error message
    const period = await prisma.timesheetPeriod.findFirst({
      where: {
        period_start: { lte: timesheet.period_start },
        period_end: { gte: timesheet.period_end },
        submission_enabled: true,
      },
    });

    if (!period) {
      // Check if period exists but is disabled
      const disabledPeriod = await prisma.timesheetPeriod.findFirst({
        where: {
          period_start: { lte: timesheet.period_start },
          period_end: { gte: timesheet.period_end },
        },
      });

      if (disabledPeriod) {
        return errorResponse(
          `Timesheet submission is disabled for this period (${new Date(timesheet.period_start).toLocaleDateString()} - ${new Date(timesheet.period_end).toLocaleDateString()}). Please contact your manager to enable submission for this period.`,
          400,
          {
            period_start: timesheet.period_start,
            period_end: timesheet.period_end,
            submission_enabled: false,
          }
        );
      } else {
        return errorResponse(
          `No timesheet period found for this period (${new Date(timesheet.period_start).toLocaleDateString()} - ${new Date(timesheet.period_end).toLocaleDateString()}). Please contact your manager to set up a timesheet period.`,
          400,
          {
            period_start: timesheet.period_start,
            period_end: timesheet.period_end,
            period_exists: false,
          }
        );
      }
    }

    // Get timesheet owner's staff type for template matching
    const timesheetOwner = await prisma.user.findUnique({
      where: { id: timesheet.user_id },
      select: { staff_type_id: true },
    });

    // Find workflow template matching location and staff type
    const { findWorkflowTemplate, createWorkflowInstance } = await import('@/lib/services/workflow');
    const templateId = await findWorkflowTemplate({
      resourceType: 'timesheet',
      locationId: timesheet.location_id,
      staffTypeId: timesheetOwner?.staff_type_id || null,
    });

    if (!templateId) {
      return errorResponse('No workflow template found matching this timesheet criteria (location, employee type)', 404);
    }

    // Create workflow instance
    const workflowInstanceId = await createWorkflowInstance({
      templateId: templateId,
      resourceType: 'timesheet',
      resourceId: timesheet.id,
      createdBy: user.id, // authenticated user (may be admin submitting on behalf)
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
