#!/usr/bin/env tsx
/**
 * Script to backfill UserPermissionScope entries for all existing users
 * based on their current role assignments.
 * 
 * This fixes the issue where users have permissions through roles but don't
 * have UserPermissionScope entries, which are required for the authority check.
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
  console.log('🔄 Backfilling UserPermissionScope entries for all users...\n');

  // Get all active users
  const users = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
    },
    include: {
      user_roles: {
        where: {
          deleted_at: null,
        },
        include: {
          role: {
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

  console.log(`Found ${users.length} active users to process\n`);

  let totalCreated = 0;
  let totalSkipped = 0;
  const now = new Date();

  for (const user of users) {
    const userLocationId = user.primary_location_id;
    let userCreated = 0;
    let userSkipped = 0;

    // Get all unique permissions from all user's roles
    const permissionSet = new Set<string>();
    for (const userRole of user.user_roles) {
      if (userRole.role && userRole.role.status === 'active') {
        for (const rolePermission of userRole.role.role_permissions) {
          permissionSet.add(rolePermission.permission_id);
        }
      }
    }

    // Create scopes for each permission
    for (const permissionId of permissionSet) {
      // Check if scope already exists
      const existingScope = await prisma.userPermissionScope.findFirst({
        where: {
          user_id: user.id,
          permission_id: permissionId,
          status: 'active',
        },
      });

      if (existingScope) {
        userSkipped++;
        continue;
      }

      // Create scope
      await prisma.userPermissionScope.create({
        data: {
          user_id: user.id,
          permission_id: permissionId,
          location_id: userLocationId || null,
          is_global: !userLocationId, // Global if user has no location
          include_descendants: false,
          valid_from: now,
          valid_until: null, // No expiration
          status: 'active',
        },
      });

      userCreated++;
    }

    if (userCreated > 0) {
      console.log(`  ✅ ${user.name}: Created ${userCreated} scope(s), skipped ${userSkipped}`);
    }

    totalCreated += userCreated;
    totalSkipped += userSkipped;
  }

  console.log('\n📊 SUMMARY:');
  console.log(`  ✅ Created ${totalCreated} UserPermissionScope entries`);
  console.log(`  ⏭️  Skipped ${totalSkipped} existing entries`);
  console.log(`  👥 Processed ${users.length} users`);
  console.log('\n✅ Backfill complete! All users now have scopes for their role permissions.');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
