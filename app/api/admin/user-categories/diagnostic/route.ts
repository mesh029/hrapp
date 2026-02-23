import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/user-categories/diagnostic
 * Diagnostic endpoint to check what categories exist in the database
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    await requirePermission(user, 'system.admin', { locationId });

    // Get ALL user categories (including deleted)
    const allCategories = await prisma.userCategory.findMany({
      orderBy: { name: 'asc' },
    });

    // Get active categories only
    const activeCategories = await prisma.userCategory.findMany({
      where: { deleted_at: null },
      orderBy: { name: 'asc' },
    });

    // Get all roles (for comparison)
    const allRoles = await prisma.role.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get all staff types (for comparison)
    const allStaffTypes = await prisma.staffType.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    return successResponse({
      user_categories: {
        total: allCategories.length,
        active: activeCategories.length,
        deleted: allCategories.length - activeCategories.length,
        all: allCategories.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          deleted: cat.deleted_at !== null,
          deleted_at: cat.deleted_at,
        })),
        active_list: activeCategories.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
        })),
      },
      roles: {
        total: allRoles.length,
        list: allRoles,
      },
      staff_types: {
        total: allStaffTypes.length,
        list: allStaffTypes,
      },
      analysis: {
        message: activeCategories.length === 0 
          ? 'No active User Categories found. Categories might be in Roles or Staff Types, or all are soft-deleted.'
          : `${activeCategories.length} active User Categories found.`,
        recommendation: activeCategories.length === 0
          ? 'Consider running sync script: npx tsx scripts/sync-categories-from-roles.ts'
          : 'User Categories are available for use.',
      },
    });
  } catch (error: any) {
    console.error('Error in diagnostic endpoint:', error);
    return errorResponse(error.message || 'Failed to get diagnostic info', 500);
  }
}
