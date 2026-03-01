import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testManagerResolution() {
  console.log('🧪 Testing Manager Resolution...\n');

  // Get Brian
  const brian = await prisma.user.findUnique({
    where: { email: 'brian.kiprotich@test.com' },
    select: {
      id: true,
      name: true,
      email: true,
      manager_id: true,
      primary_location_id: true,
    },
  });

  if (!brian) {
    console.error('❌ Brian not found');
    return;
  }

  console.log('👤 Employee:', {
    id: brian.id,
    name: brian.name,
    manager_id: brian.manager_id,
    location_id: brian.primary_location_id,
  });

  if (!brian.manager_id) {
    console.error('❌ Brian has no manager_id');
    return;
  }

  // Get manager
  const manager = await prisma.user.findUnique({
    where: { id: brian.manager_id },
    include: {
      user_roles: {
        where: { deleted_at: null },
        include: {
          role: {
            where: { status: 'active' },
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

  if (!manager) {
    console.error('❌ Manager not found');
    return;
  }

  console.log('\n👔 Manager:', {
    id: manager.id,
    name: manager.name,
    email: manager.email,
    status: manager.status,
    deleted_at: manager.deleted_at,
    primary_location_id: manager.primary_location_id,
    roles: manager.user_roles.map(ur => ur.role.name),
  });

  // Check permissions
  const hasLeaveApprove = manager.user_roles.some(ur =>
    ur.role.status === 'active' &&
    ur.role.role_permissions.some(rp =>
      rp.permission.name === 'leave.approve'
    )
  );

  const hasTimesheetApprove = manager.user_roles.some(ur =>
    ur.role.status === 'active' &&
    ur.role.role_permissions.some(rp =>
      rp.permission.name === 'timesheet.approve'
    )
  );

  console.log('\n✅ Permissions:', {
    leave_approve: hasLeaveApprove,
    timesheet_approve: hasTimesheetApprove,
  });

  // Check location
  const sameLocation = manager.primary_location_id === brian.primary_location_id;
  console.log('\n📍 Location Check:', {
    manager_location: manager.primary_location_id,
    employee_location: brian.primary_location_id,
    same_location: sameLocation,
  });

  // Final result
  console.log('\n🎯 Resolution Result:', {
    manager_found: !!manager,
    manager_active: manager.status === 'active' && !manager.deleted_at,
    has_leave_permission: hasLeaveApprove,
    has_timesheet_permission: hasTimesheetApprove,
    location_match: sameLocation,
    should_approve_leave: manager.status === 'active' && !manager.deleted_at && hasLeaveApprove && sameLocation,
    should_approve_timesheet: manager.status === 'active' && !manager.deleted_at && hasTimesheetApprove && sameLocation,
  });
}

testManagerResolution()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
