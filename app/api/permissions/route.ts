import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { paginationSchema } from '@/lib/utils/validation';

/**
 * GET /api/permissions
 * List all permissions (read-only)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const user = await authenticate(request);

    // Check permission (permissions.read doesn't require location)
    // For system-level permissions, we'll use a dummy location or check differently
    try {
      await requirePermission(user, 'permissions.read', { locationId: user.id }); // Using user.id as dummy
    } catch {
      // If permission check fails, still allow if user is system admin
      const hasSystemAdmin = await prisma.userRole.findFirst({
        where: {
          user_id: user.id,
          deleted_at: null,
          role: {
            status: 'active',
            role_permissions: {
              some: {
                permission: {
                  name: 'system.admin',
                },
              },
            },
          },
        },
      });

      if (!hasSystemAdmin) {
        return unauthorizedResponse('You do not have permission to view permissions');
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const module = searchParams.get('module');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};
    if (module) {
      where.module = module;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get permissions
    const [permissions, total] = await Promise.all([
      prisma.permission.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ module: 'asc' }, { name: 'asc' }],
      }),
      prisma.permission.count({ where }),
    ]);

    return successResponse({
      permissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('List permissions error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
