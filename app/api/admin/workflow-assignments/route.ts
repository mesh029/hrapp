import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { z } from 'zod';

const createAssignmentSchema = z.object({
  location_id: z.string().uuid().optional(), // Optional if apply_to_all_locations is true
  resource_type: z.enum(['leave', 'timesheet']),
  workflow_template_id: z.string().uuid(),
  notes: z.string().optional().nullable(),
  apply_to_all_locations: z.boolean().optional().default(false),
}).refine((data) => {
  // Either location_id must be provided OR apply_to_all_locations must be true
  return data.apply_to_all_locations || !!data.location_id;
}, {
  message: "Either location_id must be provided or apply_to_all_locations must be true",
  path: ["location_id"],
});

/**
 * GET /api/admin/workflow-assignments
 * List workflow template assignments
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission (admin only)
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    const { checkPermission } = await import('@/lib/middleware/permissions');
    const hasPermission = await checkPermission(user, 'system.admin', { locationId });
    if (!hasPermission) {
      return unauthorizedResponse('Only administrators can view workflow template assignments');
    }

    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resource_type') as 'leave' | 'timesheet' | null;

    const assignments = await prisma.workflowTemplateAssignment.findMany({
      where: {
        ...(resourceType && { resource_type: resourceType }),
        status: 'active',
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        workflow_template: {
          select: {
            id: true,
            name: true,
            resource_type: true,
            is_area_wide: true,
          },
        },
      },
      orderBy: [
        { resource_type: 'asc' },
        { location: { name: 'asc' } },
      ],
    });

    return successResponse({ assignments });
  } catch (error: any) {
    console.error('Get workflow assignments error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Failed to get workflow assignments', 500);
  }
}

/**
 * POST /api/admin/workflow-assignments
 * Create a new workflow template assignment
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission (admin only)
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    const { checkPermission } = await import('@/lib/middleware/permissions');
    const hasPermission = await checkPermission(user, 'system.admin', { locationId });
    if (!hasPermission) {
      return unauthorizedResponse('Only administrators can create workflow template assignments');
    }

    const body = await request.json();
    const validation = createAssignmentSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // If applying to all locations, get all active locations
    let targetLocations: Array<{ id: string }> = [];
    if (validation.data.apply_to_all_locations) {
      targetLocations = await prisma.location.findMany({
        where: { status: 'active' },
        select: { id: true },
      });
    } else {
      // Verify location exists
      const location = await prisma.location.findUnique({
        where: { id: validation.data.location_id! },
      });

      if (!location) {
        return errorResponse('Location not found', 404);
      }
      targetLocations = [{ id: location.id }];
    }

    // Verify template exists and matches resource type
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: validation.data.workflow_template_id },
    });

    if (!template) {
      return errorResponse('Workflow template not found', 404);
    }

    if (template.resource_type !== validation.data.resource_type) {
      return errorResponse(`Template resource type (${template.resource_type}) does not match assignment resource type (${validation.data.resource_type})`, 400);
    }

    if (template.status !== 'active') {
      return errorResponse('Cannot assign inactive or deprecated template', 400);
    }

    // Deactivate any existing active assignments for target locations + resource_type
    await prisma.workflowTemplateAssignment.updateMany({
      where: {
        location_id: { in: targetLocations.map(l => l.id) },
        resource_type: validation.data.resource_type,
        status: 'active',
      },
      data: {
        status: 'inactive',
      },
    });

    // Create assignments for all target locations
    const assignments = await Promise.all(
      targetLocations.map(location =>
        prisma.workflowTemplateAssignment.create({
          data: {
            location_id: location.id,
            resource_type: validation.data.resource_type,
            workflow_template_id: validation.data.workflow_template_id,
            assigned_by: user.id,
            notes: validation.data.notes || null,
            status: 'active',
          },
          include: {
            location: {
              select: {
                id: true,
                name: true,
              },
            },
            workflow_template: {
              select: {
                id: true,
                name: true,
                resource_type: true,
              },
            },
          },
        })
      )
    );

    return successResponse(
      validation.data.apply_to_all_locations ? assignments : assignments[0],
      validation.data.apply_to_all_locations 
        ? `Template assigned to ${assignments.length} locations successfully`
        : 'Template assigned successfully',
      201
    );
  } catch (error: any) {
    console.error('Create workflow assignment error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    if (error.code === 'P2002') {
      return errorResponse('An active assignment already exists for this location and resource type', 409);
    }
    return errorResponse(error.message || 'Failed to create workflow assignment', 500);
  }
}
