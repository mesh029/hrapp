import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { getAuditLogById } from '@/lib/services/audit';

/**
 * GET /api/audit-logs/:id
 * Get audit log details (admin only)
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

    // Check permission (admin only)
    const hasPermission = await requirePermission(request, user.id, 'audit.read');
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const { id } = params;

    const log = await getAuditLogById(id);

    if (!log) {
      return errorResponse('Audit log not found', 404);
    }

    return successResponse(log);
  } catch (error: any) {
    console.error('Error getting audit log:', error);
    return errorResponse(error.message || 'Failed to get audit log', 500);
  }
}
