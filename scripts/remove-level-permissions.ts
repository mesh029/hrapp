#!/usr/bin/env tsx
/**
 * Script to remove old leave.approve.level* permissions from the database
 * These are being replaced with a single leave.approve permission
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
  console.log('🧹 Removing old leave.approve.level* permissions...\n');

  // Find all level-based permissions
  const levelPermissions = await prisma.permission.findMany({
    where: {
      name: {
        startsWith: 'leave.approve.level',
      },
    },
    include: {
      role_permissions: {
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      user_scopes: true,
    },
  });

  if (levelPermissions.length === 0) {
    console.log('✅ No level-based permissions found. Nothing to clean up!');
    await prisma.$disconnect();
    return;
  }

  console.log(`📋 Found ${levelPermissions.length} level-based permissions to remove:\n`);
  levelPermissions.forEach(perm => {
    console.log(`  • ${perm.name}`);
    console.log(`    - Assigned to ${perm.role_permissions.length} role(s)`);
    console.log(`    - Has ${perm.user_scopes.length} user scope(s)`);
  });

  console.log('\n🗑️  Removing permissions...\n');

  let removedRolePermissions = 0;
  let removedUserScopes = 0;
  let removedPermissions = 0;

  for (const perm of levelPermissions) {
    console.log(`Processing ${perm.name}...`);

    // Remove from roles first
    if (perm.role_permissions.length > 0) {
      for (const rolePerm of perm.role_permissions) {
        await prisma.rolePermission.delete({
          where: {
            role_id_permission_id: {
              role_id: rolePerm.role_id,
              permission_id: perm.id,
            },
          },
        });
        removedRolePermissions++;
        console.log(`  ✅ Removed from role: ${rolePerm.role.name}`);
      }
    }

    // Remove user permission scopes
    if (perm.user_scopes.length > 0) {
      await prisma.userPermissionScope.deleteMany({
        where: {
          permission_id: perm.id,
        },
      });
      removedUserScopes += perm.user_scopes.length;
      console.log(`  ✅ Removed ${perm.user_scopes.length} user scope(s)`);
    }

    // Finally, delete the permission itself
    await prisma.permission.delete({
      where: {
        id: perm.id,
      },
    });
    removedPermissions++;
    console.log(`  ✅ Deleted permission: ${perm.name}\n`);
  }

  console.log('\n📊 SUMMARY:');
  console.log(`  ✅ Removed ${removedRolePermissions} role-permission assignments`);
  console.log(`  ✅ Removed ${removedUserScopes} user permission scopes`);
  console.log(`  ✅ Deleted ${removedPermissions} level-based permissions`);

  // Verify leave.approve exists
  const leaveApprove = await prisma.permission.findFirst({
    where: {
      name: 'leave.approve',
    },
  });

  if (!leaveApprove) {
    console.log('\n⚠️  WARNING: leave.approve permission not found!');
    console.log('   You may need to run the seed script to create it.');
  } else {
    console.log('\n✅ Verified: leave.approve permission exists');
  }

  console.log('\n✅ Cleanup complete! The old level-based permissions have been removed.');
  console.log('💡 Make sure to assign leave.approve permission to roles that need it.');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
