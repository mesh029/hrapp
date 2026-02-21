import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { enableTimesheetSubmissionSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * POST /api/timesheets/periods/enable
 * Enable or disable timesheet submission for a period
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission (managers only)
    const hasPermission = await checkPermission(user.id, 'timesheets.manage', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const body = await request.json();
    const validated = enableTimesheetSubmissionSchema.parse(body);

    // Find or create period
    const existing = await prisma.timesheetPeriod.findFirst({
      where: {
        period_start: new Date(validated.period_start),
        period_end: new Date(validated.period_end),
      },
    });

    let period;
    if (existing) {
      period = await prisma.timesheetPeriod.update({
        where: { id: existing.id },
        data: {
          submission_enabled: validated.submission_enabled,
          enabled_at: validated.submission_enabled ? new Date() : null,
          enabled_by: validated.submission_enabled ? user.id : null,
        },
      });
    } else {
      period = await prisma.timesheetPeriod.create({
        data: {
          period_start: new Date(validated.period_start),
          period_end: new Date(validated.period_end),
          submission_enabled: validated.submission_enabled,
          enabled_at: validated.submission_enabled ? new Date() : null,
          enabled_by: validated.submission_enabled ? user.id : null,
        },
      });
    }

    return successResponse(period, `Timesheet submission ${validated.submission_enabled ? 'enabled' : 'disabled'} successfully`);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to update timesheet period', 500);
  }
}
