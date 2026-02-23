import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { resolveApprovers } from '@/lib/services/workflow';
import { z } from 'zod';

const simulateSchema = z.object({
  template_id: z.string().uuid(),
  scenario_id: z.string().optional(),
});

/**
 * POST /api/workflows/test/simulate
 * Simulate a workflow execution
 */
export async function POST(request: NextRequest) {
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

    await requirePermission(user, 'workflows.templates.read', { locationId });

    const body = await request.json();
    const validation = simulateSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const { template_id, scenario_id } = validation.data;

    // Get template with steps
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: template_id },
      include: {
        steps: {
          orderBy: { step_order: 'asc' },
        },
        location: {
          select: { id: true, name: true },
        },
      },
    });

    if (!template) {
      return errorResponse('Template not found', 404);
    }

    // Parse JSON fields in steps
    const stepsWithParsed = template.steps.map(step => ({
      ...step,
      required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
      conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
    }));

    // For simulation, create a mock workflow instance
    // In a real scenario, we'd use the test scenario users
    // For now, use the current user as the employee
    const employee = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        manager_id: true,
        primary_location_id: true,
      },
    });

    if (!employee) {
      return errorResponse('Employee not found', 404);
    }

    // Create a temporary workflow instance for simulation
    // This allows resolveApprovers to work properly
    const tempInstance = await prisma.workflowInstance.create({
      data: {
        workflow_template_id: template.id,
        resource_id: `sim-${Date.now()}`,
        resource_type: template.resource_type,
        created_by: employee.id,
        status: 'Submitted',
        current_step_order: 1,
      },
    });

    // Create step instances
    await prisma.workflowStepInstance.createMany({
      data: stepsWithParsed.map((s) => ({
        workflow_instance_id: tempInstance.id,
        step_order: s.step_order,
        status: 'pending',
      })),
    });

    // Resolve approvers for each step
    const simulationSteps = await Promise.all(
      stepsWithParsed.map(async (step) => {
        try {
          const approverIds = await resolveApprovers(
            step.step_order,
            tempInstance.id,
            template.location_id || locationId,
            {
              stepConfig: step,
            }
          );

          // Get approver details
          const approvers = await prisma.user.findMany({
            where: {
              id: { in: approverIds },
              status: 'active',
              deleted_at: null,
            },
            include: {
              primary_location: {
                select: { id: true, name: true },
              },
              user_roles: {
                where: { deleted_at: null },
                include: {
                  role: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          });

          // Determine source for each approver
          const approversWithSource = approvers.map(approver => {
            let source: 'manager' | 'role' | 'permission' = 'permission';
            
            // Check if manager
            if (employee.manager_id === approver.id) {
              source = 'manager';
            } else if (step.required_roles && approver.user_roles.some(ur => 
              step.required_roles.includes(ur.role.id)
            )) {
              source = 'role';
            }

            return {
              id: approver.id,
              name: approver.name,
              email: approver.email,
              source,
              notified: false,
              acted: false,
            };
          });

          return {
            step_order: step.step_order,
            required_permission: step.required_permission,
            approver_strategy: step.approver_strategy || 'permission',
            status: step.step_order === 1 ? 'in_progress' : 'pending' as const,
            approvers: approversWithSource,
          };
        } catch (error: any) {
          console.error(`Error resolving approvers for step ${step.step_order}:`, error);
          return {
            step_order: step.step_order,
            required_permission: step.required_permission,
            approver_strategy: step.approver_strategy || 'permission',
            status: 'pending' as const,
            approvers: [],
          };
        }
      })
    );

    const simulation = {
      simulation_id: tempInstance.id,
      template: {
        ...template,
        steps: stepsWithParsed,
      },
      current_step: 1,
      status: 'running' as const,
      steps: simulationSteps,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
      },
    };

    return successResponse(simulation);
  } catch (error: any) {
    console.error('Error simulating workflow:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
