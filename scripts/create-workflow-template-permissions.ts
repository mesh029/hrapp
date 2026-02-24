#!/usr/bin/env tsx
/**
 * Script to create workflow template permissions
 * 
 * Creates the following permissions:
 * - workflows.templates.create
 * - workflows.templates.read
 * - workflows.templates.update
 * - workflows.templates.delete
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
  console.log('🔧 Creating workflow template permissions...\n');

  const permissions = [
    { name: 'workflows.templates.create', module: 'workflows', description: 'Create workflow templates' },
    { name: 'workflows.templates.read', module: 'workflows', description: 'View workflow templates' },
    { name: 'workflows.templates.update', module: 'workflows', description: 'Update workflow templates' },
    { name: 'workflows.templates.delete', module: 'workflows', description: 'Delete workflow templates' },
  ];

  let created = 0;
  let existing = 0;

  for (const perm of permissions) {
    const existingPerm = await prisma.permission.findUnique({
      where: { name: perm.name },
    });

    if (existingPerm) {
      console.log(`  ⏭️  ${perm.name} already exists`);
      existing++;
    } else {
      await prisma.permission.create({
        data: perm,
      });
      console.log(`  ✅ Created ${perm.name}`);
      created++;
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`  ✅ Created: ${created}`);
  console.log(`  ⏭️  Already existed: ${existing}`);
  console.log(`  📋 Total: ${permissions.length}`);

  // Check if System Administrator role exists and assign all permissions to it
  const systemAdminRole = await prisma.role.findFirst({
    where: {
      name: { contains: 'System Administrator', mode: 'insensitive' },
      status: 'active',
    },
    include: {
      role_permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (systemAdminRole) {
    console.log(`\n🔗 Assigning permissions to System Administrator role...`);
    let assigned = 0;
    let alreadyAssigned = 0;

    for (const perm of permissions) {
      const permission = await prisma.permission.findUnique({
        where: { name: perm.name },
      });

      if (!permission) continue;

      const alreadyHasPermission = systemAdminRole.role_permissions.some(
        rp => rp.permission_id === permission.id
      );

      if (alreadyHasPermission) {
        alreadyAssigned++;
      } else {
        await prisma.rolePermission.create({
          data: {
            role_id: systemAdminRole.id,
            permission_id: permission.id,
          },
        });
        console.log(`  ✅ Assigned ${perm.name} to System Administrator`);
        assigned++;
      }
    }

    console.log(`\n📊 ROLE ASSIGNMENT:`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Already assigned: ${alreadyAssigned}`);
  } else {
    console.log(`\n⚠️  System Administrator role not found. Permissions created but not assigned to any role.`);
  }

  console.log('\n✅ Workflow template permissions setup complete!');
  console.log('💡 You can now assign these permissions to roles in the Administration > Roles section.');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
