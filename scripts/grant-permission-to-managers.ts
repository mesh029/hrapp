#!/usr/bin/env tsx
/**
 * Script to grant leave.approve permission to all users who have direct reports (managers)
 * This ensures anyone who manages people can approve leave requests
 */

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
  console.log('🔧 Granting leave.approve permission to all managers (users with direct reports)...\n');

  // Find leave.approve permission
  const permission = await prisma.permission.findFirst({
    where: {
      name: 'leave.approve',
    },
  });

  if (!permission) {
    console.error('❌ Permission leave.approve not found!');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`✅ Found permission: ${permission.name} (${permission.id})\n`);

  // Find all users who have direct reports (they are managers)
  const managers = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      direct_reports: {
        some: {
          status: 'active',
          deleted_at: null,
        },
      },
    },
    include: {
      direct_reports: {
        where: {
          status: 'active',
          deleted_at: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      user_roles: {
        where: { deleted_at: null },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
  });

  console.log(`👔 Found ${managers.length} managers (users with direct reports):\n`);

  let grantedCount = 0;
  let alreadyHadCount = 0;
  let noRoleCount = 0;

  for (const manager of managers) {
    console.log(`  • ${manager.name} (${manager.email})`);
    console.log(`    Direct Reports: ${manager.direct_reports.length}`);
    manager.direct_reports.forEach(report => {
      console.log(`      └─ ${report.name} (${report.email})`);
    });

    // Get all active roles for this manager
    const activeRoles = manager.user_roles
      .filter(ur => ur.role.status === 'active')
      .map(ur => ur.role);

    if (activeRoles.length === 0) {
      console.log(`    ⚠️  No active roles assigned - cannot grant permission`);
      noRoleCount++;
    } else {
      // Grant permission to all their roles
      for (const role of activeRoles) {
        const existing = await prisma.rolePermission.findUnique({
          where: {
            role_id_permission_id: {
              role_id: role.id,
              permission_id: permission.id,
            },
          },
        });

        if (existing) {
          console.log(`    ✅ Role "${role.name}" already has permission`);
          alreadyHadCount++;
        } else {
          await prisma.rolePermission.create({
            data: {
              role_id: role.id,
              permission_id: permission.id,
            },
          });
          console.log(`    ✅ Granted permission to role "${role.name}"`);
          grantedCount++;
        }
      }
    }
    console.log('');
  }

  console.log('\n📊 SUMMARY:');
  console.log(`  ✅ Permission granted to ${grantedCount} role(s)`);
  console.log(`  ✅ ${alreadyHadCount} role(s) already had permission`);
  console.log(`  ⚠️  ${noRoleCount} manager(s) have no roles assigned`);
  console.log(`  👔 Total managers: ${managers.length}`);

  if (noRoleCount > 0) {
    console.log('\n💡 RECOMMENDATION:');
    console.log(`  Assign roles to ${noRoleCount} manager(s) who don't have any roles yet.`);
    console.log('  Use the user edit page to assign roles to these managers.');
  }

  console.log('\n✅ Done! All managers (users with direct reports) now have leave.approve permission');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
