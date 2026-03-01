import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Updating workflow templates to have 6+ steps with location-based filtering...\n');

  // Get HR Assistant role ID
  const hrAssistantRole = await prisma.role.findFirst({
    where: { name: 'HR Assistant' },
  });

  if (!hrAssistantRole) {
    throw new Error('HR Assistant role not found');
  }

  // Get HR Manager role ID
  const hrManagerRole = await prisma.role.findFirst({
    where: { name: 'HR Manager' },
  });

  // Get Program Officer role ID
  const programOfficerRole = await prisma.role.findFirst({
    where: { name: 'Program Officer' },
  });

  // Get locations
  const locations = await prisma.location.findMany({
    where: { deleted_at: null, status: 'active' },
    orderBy: { name: 'asc' },
  });

  if (locations.length === 0) {
    throw new Error('No locations found');
  }

  const nairobiLocation = locations.find(l => l.name.toLowerCase().includes('nairobi')) || locations[0];
  console.log(`📍 Using location: ${nairobiLocation.name} (${nairobiLocation.id})\n`);

  // Update Leave template
  const leaveTemplate = await prisma.workflowTemplate.findFirst({
    where: { name: { contains: 'SOLID Leave' } },
  });

  if (leaveTemplate) {
    console.log(`📝 Updating Leave template: ${leaveTemplate.name}`);
    
    // Delete existing steps
    await prisma.workflowStep.deleteMany({
      where: { workflow_template_id: leaveTemplate.id },
    });

    // Create 6 steps with location-based filtering
    const leaveSteps = [
      {
        step_order: 1,
        required_permission: 'leave.approve',
        allow_decline: true,
        allow_adjust: true,
        approver_strategy: 'manager' as const,
        include_manager: true,
        location_scope: 'same' as const,
        required_roles: null,
      },
      {
        step_order: 2,
        required_permission: 'leave.approve',
        allow_decline: true,
        allow_adjust: true,
        approver_strategy: 'role' as const,
        include_manager: false,
        location_scope: 'same' as const,
        required_roles: [hrAssistantRole.id],
      },
      {
        step_order: 3,
        required_permission: 'leave.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: 'permission' as const,
        include_manager: false,
        location_scope: 'same' as const, // Only same location to reduce approvers
        required_roles: null,
      },
      {
        step_order: 4,
        required_permission: 'leave.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: hrManagerRole ? 'role' as const : 'permission' as const,
        include_manager: false,
        location_scope: 'same' as const,
        required_roles: hrManagerRole ? [hrManagerRole.id] : null,
      },
      {
        step_order: 5,
        required_permission: 'leave.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: programOfficerRole ? 'role' as const : 'permission' as const,
        include_manager: false,
        location_scope: 'same' as const,
        required_roles: programOfficerRole ? [programOfficerRole.id] : null,
      },
      {
        step_order: 6,
        required_permission: 'leave.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: 'permission' as const,
        include_manager: false,
        location_scope: 'all' as const, // Final step allows all locations
        required_roles: null,
      },
    ];

    await prisma.workflowStep.createMany({
      data: leaveSteps.map(step => ({
        workflow_template_id: leaveTemplate.id,
        ...step,
        required_roles: step.required_roles ? JSON.stringify(step.required_roles) : null,
      })),
    });

    console.log(`✅ Created ${leaveSteps.length} steps for Leave template\n`);
  }

  // Update Timesheet template
  const timesheetTemplate = await prisma.workflowTemplate.findFirst({
    where: { name: { contains: 'SOLID Ts' } },
  });

  if (timesheetTemplate) {
    console.log(`📝 Updating Timesheet template: ${timesheetTemplate.name}`);
    
    // Delete existing steps
    await prisma.workflowStep.deleteMany({
      where: { workflow_template_id: timesheetTemplate.id },
    });

    // Create 6 steps with location-based filtering
    const timesheetSteps = [
      {
        step_order: 1,
        required_permission: 'timesheet.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: 'manager' as const,
        include_manager: true,
        location_scope: 'same' as const,
        required_roles: null,
      },
      {
        step_order: 2,
        required_permission: 'timesheet.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: 'role' as const,
        include_manager: false,
        location_scope: 'same' as const,
        required_roles: [hrAssistantRole.id],
      },
      {
        step_order: 3,
        required_permission: 'timesheet.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: 'permission' as const,
        include_manager: false,
        location_scope: 'same' as const, // Only same location to reduce approvers
        required_roles: null,
      },
      {
        step_order: 4,
        required_permission: 'timesheet.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: hrManagerRole ? 'role' as const : 'permission' as const,
        include_manager: false,
        location_scope: 'same' as const,
        required_roles: hrManagerRole ? [hrManagerRole.id] : null,
      },
      {
        step_order: 5,
        required_permission: 'timesheet.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: programOfficerRole ? 'role' as const : 'permission' as const,
        include_manager: false,
        location_scope: 'same' as const,
        required_roles: programOfficerRole ? [programOfficerRole.id] : null,
      },
      {
        step_order: 6,
        required_permission: 'timesheet.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: 'permission' as const,
        include_manager: false,
        location_scope: 'all' as const, // Final step allows all locations
        required_roles: null,
      },
    ];

    await prisma.workflowStep.createMany({
      data: timesheetSteps.map(step => ({
        workflow_template_id: timesheetTemplate.id,
        ...step,
        required_roles: step.required_roles ? JSON.stringify(step.required_roles) : null,
      })),
    });

    console.log(`✅ Created ${timesheetSteps.length} steps for Timesheet template\n`);
  }

  console.log('✅ Workflow templates updated successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
