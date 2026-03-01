import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { checkPermission } from '@/lib/middleware/permissions';
import { bulkAssignContracts } from '@/lib/services/contract-leave-management';
import { bulkAssignContractsSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';

/**
 * POST /api/users/bulk-assign-contracts
 * Bulk assign contracts to users by filters (role, category, staff type, or individual users)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - allow system.admin, users.manage, or users.update
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    if (!userWithLocation?.primary_location_id) {
      return errorResponse('User must have a primary location assigned. Please contact your administrator.', 400);
    }

    const locationId = userWithLocation.primary_location_id;

    const hasManagePermission = await checkPermission(user, 'users.manage', { locationId });
    const hasUpdatePermission = await checkPermission(user, 'users.update', { locationId });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });
    
    if (!hasManagePermission && !hasUpdatePermission && !isAdmin) {
      return errorResponse('Forbidden: Only administrators and HR managers can bulk assign contracts', 403);
    }

    const body = await request.json();
    const validated = bulkAssignContractsSchema.parse(body);

    const contractStartDate = new Date(validated.contract_start_date);
    const contractEndDate = validated.contract_end_date ? new Date(validated.contract_end_date) : null;

    const result = await bulkAssignContracts(
      {
        user_ids: validated.user_ids,
        role_ids: validated.role_ids,
        category_ids: validated.category_ids,
        staff_type_ids: validated.staff_type_ids,
      },
      contractStartDate,
      contractEndDate,
      {
        auto_calculate_leave: validated.auto_calculate_leave,
        leave_type_id: validated.leave_type_id,
        manual_leave_days: validated.manual_leave_days,
      }
    );

    return successResponse(
      result, 
      `Successfully assigned contracts to ${result.assigned} users. ${result.errors} errors occurred.`
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to bulk assign contracts', 500);
  }
}
