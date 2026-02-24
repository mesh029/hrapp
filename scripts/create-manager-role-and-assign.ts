#!/usr/bin/env tsx
/**
 * Script to create "Manager" role and assign it to all users who have direct reports
 * This ensures that anyone who manages someone else automatically gets the "Manager" role
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
  console.log('🔧 Creating "Manager" role and assigning to all users with direct reports...\n');

  // Find or create "Manager" role
  let managerRole = await prisma.role.findFirst({
    where: {
      name: { equals: 'Manager', mode: 'insensitive' },
    },
  });

  if (!managerRole) {
    console.log('📝 Creating "Manager" role...');
    managerRole = await prisma.role.create({
      data: {
        name: 'Manager',
        description: 'Automatically assigned to users who have direct reports (people who manage others)',
        status: 'active',
      },
    });
    console.log(`✅ Created role: ${managerRole.name} (${managerRole.id})\n`);
  } else {
    console.log(`✅ Found existing role: ${managerRole.name} (${managerRole.id})\n`);
    
    // Ensure it's active
    if (managerRole.status !== 'active') {
      await prisma.role.update({
        where: { id: managerRole.id },
        data: { status: 'active' },
      });
      console.log('✅ Activated Manager role\n');
    }
  }

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

  // Grant permission to Manager role
  const existingPermission = await prisma.rolePermission.findUnique({
    where: {
      role_id_permission_id: {
        role_id: managerRole.id,
        permission_id: permission.id,
      },
    },
  });

  if (!existingPermission) {
    await prisma.rolePermission.create({
      data: {
        role_id: managerRole.id,
        permission_id: permission.id,
      },
    });
    console.log(`✅ Granted leave.approve permission to Manager role\n`);
  } else {
    console.log(`✅ Manager role already has leave.approve permission\n`);
  }

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
        where: {
          role_id: managerRole.id,
          deleted_at: null,
        },
      },
    },
  });

  console.log(`👔 Found ${managers.length} users with direct reports:\n`);

  let assignedCount = 0;
  let alreadyAssignedCount = 0;

  for (const manager of managers) {
    console.log(`  • ${manager.name} (${manager.email})`);
    console.log(`    Direct Reports: ${manager.direct_reports.length}`);
    manager.direct_reports.forEach(report => {
      console.log(`      └─ ${report.name} (${report.email})`);
    });

    // Check if already has Manager role
    const hasManagerRole = manager.user_roles.length > 0;

    if (hasManagerRole) {
      console.log(`    ✅ Already has Manager role`);
      alreadyAssignedCount++;
    } else {
      // Assign Manager role
      await prisma.userRole.create({
        data: {
          user_id: manager.id,
          role_id: managerRole.id,
        },
      });
      console.log(`    ✅ Assigned Manager role`);
      assignedCount++;
    }
    console.log('');
  }

  // Also check for users who might have been assigned Manager role but don't have direct reports anymore
  // (cleanup - optional, but good for data integrity)
  const usersWithManagerRole = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      user_roles: {
        some: {
          role_id: managerRole.id,
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
      },
    },
  });

  let removedCount = 0;
  for (const user of usersWithManagerRole) {
    if (user.direct_reports.length === 0) {
      // This user has Manager role but no direct reports - remove the role
      await prisma.userRole.updateMany({
        where: {
          user_id: user.id,
          role_id: managerRole.id,
        },
        data: {
          deleted_at: new Date(),
        },
      });
      console.log(`  🗑️  Removed Manager role from ${user.name} (no direct reports)`);
      removedCount++;
    }
  }

  console.log('\n📊 SUMMARY:');
  console.log(`  ✅ Assigned Manager role to ${assignedCount} user(s)`);
  console.log(`  ✅ ${alreadyAssignedCount} user(s) already had Manager role`);
  if (removedCount > 0) {
    console.log(`  🗑️  Removed Manager role from ${removedCount} user(s) (no longer have direct reports)`);
  }
  console.log(`  👔 Total managers (users with direct reports): ${managers.length}`);
  console.log(`  🔑 Manager role has leave.approve permission`);

  console.log('\n✅ Done! All users who manage others now have the "Manager" role');
  console.log('💡 This role will be automatically used in workflow templates when "Manager" is selected as a required role');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
