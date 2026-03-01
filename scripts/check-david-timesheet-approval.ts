import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { checkAuthority } from '../app/lib/services/authority';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkApproval() {
  try {
    console.log('🔍 Checking David Kipchoge\'s timesheet approval capability...\n');

    // Find David
    const david = await prisma.user.findFirst({
      where: { email: 'david.kipchoge@test.com' },
      include: {
        primary_location: { select: { id: true, name: true } },
        user_roles: {
          where: { deleted_at: null },
          include: {
            role: {
              include: {
                role_permissions: {
                  include: {
                    permission: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!david) {
      console.log('❌ David not found');
      return;
    }

    console.log(`✅ Found David: ${david.name} (${david.id})`);
    console.log(`   Primary Location: ${david.primary_location?.name || 'NOT SET'}\n`);

    // Check permissions
    const locationId = david.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    if (!locationId) {
      console.log('❌ No location available for permission check');
      return;
    }

    const hasApprovePermission = await checkAuthority({
      userId: david.id,
      permission: 'timesheet.approve',
      locationId,
    });

    console.log(`Timesheet Approve Permission: ${hasApprovePermission.authorized ? '✅ YES' : '❌ NO'}`);
    console.log(`   Source: ${hasApprovePermission.source || 'none'}\n`);

    // Find Brian's submitted timesheet
    const brian = await prisma.user.findFirst({
      where: { email: 'brian.kiprotich@test.com' },
    });

    if (!brian) {
      console.log('❌ Brian not found');
      return;
    }

    const timesheet = await prisma.timesheet.findFirst({
      where: {
        user_id: brian.id,
        status: { in: ['Submitted', 'UnderReview'] },
        deleted_at: null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!timesheet) {
      console.log('❌ No submitted timesheet found for Brian');
      return;
    }

    console.log(`✅ Found timesheet: ${timesheet.id}`);
    console.log(`   Employee: ${timesheet.user.name} (${timesheet.user.email})`);
    console.log(`   Status: ${timesheet.status}`);
    console.log(`   Period: ${timesheet.period_start.toLocaleDateString()} - ${timesheet.period_end.toLocaleDateString()}`);
    console.log(`   Workflow Instance ID: ${timesheet.workflow_instance_id || 'NOT SET'}\n`);

    // Check workflow instance
    if (timesheet.workflow_instance_id) {
      const workflowInstance = await prisma.workflowInstance.findUnique({
        where: { id: timesheet.workflow_instance_id },
        include: {
          template: { select: { name: true } },
          steps: {
            where: { status: 'pending' },
            orderBy: { step_order: 'asc' },
            take: 1,
          },
        },
      });

      if (workflowInstance) {
        console.log(`✅ Workflow Instance: ${workflowInstance.id}`);
        console.log(`   Template: ${workflowInstance.template.name}`);
        console.log(`   Status: ${workflowInstance.status}`);
        console.log(`   Current Step Order: ${workflowInstance.current_step_order}\n`);

        if (workflowInstance.steps.length > 0) {
          const currentStep = workflowInstance.steps[0];
          console.log(`Current Step:`);
          console.log(`   Step Order: ${currentStep.step_order}`);
          console.log(`   Assigned To ID: ${currentStep.assigned_to_user_id || 'NOT SET'}`);
          console.log(`   David's ID: ${david.id}`);
          console.log(`   Match: ${currentStep.assigned_to_user_id === david.id ? '✅ YES' : '❌ NO'}\n`);
        } else {
          console.log('⚠️  No pending workflow steps found\n');
        }
      } else {
        console.log('❌ Workflow instance not found\n');
      }
    }

    // Check if David is Brian's manager
    console.log(`Manager Check:`);
    console.log(`   Brian's Manager ID: ${brian.manager_id || 'NOT SET'}`);
    console.log(`   David's ID: ${david.id}`);
    console.log(`   Match: ${brian.manager_id === david.id ? '✅ YES' : '❌ NO'}\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkApproval();
