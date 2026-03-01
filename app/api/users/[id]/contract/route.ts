import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { updateContractStatus } from '@/lib/services/leave-balance-reset';
import { autoCalculateAndAllocateLeaveDays } from '@/lib/services/contract-leave-management';
import { contractWithLeaveAllocationSchema, uuidSchema } from '@/lib/utils/validation';
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
    // Check permission
    const userWithLocation_hasPermission = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId_hasPermission = userWithLocation_hasPermission?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId_hasPermission) {
      return errorResponse('No location available for permission check', 400);
    }

    // Allow users.update OR users.manage (for HR assistants)
    const hasUpdatePermission = await checkPermission(user, 'users.update', { locationId: locationId_hasPermission });
    const hasManagePermission = await checkPermission(user, 'users.manage', { locationId: locationId_hasPermission });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId: locationId_hasPermission });
    
    if (!hasUpdatePermission && !hasManagePermission && !isAdmin) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);
    const body = await request.json();
    
    // Try contractWithLeaveAllocationSchema first (enhanced), fallback to updateContractSchema
    let validated: any;
    let autoCalculate = false;
    let leaveTypeId: string | undefined;
    let manualDays: number | undefined;
    
    try {
      validated = contractWithLeaveAllocationSchema.parse(body);
      autoCalculate = validated.auto_calculate_leave;
      leaveTypeId = validated.leave_type_id;
      manualDays = validated.manual_leave_days;
    } catch {
      // Fallback to simple contract update
      const { updateContractSchema } = await import('@/lib/utils/validation');
      validated = updateContractSchema.parse(body);
    }

    const updateData: any = {};
    if (validated.contract_start_date !== undefined) {
      updateData.contract_start_date = validated.contract_start_date ? new Date(validated.contract_start_date) : null;
    }
    if (validated.contract_end_date !== undefined) {
      updateData.contract_end_date = validated.contract_end_date ? new Date(validated.contract_end_date) : null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        contract_start_date: true,
        contract_end_date: true,
      },
    });

    // Update contract status
    await updateContractStatus(params.id);

    // Handle leave allocation if requested
    if (autoCalculate && leaveTypeId && updatedUser.contract_start_date) {
      const year = new Date(updatedUser.contract_start_date).getFullYear();
      try {
        await autoCalculateAndAllocateLeaveDays(
          params.id,
          updatedUser.contract_start_date,
          updatedUser.contract_end_date,
          leaveTypeId,
          year
        );
      } catch (error: any) {
        console.error('Error auto-calculating leave days:', error);
        // Don't fail the contract update if leave calculation fails
      }
    } else if (manualDays && leaveTypeId) {
      const { allocateLeaveDays } = await import('@/lib/services/leave-balance');
      const year = updatedUser.contract_start_date 
        ? new Date(updatedUser.contract_start_date).getFullYear()
        : new Date().getFullYear();
      try {
        await allocateLeaveDays(params.id, leaveTypeId, year, manualDays);
      } catch (error: any) {
        console.error('Error manually allocating leave days:', error);
        // Don't fail the contract update if leave allocation fails
      }
    }

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
