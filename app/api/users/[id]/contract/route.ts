import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { updateContractStatus } from '@/lib/services/leave-balance-reset';
import { updateContractSchema, uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/users/:id/contract
 * Update contract dates
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasPermission = await checkPermission(user.id, 'users.update', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);
    const body = await request.json();
    const validated = updateContractSchema.parse(body);

    const updateData: any = {};
    if (validated.contract_start_date !== undefined) {
      updateData.contract_start_date = validated.contract_start_date ? new Date(validated.contract_start_date) : null;
    }
    if (validated.contract_end_date !== undefined) {
      updateData.contract_end_date = validated.contract_end_date ? new Date(validated.contract_end_date) : null;
    }

    await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    });

    // Update contract status
    await updateContractStatus(params.id);

    const updated = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        contract_start_date: true,
        contract_end_date: true,
        contract_status: true,
      },
    });

    return successResponse(updated, 'Contract updated successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to update contract', 500);
  }
}
