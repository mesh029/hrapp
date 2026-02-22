import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 Testing Phase 8: Notifications & Audit\n');
  const startTime = Date.now();

  try {
    // 1. Test Notification Creation
    console.log('📋 TEST 1: Notification Creation');
    console.log('='.repeat(70));
    
    process.stdout.write('   Getting admin user... ');
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@path.org' },
    });
    if (!admin) {
      throw new Error('Admin user not found. Please run seed script first.');
    }
    process.stdout.write('✅\n');

    process.stdout.write('   Creating test notification... ');
    const { createNotification } = await import('../app/lib/services/notification');
    const notification = await createNotification({
      userId: admin.id,
      type: 'approval_request',
      title: 'Test Notification',
      message: 'This is a test notification',
      resourceType: 'workflow',
      resourceId: 'test-workflow-id',
      sendEmail: false,
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Notification created: ${notification.id.substring(0, 8)}...`);

    // 2. Test Notification Retrieval
    console.log('\n📋 TEST 2: Notification Retrieval');
    console.log('='.repeat(70));
    
    process.stdout.write('   Getting notifications for user... ');
    const { getNotificationsForUser } = await import('../app/lib/services/notification');
    const notifications = await getNotificationsForUser(admin.id, { limit: 10 });
    process.stdout.write('✅\n');
    console.log(`   ✅ Found ${notifications.total} notifications (${notifications.unreadCount} unread)`);

    // 3. Test Mark as Read
    console.log('\n📋 TEST 3: Mark Notification as Read');
    console.log('='.repeat(70));
    
    process.stdout.write('   Marking notification as read... ');
    const { markNotificationAsRead } = await import('../app/lib/services/notification');
    const readNotification = await markNotificationAsRead(notification.id, admin.id);
    process.stdout.write('✅\n');
    console.log(`   ✅ Notification marked as read: ${readNotification.is_read}`);

    // 4. Test Audit Log Creation
    console.log('\n📋 TEST 4: Audit Log Creation');
    console.log('='.repeat(70));
    
    process.stdout.write('   Creating audit log... ');
    const { AuditHelpers } = await import('../app/lib/services/audit');
    const auditLog = await AuditHelpers.logWorkflowAction(
      admin.id,
      'approve',
      'test-workflow-id',
      'leave',
      'test-leave-id',
      { status: 'UnderReview' },
      { status: 'Approved' },
      { step_order: 1, comment: 'Test approval' },
      '127.0.0.1'
    );
    process.stdout.write('✅\n');
    console.log(`   ✅ Audit log created: ${auditLog.id.substring(0, 8)}...`);

    // 5. Test Audit Log Retrieval
    console.log('\n📋 TEST 5: Audit Log Retrieval');
    console.log('='.repeat(70));
    
    process.stdout.write('   Getting audit logs... ');
    const { getAuditLogs } = await import('../app/lib/services/audit');
    const auditLogs = await getAuditLogs({
      actorId: admin.id,
      action: 'workflow.approve',
      limit: 10,
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Found ${auditLogs.total} audit logs`);

    // 6. Test Audit Log Filtering
    console.log('\n📋 TEST 6: Audit Log Filtering');
    console.log('='.repeat(70));
    
    process.stdout.write('   Testing date range filter... ');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    
    const filteredLogs = await getAuditLogs({
      startDate,
      endDate,
      limit: 10,
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Found ${filteredLogs.total} audit logs in date range`);

    process.stdout.write('   Testing resource type filter... ');
    const resourceLogs = await getAuditLogs({
      resourceType: 'workflow',
      limit: 10,
    });
    process.stdout.write('✅\n');
    console.log(`   ✅ Found ${resourceLogs.total} workflow audit logs`);

    // 7. Test Notification Helpers
    console.log('\n📋 TEST 7: Notification Helpers');
    console.log('='.repeat(70));
    
    process.stdout.write('   Testing workflow step assignment notification... ');
    const { NotificationHelpers } = await import('../app/lib/services/notification');
    const stepNotification = await NotificationHelpers.notifyWorkflowStepAssignment(
      admin.id,
      'test-workflow-id',
      'leave',
      'test-leave-id',
      1
    );
    process.stdout.write('✅\n');
    console.log(`   ✅ Step assignment notification created`);

    process.stdout.write('   Testing workflow complete notification... ');
    const completeNotification = await NotificationHelpers.notifyWorkflowComplete(
      admin.id,
      'test-workflow-id',
      'leave',
      'test-leave-id',
      'Approved'
    );
    process.stdout.write('✅\n');
    console.log(`   ✅ Workflow complete notification created`);

    // 8. Test Audit Log Helpers
    console.log('\n📋 TEST 8: Audit Log Helpers');
    console.log('='.repeat(70));
    
    process.stdout.write('   Testing leave request audit log... ');
    const leaveAuditLog = await AuditHelpers.logLeaveRequestAction(
      admin.id,
      'create',
      'test-leave-id',
      undefined,
      { status: 'Draft', days: 5 },
      undefined,
      '127.0.0.1'
    );
    process.stdout.write('✅\n');
    console.log(`   ✅ Leave request audit log created`);

    process.stdout.write('   Testing timesheet audit log... ');
    const timesheetAuditLog = await AuditHelpers.logTimesheetAction(
      admin.id,
      'submit',
      'test-timesheet-id',
      { status: 'Draft' },
      { status: 'Submitted' },
      undefined,
      '127.0.0.1'
    );
    process.stdout.write('✅\n');
    console.log(`   ✅ Timesheet audit log created`);

    // 9. Cleanup
    console.log('\n🧹 Cleaning up...');
    process.stdout.write('   Deleting test notifications... ');
    await prisma.notification.deleteMany({
      where: {
        user_id: admin.id,
        resource_id: { in: ['test-workflow-id', 'test-leave-id', 'test-timesheet-id'] },
      },
    });
    process.stdout.write('✅\n');

    process.stdout.write('   Deleting test audit logs... ');
    await prisma.auditLog.deleteMany({
      where: {
        resource_id: { in: ['test-workflow-id', 'test-leave-id', 'test-timesheet-id'] },
      },
    });
    process.stdout.write('✅\n');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ All Phase 8 tests completed in ${duration}s!`);
    console.log('\n📝 Summary:');
    console.log('   ✅ Notification creation and retrieval');
    console.log('   ✅ Mark notification as read');
    console.log('   ✅ Audit log creation and retrieval');
    console.log('   ✅ Audit log filtering (date range, resource type)');
    console.log('   ✅ Notification helpers (workflow events)');
    console.log('   ✅ Audit log helpers (leave, timesheet)');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
