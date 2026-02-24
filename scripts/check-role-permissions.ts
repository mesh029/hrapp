#!/usr/bin/env tsx
/**
 * Script to check if a role has the required permission
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
  const roleName = process.argv[2] || 'HR Assistant';
  const permissionName = process.argv[3] || 'leave.approve';

  console.log(`🔍 Checking if "${roleName}" role has "${permissionName}" permission...\n`);

  // Find the role
  const role = await prisma.role.findFirst({
    where: {
      name: { equals: roleName, mode: 'insensitive' },
    },
    include: {
      role_permissions: {
        include: {
          permission: true,
        },
      },
      user_roles: {
        where: { deleted_at: null },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              deleted_at: true,
              primary_location_id: true,
            },
          },
        },
      },
    },
  });

  if (!role) {
    console.error(`❌ Role "${roleName}" not found!`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`✅ Found role: ${role.name} (${role.id})`);
  console.log(`   Status: ${role.status}\n`);

  // Check if role has the permission
  const hasPermission = role.role_permissions.some(
    rp => rp.permission.name === permissionName
  );

  if (hasPermission) {
    console.log(`✅ Role HAS "${permissionName}" permission`);
  } else {
    console.log(`❌ Role DOES NOT have "${permissionName}" permission`);
    
    // Find the permission
    const permission = await prisma.permission.findFirst({
      where: { name: permissionName },
    });

    if (!permission) {
      console.error(`\n❌ Permission "${permissionName}" not found in database!`);
      console.log('   You may need to run the seed script to create it.');
    } else {
      console.log(`\n💡 To fix this, assign "${permissionName}" to the "${roleName}" role.`);
      console.log(`   You can do this via the Roles page in the UI, or run:`);
      console.log(`   npm run tsx scripts/grant-permission-to-role.ts`);
    }
  }

  // List all permissions for this role
  console.log(`\n📋 Current permissions for "${roleName}":`);
  if (role.role_permissions.length === 0) {
    console.log('   No permissions assigned');
  } else {
    role.role_permissions.forEach(rp => {
      console.log(`   • ${rp.permission.name}`);
    });
  }

  // List users with this role
  const activeUsers = role.user_roles
    .filter(ur => ur.user && ur.user.status === 'active' && !ur.user.deleted_at)
    .map(ur => ur.user!)
    .filter((u): u is NonNullable<typeof u> => u !== null);

  console.log(`\n👥 Users with "${roleName}" role (${activeUsers.length}):`);
  if (activeUsers.length === 0) {
    console.log('   No active users found with this role');
  } else {
    for (const user of activeUsers) {
      console.log(`   • ${user.name} (${user.email})`);
      if (user.primary_location_id) {
        const location = await prisma.location.findUnique({
          where: { id: user.primary_location_id },
          select: { name: true },
        });
        console.log(`     Location: ${location?.name || user.primary_location_id}`);
      } else {
        console.log(`     Location: None`);
      }
    }
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
