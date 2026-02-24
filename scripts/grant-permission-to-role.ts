#!/usr/bin/env tsx
/**
 * Script to grant leave.approve permission to HR Manager role
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
  console.log('🔧 Granting leave.approve permission to HR Manager role...\n');

  // Find HR Manager role
  const hrManagerRole = await prisma.role.findFirst({
    where: {
      name: { contains: 'HR Manager', mode: 'insensitive' },
      status: 'active',
    },
  });

  if (!hrManagerRole) {
    console.error('❌ HR Manager role not found!');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`✅ Found role: ${hrManagerRole.name} (${hrManagerRole.id})\n`);

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

  // Check if already assigned
  const existing = await prisma.rolePermission.findUnique({
    where: {
      role_id_permission_id: {
        role_id: hrManagerRole.id,
        permission_id: permission.id,
      },
    },
  });

  if (existing) {
    console.log('✅ Permission already assigned to HR Manager role');
  } else {
    // Assign permission
    await prisma.rolePermission.create({
      data: {
        role_id: hrManagerRole.id,
        permission_id: permission.id,
      },
    });
    console.log('✅ Granted leave.approve permission to HR Manager role');
  }

  // Verify - check users with HR Manager role
  const usersWithRole = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      user_roles: {
        some: {
          role_id: hrManagerRole.id,
          deleted_at: null,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  console.log(`\n👥 Users with HR Manager role (${usersWithRole.length}):`);
  usersWithRole.forEach(user => {
    console.log(`  • ${user.name} (${user.email})`);
  });

  console.log('\n✅ Done! James Ochieng and other HR Managers now have leave.approve permission');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
