import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { auditLogFilterSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { getAuditLogs } from '@/lib/services/audit';

/**
 * GET /api/audit-logs
 * List audit logs with filtering (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission (admin only)
    const hasPermission = await requirePermission(request, user.id, 'audit.read');
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const validated = auditLogFilterSchema.parse({
      actor_id: searchParams.get('actor_id') || undefined,
      action: searchParams.get('action') || undefined,
      resource_type: searchParams.get('resource_type') || undefined,
      resource_id: searchParams.get('resource_id') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
    });

    const result = await getAuditLogs({
      actorId: validated.actor_id,
      action: validated.action,
      resourceType: validated.resource_type,
      resourceId: validated.resource_id,
      startDate: validated.start_date,
      endDate: validated.end_date,
      limit: validated.limit,
      offset: (validated.page - 1) * validated.limit,
    });

    return successResponse({
      logs: result.logs,
      pagination: {
        page: validated.page,
        limit: validated.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / validated.limit),
      },
    });
  } catch (error: any) {
    console.error('Error listing audit logs:', error);
    if (error.name === 'ZodError') {
      return errorResponse('Validation error', 400, error.errors);
    }
    return errorResponse(error.message || 'Failed to list audit logs', 500);
  }
}
