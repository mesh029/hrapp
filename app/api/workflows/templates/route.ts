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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const resourceType = searchParams.get('resource_type');
    const locationIdFilter = searchParams.get('location_id');
    const staffTypeIdFilter = searchParams.get('staff_type_id');
    const leaveTypeIdFilter = searchParams.get('leave_type_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const validation = paginationSchema.safeParse({ page, limit });
    if (!validation.success) {
      return errorResponse('Invalid pagination parameters', 400, validation.error.flatten().fieldErrors);
    }

    // Build where clause
    const where: any = {};
    if (resourceType) {
      where.resource_type = resourceType;
    }
    if (locationIdFilter) {
      where.location_id = locationIdFilter;
    }
    if (staffTypeIdFilter) {
      where.staff_type_id = staffTypeIdFilter;
    }
    if (leaveTypeIdFilter) {
      where.leave_type_id = leaveTypeIdFilter;
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
        include: {
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          staff_type: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          leave_type: {
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
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.workflowTemplate.count({ where }),
    ]);

    // Parse JSON fields in steps
    const templatesWithParsedSteps = templates.map(template => ({
      ...template,
      steps: template.steps.map(step => ({
        ...step,
        required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
        conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
      })),
    }));

    return successResponse({
      templates: templatesWithParsedSteps,
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

    await requirePermission(user, 'workflows.templates.create', { locationId });

    const body = await request.json();
    const validation = createWorkflowTemplateSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Validate location exists
    const location = await prisma.location.findUnique({
      where: { id: validation.data.location_id },
    });

    if (!location) {
      return errorResponse('Location not found', 404);
    }

    // Validate staff_type exists if provided
    if (validation.data.staff_type_id) {
      const staffType = await prisma.staffType.findUnique({
        where: { id: validation.data.staff_type_id },
      });

      if (!staffType || staffType.deleted_at) {
        return errorResponse('Staff type not found', 404);
      }
    }

    // Validate leave_type exists if provided (and only for leave workflows)
    if (validation.data.leave_type_id) {
      if (validation.data.resource_type !== 'leave') {
        return errorResponse('leave_type_id can only be set for leave workflows', 400);
      }

      const leaveType = await prisma.leaveType.findUnique({
        where: { id: validation.data.leave_type_id },
      });

      if (!leaveType || leaveType.deleted_at) {
        return errorResponse('Leave type not found', 404);
      }
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
          is_area_wide: validation.data.is_area_wide || false,
          staff_type_id: validation.data.staff_type_id || null,
          leave_type_id: validation.data.leave_type_id || null,
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
          approver_strategy: step.approver_strategy || 'permission',
          include_manager: step.include_manager || false,
          required_roles: step.required_roles ? JSON.stringify(step.required_roles) : null,
          location_scope: step.location_scope || 'all',
          conditional_rules: step.conditional_rules ? JSON.stringify(step.conditional_rules) : null,
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
        staff_type: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        leave_type: {
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

    // Parse JSON fields
    const templateWithParsedSteps = {
      ...createdTemplate!,
      steps: createdTemplate!.steps.map(step => ({
        ...step,
        required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
        conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
      })),
    };

    return successResponse(templateWithParsedSteps, undefined, 201);
  } catch (error: any) {
    console.error('Create workflow template error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
