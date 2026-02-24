#!/usr/bin/env tsx
/**
 * Script to sync workflow template permissions for System Administrator role
 * 
 * This ensures that:
 * 1. The permissions are assigned to System Administrator role
 * 2. UserPermissionScope entries are created for all System Administrators
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { syncScopesForRolePermission } from '../app/lib/utils/sync-role-permissions';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Syncing workflow template permissions for System Administrator...\n');

  // Find System Administrator role
  const systemAdminRole = await prisma.role.findFirst({
    where: {
      name: { contains: 'System Administrator', mode: 'insensitive' },
      status: 'active',
    },
  });

  if (!systemAdminRole) {
    console.error('❌ System Administrator role not found!');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`✅ Found System Administrator role: ${systemAdminRole.name} (${systemAdminRole.id})\n`);

  // Find workflow template permissions
  const workflowPermissions = [
    'workflows.templates.create',
    'workflows.templates.read',
    'workflows.templates.update',
    'workflows.templates.delete',
  ];

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalScopesCreated = 0;
  let totalScopesSkipped = 0;

  for (const permName of workflowPermissions) {
    const permission = await prisma.permission.findUnique({
      where: { name: permName },
    });

    if (!permission) {
      console.log(`⚠️  Permission ${permName} not found, skipping...`);
      continue;
    }

    // Check if role has permission
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role_id: systemAdminRole.id,
        permission_id: permission.id,
      },
    });

    if (!rolePermission) {
      // Assign permission to role
      await prisma.rolePermission.create({
        data: {
          role_id: systemAdminRole.id,
          permission_id: permission.id,
        },
      });
      console.log(`  ✅ Assigned ${permName} to System Administrator role`);
      totalCreated++;
    } else {
      console.log(`  ⏭️  ${permName} already assigned to System Administrator role`);
      totalSkipped++;
    }

    // Sync scopes for all users with this role
    console.log(`  🔄 Syncing UserPermissionScope entries for ${permName}...`);
    const { created, skipped } = await syncScopesForRolePermission(
      systemAdminRole.id,
      permission.id
    );
    totalScopesCreated += created;
    totalScopesSkipped += skipped;
    console.log(`     ✅ Created ${created} scopes, skipped ${skipped} existing\n`);
  }

  console.log('\n📊 SUMMARY:');
  console.log(`  Role Permissions:`);
  console.log(`    ✅ Created: ${totalCreated}`);
  console.log(`    ⏭️  Already existed: ${totalSkipped}`);
  console.log(`  User Permission Scopes:`);
  console.log(`    ✅ Created: ${totalScopesCreated}`);
  console.log(`    ⏭️  Skipped (already existed): ${totalScopesSkipped}`);

  console.log('\n✅ Sync complete!');
  console.log('💡 System Administrators should now be able to delete workflow templates.');
  console.log('💡 If the delete button still doesn\'t appear, try:');
  console.log('   1. Refresh the page (F5 or Ctrl+R)');
  console.log('   2. Log out and log back in');
  console.log('   3. Clear browser cache');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
