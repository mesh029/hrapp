import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { resetLeaveBalance, processExpiredContracts } from '@/lib/services/leave-balance-reset';
import { resetLeaveBalanceSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';

/**
 * POST /api/leave/balances/reset
 * Manually reset leave balance(s)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasPermission = await checkPermission(user.id, 'leave.manage', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const body = await request.json();
    const validated = resetLeaveBalanceSchema.parse(body);

    await resetLeaveBalance(
      validated.user_id,
      validated.leave_type_id ?? null,
      validated.reason,
      user.id // Manual reset
    );

    return successResponse(null, 'Leave balance reset successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to reset leave balance', 500);
  }
}

/**
 * POST /api/leave/balances/reset/expired-contracts
 * Process expired contracts and reset balances (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission (admin only)
    const hasPermission = await checkPermission(user.id, 'system.admin', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Admin access required', 403);
    }

    const result = await processExpiredContracts();

    return successResponse(result, 'Expired contracts processed successfully');
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to process expired contracts', 500);
  }
}
