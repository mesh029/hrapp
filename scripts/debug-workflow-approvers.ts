#!/usr/bin/env tsx
/**
 * Script to debug why approvers are not being resolved for a workflow step
 * 
 * Usage: npm run debug:workflow-approvers -- <workflow-instance-id> <step-order>
 * Or: npm run debug:workflow-approvers -- <employee-email> <step-order>
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveApprovers } from '../app/lib/services/workflow';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: npm run debug:workflow-approvers -- <workflow-instance-id-or-email> [step-order]');
    console.error('Example: npm run debug:workflow-approvers -- susan.achieng@test.com 1');
    process.exit(1);
  }

  const identifier = args[0];
  const stepOrder = args[1] ? parseInt(args[1]) : 1;

  console.log(`🔍 Debugging workflow approvers for: ${identifier}, Step: ${stepOrder}\n`);

  // Find workflow instance
  let workflowInstance;
  
  if (identifier.includes('@')) {
    // It's an email, find by user
    const user = await prisma.user.findUnique({
      where: { email: identifier },
      include: {
        leave_requests: {
          where: {
            deleted_at: null,
            workflow_instance_id: { not: null },
          },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      console.error(`❌ User not found: ${identifier}`);
      process.exit(1);
    }

    if (!user.leave_requests || user.leave_requests.length === 0) {
      console.error(`❌ No leave requests with workflow found for ${identifier}`);
      process.exit(1);
    }

    const leaveRequest = user.leave_requests[0];
    workflowInstance = await prisma.workflowInstance.findUnique({
      where: { id: leaveRequest.workflow_instance_id! },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
            location: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            manager_id: true,
            primary_location_id: true,
          },
        },
      },
    });
  } else {
    // It's a workflow instance ID
    workflowInstance = await prisma.workflowInstance.findUnique({
      where: { id: identifier },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
            location: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            manager_id: true,
            primary_location_id: true,
          },
        },
      },
    });
  }

  if (!workflowInstance) {
    console.error(`❌ Workflow instance not found`);
    process.exit(1);
  }

  console.log(`✅ Found workflow instance: ${workflowInstance.id}`);
  console.log(`   Template: ${workflowInstance.template.name}`);
  console.log(`   Resource Type: ${workflowInstance.resource_type}`);
  console.log(`   Status: ${workflowInstance.status}`);
  console.log(`   Current Step: ${workflowInstance.current_step_order}`);
  console.log(`   Creator: ${workflowInstance.creator.name} (${workflowInstance.creator.email})`);
  console.log(`   Creator Location: ${workflowInstance.creator.primary_location_id || 'None'}`);
  console.log(`   Creator Manager ID: ${workflowInstance.creator.manager_id || 'None'}`);
  console.log(`   Template Location: ${workflowInstance.template.location.name} (${workflowInstance.template.location_id})`);
  console.log('');

  // Get the step configuration
  const step = workflowInstance.template.steps.find(s => s.step_order === stepOrder);
  if (!step) {
    console.error(`❌ Step ${stepOrder} not found in template`);
    process.exit(1);
  }

  console.log(`📋 Step ${stepOrder} Configuration:`);
  console.log(`   Required Permission: ${step.required_permission}`);
  console.log(`   Approver Strategy: ${step.approver_strategy || 'permission'}`);
  console.log(`   Include Manager: ${step.include_manager || false}`);
  console.log(`   Location Scope: ${step.location_scope || 'all'}`);
  
  const requiredRoles = step.required_roles ? JSON.parse(step.required_roles as string) : [];
  console.log(`   Required Roles: ${requiredRoles.length > 0 ? requiredRoles.join(', ') : 'None'}`);
  console.log('');

  // Check manager
  if (workflowInstance.creator.manager_id) {
    const manager = await prisma.user.findUnique({
      where: { id: workflowInstance.creator.manager_id },
      include: {
        primary_location: true,
        user_roles: {
          where: { deleted_at: null },
          include: {
            role: {
              include: {
                role_permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (manager) {
      console.log(`👤 Manager Information:`);
      console.log(`   Name: ${manager.name}`);
      console.log(`   Email: ${manager.email}`);
      console.log(`   Status: ${manager.status}`);
      console.log(`   Location: ${manager.primary_location?.name || 'None'} (${manager.primary_location_id || 'None'})`);
      console.log(`   Roles: ${manager.user_roles.map(ur => ur.role.name).join(', ') || 'None'}`);
      
      const hasPermission = manager.user_roles.some(ur =>
        ur.role.status === 'active' &&
        ur.role.role_permissions.some(rp => rp.permission.name === step.required_permission)
      );
      console.log(`   Has Permission (${step.required_permission}): ${hasPermission ? '✅ YES' : '❌ NO'}`);
      
      if (!hasPermission) {
        console.log(`   ⚠️  Manager does not have required permission!`);
        console.log(`   Manager's permissions:`, manager.user_roles.flatMap(ur => 
          ur.role.role_permissions.map(rp => rp.permission.name)
        ).join(', ') || 'None');
      }
      console.log('');
    } else {
      console.log(`❌ Manager not found (ID: ${workflowInstance.creator.manager_id})`);
      console.log('');
    }
  } else {
    console.log(`⚠️  Employee has no manager assigned`);
    console.log('');
  }

  // Get resource location
  let resourceLocationId: string | null = null;
  if (workflowInstance.resource_type === 'leave') {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: workflowInstance.resource_id },
      select: { location_id: true },
    });
    resourceLocationId = leaveRequest?.location_id || null;
  } else if (workflowInstance.resource_type === 'timesheet') {
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: workflowInstance.resource_id },
      select: { location_id: true },
    });
    resourceLocationId = timesheet?.location_id || null;
  }

  console.log(`📍 Location Information:`);
  console.log(`   Resource Location: ${resourceLocationId || 'None'}`);
  console.log(`   Template Location: ${workflowInstance.template.location_id}`);
  console.log(`   Creator Location: ${workflowInstance.creator.primary_location_id || 'None'}`);
  console.log('');

  // Try to resolve approvers
  console.log(`🔄 Resolving approvers for Step ${stepOrder}...`);
  console.log('');

  const stepConfig = {
    ...step,
    required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
    conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
  };

  const locationId = resourceLocationId || 
    workflowInstance.creator.primary_location_id || 
    workflowInstance.template.location_id || 
    '';

  try {
    const approverIds = await resolveApprovers(
      stepOrder,
      workflowInstance.id,
      locationId,
      { stepConfig }
    );

    console.log(`✅ Resolved ${approverIds.length} approver(s):`);
    if (approverIds.length === 0) {
      console.log(`   ⚠️  No approvers found!`);
    } else {
      for (const approverId of approverIds) {
        const approver = await prisma.user.findUnique({
          where: { id: approverId },
          select: {
            name: true,
            email: true,
            primary_location_id: true,
          },
        });
        console.log(`   - ${approver?.name || approverId} (${approver?.email || 'N/A'})`);
      }
    }
  } catch (error: any) {
    console.error(`❌ Error resolving approvers:`, error.message);
    console.error(error);
  }

  console.log('');
  console.log('💡 Check the logs above to identify why approvers are not being resolved.');
  console.log('   Common issues:');
  console.log('   - Manager missing required permission');
  console.log('   - Location scope mismatch');
  console.log('   - Manager not at correct location');
  console.log('   - Step configuration incorrect');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
