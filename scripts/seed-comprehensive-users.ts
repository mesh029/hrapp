#!/usr/bin/env tsx
/**
 * Comprehensive User Seeding Script
 * 
 * Phase 1: Clean database
 * Phase 2: Create roles
 * Phase 3: Seed users with hierarchy
 * Phase 4: Verify authentication
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

const DEFAULT_PASSWORD = 'Password123!'; // All users get this password

interface UserSeedData {
  name: string;
  email: string;
  role: string;
  staffType: 'regular' | 'hrh' | 'temporary';
  location: string;
  managerEmail?: string;
}

async function main() {
  console.log('🌱 Starting comprehensive user seeding...\n');

  // ============================================
  // PHASE 1: CLEAN DATABASE
  // ============================================
  console.log('🧹 PHASE 1: Cleaning database...');
  
  // Delete in correct order (respecting foreign keys)
  await prisma.workflowStepInstance.deleteMany({});
  await prisma.workflowInstance.deleteMany({});
  await prisma.workflowStep.deleteMany({});
  await prisma.workflowTemplate.deleteMany({});
  await prisma.leaveBalanceAdjustment.deleteMany({});
  await prisma.leaveBalanceReset.deleteMany({});
  await prisma.leaveBalance.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.timesheetEntry.deleteMany({});
  await prisma.timesheet.deleteMany({});
  await prisma.weekendExtraRequest.deleteMany({});
  await prisma.overtimeRequest.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.delegation.deleteMany({});
  await prisma.userPermissionScope.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.user.deleteMany({});
  
  console.log('✅ Database cleaned\n');

  // ============================================
  // PHASE 2: CREATE ROLES
  // ============================================
  console.log('👥 PHASE 2: Creating roles...');
  
  // Get all permissions
  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(allPermissions.map(p => [p.name, p.id]));

  // Define roles with their permissions
  const rolesToCreate = [
    {
      name: 'System Administrator',
      description: 'Full system access',
      permissions: allPermissions.map(p => p.name),
    },
    {
      name: 'HR Manager',
      description: 'Manages HR operations and approvals',
      permissions: [
        'users.read', 'users.update',
        'leave.read', 'leave.approve', 'leave.decline',
        'timesheet.read', 'timesheet.approve', 'timesheet.decline',
        'workflows.read',
        'delegations.read', 'delegations.create',
      ],
    },
    {
      name: 'HR Assistant',
      description: 'Assists with HR operations',
      permissions: [
        'users.read', 'users.create', 'users.update',
        'leave.read', 'leave.approve',
        'timesheet.read', 'timesheet.approve',
      ],
    },
    {
      name: 'Program Officer',
      description: 'Manages program operations and approvals',
      permissions: [
        'leave.read', 'leave.approve', 'leave.decline',
        'timesheet.read', 'timesheet.approve', 'timesheet.decline',
      ],
    },
    {
      name: 'Technical Advisor',
      description: 'Technical oversight and approvals',
      permissions: [
        'leave.read', 'leave.approve', 'leave.decline',
        'timesheet.read', 'timesheet.approve', 'timesheet.decline',
      ],
    },
    {
      name: 'Chief of Party',
      description: 'Executive oversight and final approvals',
      permissions: [
        'users.read',
        'leave.read', 'leave.approve', 'leave.decline',
        'timesheet.read', 'timesheet.approve', 'timesheet.decline',
        'workflows.read',
        'audit.read',
      ],
    },
  ];

  const createdRoles: Record<string, any> = {};
  
  for (const roleData of rolesToCreate) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: {
        description: roleData.description,
        status: 'active',
      },
      create: {
        name: roleData.name,
        description: roleData.description,
        status: 'active',
      },
    });

    // Assign permissions
    const rolePermissions = roleData.permissions
      .map(permName => permissionMap.get(permName))
      .filter(Boolean) as string[];

    // Remove existing permissions
    await prisma.rolePermission.deleteMany({
      where: { role_id: role.id },
    });

    // Add new permissions
    await prisma.rolePermission.createMany({
      data: rolePermissions.map(permId => ({
        role_id: role.id,
        permission_id: permId,
      })),
    });

    createdRoles[roleData.name] = role;
    console.log(`  ✅ Created role: ${roleData.name}`);
  }

  console.log(`✅ Created ${Object.keys(createdRoles).length} roles\n`);

  // ============================================
  // PHASE 3: GET LOCATIONS AND STAFF TYPES
  // ============================================
  console.log('📍 PHASE 3: Getting locations and staff types...');
  
  const locations = await prisma.location.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
  });

  if (locations.length === 0) {
    throw new Error('No active locations found. Please seed locations first.');
  }

  const staffTypes = await prisma.staffType.findMany({
    where: { deleted_at: null },
  });

  const regularStaffType = staffTypes.find(st => st.code === 'regular') || staffTypes[0];
  const hrhStaffType = staffTypes.find(st => st.code === 'hrh') || staffTypes.find(st => st.code === 'HRH') || regularStaffType;
  const tempStaffType = staffTypes.find(st => st.code === 'temporary') || staffTypes.find(st => st.code === 'temp') || regularStaffType;

  console.log(`  ✅ Found ${locations.length} locations`);
  console.log(`  ✅ Found ${staffTypes.length} staff types\n`);

  // ============================================
  // PHASE 4: SEED USERS WITH HIERARCHY
  // ============================================
  console.log('👤 PHASE 4: Seeding users with hierarchy...\n');

  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
  const nairobi = locations.find(l => l.name.toLowerCase().includes('nairobi')) || locations[0];

  // Define user hierarchy
  const usersToCreate: UserSeedData[] = [
    // Top level - Chief of Party
    {
      name: 'Dr. Sarah Mwangi',
      email: 'sarah.mwangi@test.com',
      role: 'Chief of Party',
      staffType: 'regular',
      location: nairobi.name,
    },
    
    // Second level - HR Manager and Technical Advisor
    {
      name: 'James Ochieng',
      email: 'james.ochieng@test.com',
      role: 'HR Manager',
      staffType: 'regular',
      location: nairobi.name,
      managerEmail: 'sarah.mwangi@test.com',
    },
    {
      name: 'Dr. Mary Wanjiku',
      email: 'mary.wanjiku@test.com',
      role: 'Technical Advisor',
      staffType: 'regular',
      location: nairobi.name,
      managerEmail: 'sarah.mwangi@test.com',
    },
    {
      name: 'Peter Kamau',
      email: 'peter.kamau@test.com',
      role: 'Program Officer',
      staffType: 'regular',
      location: nairobi.name,
      managerEmail: 'sarah.mwangi@test.com',
    },
    
    // Third level - HR Assistants
    {
      name: 'Grace Akinyi',
      email: 'grace.akinyi@test.com',
      role: 'HR Assistant',
      staffType: 'regular',
      location: nairobi.name,
      managerEmail: 'james.ochieng@test.com',
    },
    {
      name: 'David Kipchoge',
      email: 'david.kipchoge@test.com',
      role: 'HR Assistant',
      staffType: 'regular',
      location: nairobi.name,
      managerEmail: 'james.ochieng@test.com',
    },
    
    // Regular Employees
    {
      name: 'John Mutua',
      email: 'john.mutua@test.com',
      role: 'Employee',
      staffType: 'regular',
      location: nairobi.name,
      managerEmail: 'peter.kamau@test.com',
    },
    {
      name: 'Jane Wambui',
      email: 'jane.wambui@test.com',
      role: 'Employee',
      staffType: 'regular',
      location: nairobi.name,
      managerEmail: 'peter.kamau@test.com',
    },
    {
      name: 'Michael Otieno',
      email: 'michael.otieno@test.com',
      role: 'Employee',
      staffType: 'regular',
      location: nairobi.name,
      managerEmail: 'mary.wanjiku@test.com',
    },
    
    // HRH Employees
    {
      name: 'Dr. Lucy Nyawira',
      email: 'lucy.nyawira@test.com',
      role: 'Employee',
      staffType: 'hrh',
      location: nairobi.name,
      managerEmail: 'mary.wanjiku@test.com',
    },
    {
      name: 'Dr. Paul Mwangi',
      email: 'paul.mwangi@test.com',
      role: 'Employee',
      staffType: 'hrh',
      location: nairobi.name,
      managerEmail: 'mary.wanjiku@test.com',
    },
    {
      name: 'Nurse Alice Chebet',
      email: 'alice.chebet@test.com',
      role: 'Employee',
      staffType: 'hrh',
      location: nairobi.name,
      managerEmail: 'grace.akinyi@test.com',
    },
    
    // Temporary Employees
    {
      name: 'Brian Kiprotich',
      email: 'brian.kiprotich@test.com',
      role: 'Employee',
      staffType: 'temporary',
      location: nairobi.name,
      managerEmail: 'david.kipchoge@test.com',
    },
    {
      name: 'Susan Achieng',
      email: 'susan.achieng@test.com',
      role: 'Employee',
      staffType: 'temporary',
      location: nairobi.name,
      managerEmail: 'david.kipchoge@test.com',
    },
  ];

  const createdUsers: Record<string, any> = {};

  // Create users in order (managers first)
  const sortedUsers = usersToCreate.sort((a, b) => {
    if (!a.managerEmail && b.managerEmail) return -1;
    if (a.managerEmail && !b.managerEmail) return 1;
    return 0;
  });

  for (const userData of sortedUsers) {
    const location = locations.find(l => 
      l.name.toLowerCase().includes(userData.location.toLowerCase())
    ) || nairobi;

    const staffType = userData.staffType === 'regular' 
      ? regularStaffType 
      : userData.staffType === 'hrh' 
        ? hrhStaffType 
        : tempStaffType;

    const manager = userData.managerEmail 
      ? createdUsers[userData.managerEmail]
      : null;

    const role = userData.role === 'Employee'
      ? null // Employees don't get a role, they're just users
      : createdRoles[userData.role];

    const user = await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        password_hash: hashedPassword,
        status: 'active',
        primary_location_id: location.id,
        staff_type_id: staffType.id,
        manager_id: manager?.id || null,
      },
    });

    // Assign role if applicable
    if (role) {
      await prisma.userRole.create({
        data: {
          user_id: user.id,
          role_id: role.id,
        },
      });
    }

    createdUsers[userData.email] = user;
    console.log(`  ✅ Created: ${userData.name} (${userData.email}) - ${userData.role || 'Employee'} - ${userData.staffType}`);
    if (manager) {
      console.log(`     └─ Manager: ${manager.name}`);
    }
  }

  console.log(`\n✅ Created ${Object.keys(createdUsers).length} users\n`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('📊 SEEDING SUMMARY:');
  console.log(`  ✅ Roles: ${Object.keys(createdRoles).length}`);
  console.log(`  ✅ Users: ${Object.keys(createdUsers).length}`);
  console.log(`  ✅ Default Password: ${DEFAULT_PASSWORD}`);
  console.log('\n🎯 Users can now log in with their email and the default password');
  console.log('📧 All users have managers assigned (except Chief of Party)');
  console.log('👥 Roles assigned to managers and approvers\n');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
