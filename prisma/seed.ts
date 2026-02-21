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

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create Permissions
  console.log('📝 Creating permissions...');
  const permissions = [
    // User management
    { name: 'users.create', module: 'users', description: 'Create users' },
    { name: 'users.read', module: 'users', description: 'View users' },
    { name: 'users.update', module: 'users', description: 'Update users' },
    { name: 'users.delete', module: 'users', description: 'Delete users' },
    
    // Role management
    { name: 'roles.create', module: 'roles', description: 'Create roles' },
    { name: 'roles.read', module: 'roles', description: 'View roles' },
    { name: 'roles.update', module: 'roles', description: 'Update roles' },
    { name: 'roles.delete', module: 'roles', description: 'Delete roles' },
    
    // Permission management
    { name: 'permissions.read', module: 'permissions', description: 'View permissions' },
    
    // Location management
    { name: 'locations.create', module: 'locations', description: 'Create locations' },
    { name: 'locations.read', module: 'locations', description: 'View locations' },
    { name: 'locations.update', module: 'locations', description: 'Update locations' },
    { name: 'locations.delete', module: 'locations', description: 'Delete locations' },
    
    // Leave management
    { name: 'leave.create', module: 'leave', description: 'Create leave requests' },
    { name: 'leave.read', module: 'leave', description: 'View leave requests' },
    { name: 'leave.update', module: 'leave', description: 'Update leave requests' },
    { name: 'leave.delete', module: 'leave', description: 'Delete leave requests' },
    { name: 'leave.approve', module: 'leave', description: 'Approve leave requests' },
    { name: 'leave.decline', module: 'leave', description: 'Decline leave requests' },
    
    // Timesheet management
    { name: 'timesheet.create', module: 'timesheet', description: 'Create timesheets' },
    { name: 'timesheet.read', module: 'timesheet', description: 'View timesheets' },
    { name: 'timesheet.update', module: 'timesheet', description: 'Update timesheets' },
    { name: 'timesheet.delete', module: 'timesheet', description: 'Delete timesheets' },
    { name: 'timesheet.approve', module: 'timesheet', description: 'Approve timesheets' },
    { name: 'timesheet.decline', module: 'timesheet', description: 'Decline timesheets' },
    
    // Workflow management
    { name: 'workflows.create', module: 'workflows', description: 'Create workflow templates' },
    { name: 'workflows.read', module: 'workflows', description: 'View workflow templates' },
    { name: 'workflows.update', module: 'workflows', description: 'Update workflow templates' },
    { name: 'workflows.delete', module: 'workflows', description: 'Delete workflow templates' },
    
    // Delegation
    { name: 'delegations.create', module: 'delegations', description: 'Create delegations' },
    { name: 'delegations.read', module: 'delegations', description: 'View delegations' },
    { name: 'delegations.update', module: 'delegations', description: 'Update delegations' },
    { name: 'delegations.delete', module: 'delegations', description: 'Delete delegations' },
    
    // System admin
    { name: 'system.admin', module: 'system', description: 'System administrator access' },
  ];

  const createdPermissions = await Promise.all(
    permissions.map(async (perm) => {
      return prisma.permission.upsert({
        where: { name: perm.name },
        update: {},
        create: perm,
      });
    })
  );

  console.log(`✅ Created ${createdPermissions.length} permissions`);

  // 2. Create Roles
  console.log('👥 Creating roles...');
  const roles = [
    {
      name: 'System Administrator',
      description: 'Full system access with all permissions',
      permissions: permissions.map((p) => p.name), // All permissions
    },
    {
      name: 'HR Manager',
      description: 'HR management with leave and timesheet approval',
      permissions: [
        'users.read',
        'users.update',
        'roles.read',
        'permissions.read',
        'locations.read',
        'leave.read',
        'leave.approve',
        'leave.decline',
        'timesheet.read',
        'timesheet.approve',
        'timesheet.decline',
        'workflows.read',
        'delegations.read',
      ],
    },
    {
      name: 'Program Officer',
      description: 'Regional program officer with approval authority',
      permissions: [
        'users.read',
        'locations.read',
        'leave.read',
        'leave.approve',
        'leave.decline',
        'timesheet.read',
        'timesheet.approve',
        'timesheet.decline',
      ],
    },
    {
      name: 'Manager',
      description: 'Direct manager with approval authority',
      permissions: [
        'users.read',
        'locations.read',
        'leave.read',
        'leave.approve',
        'leave.decline',
        'timesheet.read',
        'timesheet.approve',
        'timesheet.decline',
      ],
    },
    {
      name: 'Employee',
      description: 'Regular employee with basic access',
      permissions: [
        'leave.create',
        'leave.read',
        'leave.update',
        'timesheet.create',
        'timesheet.read',
        'timesheet.update',
      ],
    },
  ];

  const createdRoles = [];
  for (const roleData of roles) {
    const { permissions: rolePerms, ...roleInfo } = roleData;
    const role = await prisma.role.upsert({
      where: { name: roleInfo.name },
      update: {},
      create: roleInfo,
    });

    // Assign permissions to role
    for (const permName of rolePerms) {
      const permission = createdPermissions.find((p) => p.name === permName);
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: role.id,
              permission_id: permission.id,
            },
          },
          update: {},
          create: {
            role_id: role.id,
            permission_id: permission.id,
          },
        });
      }
    }

    createdRoles.push(role);
  }

  console.log(`✅ Created ${createdRoles.length} roles`);

  // 3. Create Locations (PATH offices)
  console.log('📍 Creating locations...');
  const locations = [
    { name: 'Nairobi Office', parent: null },
    { name: 'Kisumu Office', parent: null },
    { name: 'Kakamega Office', parent: null },
    { name: 'Vihiga Office', parent: null },
    { name: 'Nyamira Office', parent: null },
  ];

  const createdLocations = [];
  for (const locData of locations) {
    // Check if location exists
    const existing = await prisma.location.findFirst({
      where: { name: locData.name },
    });

    const location = existing || await prisma.location.create({
      data: {
        name: locData.name,
        parent_id: null,
        path: `${createdLocations.length + 1}`,
        level: 0,
        status: 'active',
      },
    });
    createdLocations.push(location);
  }

  console.log(`✅ Created ${createdLocations.length} locations`);

  // 4. Create Admin User
  console.log('👤 Creating admin user...');
  const adminPassword = 'oneeyedragon';
  const hashedPassword = await hashPassword(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@path.org' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@path.org',
      password_hash: hashedPassword,
      status: 'active',
      primary_location_id: createdLocations[0]?.id, // Nairobi Office
    },
  });

  // Assign System Administrator role to admin user
  const systemAdminRole = createdRoles.find((r) => r.name === 'System Administrator');
  if (systemAdminRole) {
    await prisma.userRole.upsert({
      where: {
        user_id_role_id: {
          user_id: adminUser.id,
          role_id: systemAdminRole.id,
        },
      },
      update: {},
      create: {
        user_id: adminUser.id,
        role_id: systemAdminRole.id,
      },
    });
  }

  console.log('✅ Created admin user: admin@path.org');
  console.log('   Password: oneeyedragon');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   - ${createdPermissions.length} permissions created`);
  console.log(`   - ${createdRoles.length} roles created`);
  console.log(`   - ${createdLocations.length} locations created`);
  console.log('   - 1 admin user created (admin@path.org)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
