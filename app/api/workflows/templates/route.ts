import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { createWorkflowTemplateSchema, paginationSchema } from '@/lib/utils/validation';

/**
 * GET /api/workflows/templates
 * List all workflow templates
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    try {
      await requirePermission(user, 'workflows.templates.read', { locationId });
    } catch {
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
        return unauthorizedResponse('You do not have permission to view workflow templates');
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const resource_type = searchParams.get('resource_type');
    const location_id = searchParams.get('location_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};

    if (resource_type) {
      where.resource_type = resource_type;
    }

    if (location_id) {
      where.location_id = location_id;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    // Get templates
    const [templates, total] = await Promise.all([
      prisma.workflowTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ resource_type: 'asc' }, { name: 'asc' }],
        include: {
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          steps: {
            orderBy: { step_order: 'asc' },
          },
          _count: {
            select: {
              instances: true,
            },
          },
        },
      }),
      prisma.workflowTemplate.count({ where }),
    ]);

    return successResponse({
      templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('List workflow templates error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/workflows/templates
 * Create a new workflow template
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    try {
      await requirePermission(user, 'workflows.templates.create', { locationId });
    } catch {
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
        return unauthorizedResponse('You do not have permission to create workflow templates');
      }
    }

    const body = await request.json();
    const validation = createWorkflowTemplateSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Validate location exists
    const location = await prisma.location.findUnique({
      where: { id: validation.data.location_id },
    });

    if (!location || location.status === 'inactive') {
      return errorResponse('Invalid or inactive location', 400);
    }

    // Validate permissions exist
    for (const step of validation.data.steps) {
      const permission = await prisma.permission.findUnique({
        where: { name: step.required_permission },
      });

      if (!permission) {
        return errorResponse(`Permission not found: ${step.required_permission}`, 400);
      }
    }

    // Create template with steps in a transaction
    const template = await prisma.$transaction(async (tx) => {
      const newTemplate = await tx.workflowTemplate.create({
        data: {
          name: validation.data.name,
          resource_type: validation.data.resource_type,
          location_id: validation.data.location_id,
          version: 1,
          status: 'active',
        },
      });

      // Create steps
      await tx.workflowStep.createMany({
        data: validation.data.steps.map((step) => ({
          workflow_template_id: newTemplate.id,
          step_order: step.step_order,
          required_permission: step.required_permission,
          allow_decline: step.allow_decline,
          allow_adjust: step.allow_adjust,
        })),
      });

      return newTemplate;
    });

    // Fetch created template with steps
    const createdTemplate = await prisma.workflowTemplate.findUnique({
      where: { id: template.id },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        steps: {
          orderBy: { step_order: 'asc' },
        },
      },
    });

    return successResponse(createdTemplate, 201);
  } catch (error: any) {
    console.error('Create workflow template error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
