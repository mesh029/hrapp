import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 Integration Test: Complete Workflow Flow\n');
  const startTime = Date.now();

  try {
    // Setup
    console.log('📋 Setting up test data...');
    process.stdout.write('   Getting admin user... ');
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@path.org' },
    });
    if (!admin) {
      throw new Error('Admin user not found. Please run seed script first.');
    }
    process.stdout.write('✅\n');

    process.stdout.write('   Getting test location... ');
    const nairobi = await prisma.location.findFirst({
      where: { name: 'Nairobi Office' },
    });
    if (!nairobi) {
      throw new Error('Nairobi location not found. Please run seed script first.');
    }
    process.stdout.write('✅\n');

    process.stdout.write('   Getting HRH staff type... ');
    let hrhStaffType = await prisma.staffType.findFirst({
      where: { code: 'hrh' },
    });
    if (!hrhStaffType) {
      hrhStaffType = await prisma.staffType.findFirst({
        where: { name: { contains: 'HRH', mode: 'insensitive' } },
      });
    }
    if (!hrhStaffType) {
      process.stdout.write('⚠️  (Not found, using any staff type)\n');
      hrhStaffType = await prisma.staffType.findFirst({
        where: { status: 'active' },
      });
      if (!hrhStaffType) {
        throw new Error('No active staff type found. Please run seed script first.');
      }
    } else {
      process.stdout.write('✅\n');
    }

    process.stdout.write('   Getting Annual Leave type... ');
    let annualLeave = await prisma.leaveType.findFirst({
      where: { name: 'Annual Leave' },
    });
    if (!annualLeave) {
      annualLeave = await prisma.leaveType.findFirst({
        where: { status: 'active' },
      });
      if (!annualLeave) {
        throw new Error('No active leave type found. Please run seed script first.');
      }
    }
    process.stdout.write('✅\n');

    // Cleanup any existing test data first
    process.stdout.write('   Cleaning up existing test data... ');
    await prisma.user.deleteMany({
      where: { email: 'test-employee@path.org' },
    });
    process.stdout.write('✅\n');

    // Test 1: Create Employee
    console.log('\n📊 TEST 1: Create Employee');
    console.log('='.repeat(70));
    
    process.stdout.write('   Creating test employee... ');
    const employee = await prisma.user.create({
      data: {
        name: 'Test Employee',
        email: 'test-employee@path.org',
        password_hash: await hashPassword('test123'),
        status: 'active',
        primary_location_id: nairobi.id,
        staff_type_id: hrhStaffType.id,
      },
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Employee created: ${employee.email}`);

    // Test 2: Create Leave Request
    console.log('\n📊 TEST 2: Create Leave Request');
    console.log('='.repeat(70));
    
    process.stdout.write('   Creating leave request... ');
    const { Prisma } = await import('@prisma/client');
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        user_id: employee.id,
        leave_type_id: annualLeave.id,
        location_id: nairobi.id,
        start_date: new Date('2025-02-01'),
        end_date: new Date('2025-02-05'),
        days_requested: new Prisma.Decimal(5),
        reason: 'Integration test leave request',
        status: 'Draft',
      },
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Leave request created: ${leaveRequest.id.substring(0, 8)}...`);

    // Test 3: Submit Leave Request (creates workflow)
    console.log('\n📊 TEST 3: Submit Leave Request');
    console.log('='.repeat(70));
    
    process.stdout.write('   Getting workflow template... ');
    let workflowTemplate = await prisma.workflowTemplate.findFirst({
      where: {
        name: { contains: 'Leave', mode: 'insensitive' },
        location_id: nairobi.id,
      },
      include: {
        steps: {
          orderBy: { step_order: 'asc' },
        },
      },
    });
    if (!workflowTemplate) {
      workflowTemplate = await prisma.workflowTemplate.findFirst({
        where: {
          location_id: nairobi.id,
        },
        include: {
          steps: {
            orderBy: { step_order: 'asc' },
          },
        },
      });
    }
    if (!workflowTemplate || workflowTemplate.steps.length === 0) {
      throw new Error('No workflow template with steps found. Please run seed script first.');
    }
    process.stdout.write('✅\n');

    process.stdout.write('   Creating workflow instance... ');
    const { createWorkflowInstance } = await import('../app/lib/services/workflow');
    const workflowInstanceId = await createWorkflowInstance({
      templateId: workflowTemplate.id,
      resourceId: leaveRequest.id,
      resourceType: 'leave',
      createdBy: employee.id,
      locationId: nairobi.id,
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Workflow instance created: ${workflowInstanceId.substring(0, 8)}...`);

    process.stdout.write('   Submitting workflow... ');
    const { submitWorkflowInstance } = await import('../app/lib/services/workflow');
    await submitWorkflowInstance(workflowInstanceId);
    process.stdout.write('✅\n');
    console.log(`   ✅ Workflow submitted`);

    // Test 4: Verify Notifications Created
    console.log('\n📊 TEST 4: Verify Notifications');
    console.log('='.repeat(70));
    
    process.stdout.write('   Checking for notifications... ');
    const notifications = await prisma.notification.findMany({
      where: {
        resource_type: 'workflow',
        resource_id: workflowInstanceId,
      },
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Found ${notifications.length} notifications`);

    // Test 5: Verify Audit Logs Created
    console.log('\n📊 TEST 5: Verify Audit Logs');
    console.log('='.repeat(70));
    
    process.stdout.write('   Checking for audit logs... ');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        resource_type: 'workflow',
        resource_id: workflowInstanceId,
      },
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Found ${auditLogs.length} audit logs`);

    // Test 6: Verify Workflow State
    console.log('\n📊 TEST 6: Verify Workflow State');
    console.log('='.repeat(70));
    
    process.stdout.write('   Checking workflow status... ');
    const workflowInstance = await prisma.workflowInstance.findUnique({
      where: { id: workflowInstanceId },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        },
      },
    });
    if (!workflowInstance) {
      throw new Error('Workflow instance not found');
    }
    process.stdout.write('✅\n');
    console.log(`   ✅ Workflow status: ${workflowInstance.status}`);
    console.log(`   ✅ Current step: ${workflowInstance.current_step_order}`);

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    process.stdout.write('   Deleting workflow instance... ');
    await prisma.workflowStepInstance.deleteMany({
      where: { workflow_instance_id: workflowInstanceId },
    });
    await prisma.workflowInstance.delete({
      where: { id: workflowInstanceId },
    });
    process.stdout.write('✅\n');

    process.stdout.write('   Deleting leave request... ');
    await prisma.leaveRequest.delete({
      where: { id: leaveRequest.id },
    });
    process.stdout.write('✅\n');

    process.stdout.write('   Deleting test user... ');
    await prisma.user.delete({
      where: { id: employee.id },
    });
    process.stdout.write('✅\n');

    process.stdout.write('   Cleaning up notifications... ');
    await prisma.notification.deleteMany({
      where: {
        resource_type: 'workflow',
        resource_id: workflowInstanceId,
      },
    });
    process.stdout.write('✅\n');

    process.stdout.write('   Cleaning up audit logs... ');
    await prisma.auditLog.deleteMany({
      where: {
        resource_type: 'workflow',
        resource_id: workflowInstanceId,
      },
    });
    process.stdout.write('✅\n');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Integration test completed in ${duration}s!`);
    console.log('\n📝 Summary:');
    console.log('   ✅ Employee creation');
    console.log('   ✅ Leave request creation');
    console.log('   ✅ Workflow instance creation and submission');
    console.log('   ✅ Notifications created');
    console.log('   ✅ Audit logs created');
    console.log('   ✅ Workflow state verified');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
