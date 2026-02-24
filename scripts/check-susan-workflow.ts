#!/usr/bin/env tsx
/**
 * Script to check Susan Achieng's workflow and why step 1 has no approvers
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
  console.log('🔍 Checking Susan Achieng\'s workflow...\n');

  // Find Susan
  const susan = await prisma.user.findUnique({
    where: { email: 'susan.achieng@test.com' },
    include: {
      primary_location: true,
      manager: {
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
      },
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

  if (!susan) {
    console.error('❌ Susan Achieng not found');
    process.exit(1);
  }

  console.log(`✅ Found Susan: ${susan.name} (${susan.email})`);
  console.log(`   Location: ${susan.primary_location?.name || 'None'} (${susan.primary_location_id || 'None'})`);
  console.log(`   Manager: ${susan.manager?.name || 'None'} (${susan.manager_id || 'None'})`);
  console.log('');

  if (!susan.leave_requests || susan.leave_requests.length === 0) {
    console.log('⚠️  No leave requests with workflow found');
    console.log('   Creating a test leave request...\n');
    
    // Create a test leave request
    const leaveType = await prisma.leaveType.findFirst({
      where: { deleted_at: null, status: 'active' },
    });

    if (!leaveType) {
      console.error('❌ No active leave type found');
      process.exit(1);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5);

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        user_id: susan.id,
        leave_type_id: leaveType.id,
        start_date: startDate,
        end_date: endDate,
        days_requested: 5,
        reason: 'Test leave request for debugging',
        location_id: susan.primary_location_id!,
        status: 'Draft',
      },
    });

    console.log(`✅ Created test leave request: ${leaveRequest.id}`);
    console.log('   Please submit this leave request to create a workflow instance');
    console.log('');
    await prisma.$disconnect();
    process.exit(0);
  }

  const leaveRequest = susan.leave_requests[0];
  console.log(`📋 Leave Request: ${leaveRequest.id}`);
  console.log(`   Status: ${leaveRequest.status}`);
  console.log(`   Workflow Instance ID: ${leaveRequest.workflow_instance_id || 'None'}`);
  console.log('');

  if (!leaveRequest.workflow_instance_id) {
    console.log('⚠️  Leave request has no workflow instance');
    console.log('   Please submit the leave request to create a workflow');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Get workflow instance
  const workflowInstance = await prisma.workflowInstance.findUnique({
    where: { id: leaveRequest.workflow_instance_id },
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
      steps: {
        orderBy: { step_order: 'asc' },
      },
    },
  });

  if (!workflowInstance) {
    console.error('❌ Workflow instance not found');
    process.exit(1);
  }

  console.log(`✅ Workflow Instance: ${workflowInstance.id}`);
  console.log(`   Template: ${workflowInstance.template.name}`);
  console.log(`   Template Location: ${workflowInstance.template.location.name} (${workflowInstance.template.location_id})`);
  console.log(`   Status: ${workflowInstance.status}`);
  console.log(`   Current Step: ${workflowInstance.current_step_order}`);
  console.log('');

  // Check Step 1
  const step1 = workflowInstance.template.steps.find(s => s.step_order === 1);
  if (!step1) {
    console.error('❌ Step 1 not found in template');
    process.exit(1);
  }

  console.log(`📋 Step 1 Configuration:`);
  console.log(`   Required Permission: ${step1.required_permission}`);
  console.log(`   Approver Strategy: ${step1.approver_strategy || 'permission'}`);
  console.log(`   Include Manager: ${step1.include_manager || false}`);
  console.log(`   Location Scope: ${step1.location_scope || 'all'}`);
  
  const requiredRoles = step1.required_roles ? JSON.parse(step1.required_roles as string) : [];
  console.log(`   Required Roles: ${requiredRoles.length > 0 ? requiredRoles.join(', ') : 'None'}`);
  console.log('');

  // Check manager
  if (susan.manager) {
    console.log(`👤 Manager: ${susan.manager.name} (${susan.manager.email})`);
    console.log(`   Status: ${susan.manager.status}`);
    console.log(`   Location: ${susan.manager.primary_location?.name || 'None'} (${susan.manager.primary_location_id || 'None'})`);
    console.log(`   Roles: ${susan.manager.user_roles.map(ur => ur.role.name).join(', ') || 'None'}`);
    
    // Check if manager has the required permission
    const managerHasPermission = susan.manager.user_roles.some(ur =>
      ur.role.status === 'active' &&
      ur.role.role_permissions.some(rp => rp.permission.name === step1.required_permission)
    );
    console.log(`   Has Permission (${step1.required_permission}): ${managerHasPermission ? '✅ YES' : '❌ NO'}`);
    
    if (!managerHasPermission) {
      console.log(`   ⚠️  Manager does not have required permission!`);
      console.log(`   Manager's permissions:`, susan.manager.user_roles.flatMap(ur => 
        ur.role.role_permissions.map(rp => rp.permission.name)
      ).join(', ') || 'None');
    }

    // Check UserPermissionScope
    const permission = await prisma.permission.findUnique({
      where: { name: step1.required_permission },
    });

    if (permission) {
      const userScope = await prisma.userPermissionScope.findFirst({
        where: {
          user_id: susan.manager.id,
          permission_id: permission.id,
          status: 'active',
        },
      });

      console.log(`   UserPermissionScope: ${userScope ? '✅ EXISTS' : '❌ MISSING'}`);
      if (userScope) {
        console.log(`     Location: ${userScope.location_id || 'Global'}`);
        console.log(`     Is Global: ${userScope.is_global}`);
      } else {
        console.log(`     ⚠️  Manager needs UserPermissionScope entry for ${step1.required_permission}`);
      }
    }
    console.log('');
  } else {
    console.log('❌ Susan has no manager assigned');
    console.log('');
  }

  // Try to resolve approvers
  console.log(`🔄 Resolving approvers for Step 1...`);
  console.log('');

  const stepConfig = {
    ...step1,
    required_roles: step1.required_roles ? JSON.parse(step1.required_roles as string) : null,
    conditional_rules: step1.conditional_rules ? JSON.parse(step1.conditional_rules as string) : null,
  };

  const locationId = leaveRequest.location_id || 
    susan.primary_location_id || 
    workflowInstance.template.location_id || 
    '';

  try {
    const approverIds = await resolveApprovers(
      1,
      workflowInstance.id,
      locationId,
      { stepConfig }
    );

    console.log(`✅ Resolved ${approverIds.length} approver(s):`);
    if (approverIds.length === 0) {
      console.log(`   ⚠️  No approvers found!`);
      console.log('');
      console.log('💡 Possible reasons:');
      console.log('   1. Manager doesn\'t have the required permission');
      console.log('   2. Manager doesn\'t have UserPermissionScope entry');
      console.log('   3. Location scope mismatch (if not "all")');
      console.log('   4. Authority check failed');
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
  console.log('✅ Check complete!');
  console.log('💡 Check the logs above to identify why approvers are not being resolved.');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
