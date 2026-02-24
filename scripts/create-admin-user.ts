#!/usr/bin/env tsx
/**
 * Create Admin User Script
 * Creates a System Administrator user with full access
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const ADMIN_NAME = 'System Administrator';

async function main() {
  console.log('👤 Creating admin user...\n');

  // Get System Administrator role
  const adminRole = await prisma.role.findFirst({
    where: { name: 'System Administrator' },
  });

  if (!adminRole) {
    throw new Error('System Administrator role not found. Please run db:seed:users first.');
  }

  // Get a location
  const location = await prisma.location.findFirst({
    where: { status: 'active' },
  });

  if (!location) {
    throw new Error('No active location found. Please seed locations first.');
  }

  // Get a staff type
  const staffType = await prisma.staffType.findFirst({
    where: { deleted_at: null },
  });

  if (!staffType) {
    throw new Error('No staff type found. Please seed staff types first.');
  }

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    include: {
      user_roles: {
        where: { deleted_at: null },
        include: {
          role: true,
        },
      },
    },
  });

  if (existingAdmin) {
    // Check if they have admin role
    const hasAdminRole = existingAdmin.user_roles.some(
      ur => ur.role.name === 'System Administrator' && ur.deleted_at === null
    );

    if (hasAdminRole) {
      console.log(`✅ Admin user already exists: ${existingAdmin.name} (${existingAdmin.email})`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      return;
    } else {
      // Add admin role to existing user
      await prisma.userRole.create({
        data: {
          user_id: existingAdmin.id,
          role_id: adminRole.id,
        },
      });
      console.log(`✅ Added System Administrator role to existing user: ${existingAdmin.name} (${existingAdmin.email})`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      return;
    }
  }

  // Create new admin user
  const hashedPassword = await hashPassword(ADMIN_PASSWORD);

  const adminUser = await prisma.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password_hash: hashedPassword,
      status: 'active',
      primary_location_id: location.id,
      staff_type_id: staffType.id,
    },
  });

  // Assign System Administrator role
  await prisma.userRole.create({
    data: {
      user_id: adminUser.id,
      role_id: adminRole.id,
    },
  });

  console.log(`✅ Created admin user:`);
  console.log(`   Name: ${adminUser.name}`);
  console.log(`   Email: ${adminUser.email}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role: System Administrator`);
  console.log(`\n🎯 You can now log in with:`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}\n`);
}

main()
  .catch((error) => {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
