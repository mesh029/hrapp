import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://root:root@localhost:5433/hrapp_db?schema=public',
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  console.log('Testing manager query...\n');
  
  // Get Brian
  const brian = await prisma.user.findUnique({
    where: { email: 'brian.kiprotich@test.com' },
    select: {
      id: true,
      manager_id: true,
      primary_location_id: true,
    },
  });

  if (!brian || !brian.manager_id) {
    console.error('Brian or manager not found');
    return;
  }

  console.log('Brian:', {
    id: brian.id,
    manager_id: brian.manager_id,
    location: brian.primary_location_id,
  });

  // Test the exact query from the code
  const manager = await prisma.user.findUnique({
    where: { id: brian.manager_id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      deleted_at: true,
      primary_location_id: true,
      user_roles: {
        where: { deleted_at: null },
        select: {
          role: {
            where: { status: 'active' },
            select: {
              id: true,
              name: true,
              status: true,
              role_permissions: {
                select: {
                  permission: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  console.log('\nManager query result:');
  console.log('Manager:', {
    id: manager?.id,
    name: manager?.name,
    status: manager?.status,
    deleted: !!manager?.deleted_at,
    location: manager?.primary_location_id,
    user_roles_count: manager?.user_roles.length,
  });

  console.log('\nUser roles:');
  manager?.user_roles.forEach((ur, idx) => {
    console.log(`  Role ${idx + 1}:`, {
      role: ur.role ? {
        id: ur.role.id,
        name: ur.role.name,
        status: ur.role.status,
        permissions: ur.role.role_permissions.map(rp => rp.permission.name),
      } : null,
    });
  });

  // Test permission check
  const hasLeaveApprove = manager?.user_roles.some(ur =>
    ur.role && ur.role.status === 'active' &&
    ur.role.role_permissions.some(rp =>
      rp.permission.name === 'leave.approve'
    )
  );

  const hasTimesheetApprove = manager?.user_roles.some(ur =>
    ur.role && ur.role.status === 'active' &&
    ur.role.role_permissions.some(rp =>
      rp.permission.name === 'timesheet.approve'
    )
  );

  console.log('\nPermission checks:');
  console.log('  leave.approve:', hasLeaveApprove);
  console.log('  timesheet.approve:', hasTimesheetApprove);

  // Test location check
  const sameLocation = manager?.primary_location_id === brian.primary_location_id;
  console.log('\nLocation check:');
  console.log('  Same location:', sameLocation);
  console.log('  Manager location:', manager?.primary_location_id);
  console.log('  Employee location:', brian.primary_location_id);
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));
