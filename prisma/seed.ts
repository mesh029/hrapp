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
    { name: 'delegations.revoke', module: 'delegations', description: 'Revoke delegations' },
    
    // System admin
    { name: 'system.admin', module: 'system', description: 'System administrator access' },
    
    // Audit
    { name: 'audit.read', module: 'audit', description: 'View audit logs' },
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

  // 4. Create Staff Types
  console.log('👥 Creating staff types...');
  const staffTypes = [
    { code: 'regular', name: 'Regular Staff', description: 'Regular full-time staff' },
    { code: 'temporary', name: 'Temporary Staff', description: 'Temporary staff' },
    { code: 'hrh', name: 'HRH Staff', description: 'Human Resources for Health staff' },
  ];

  const createdStaffTypes = [];
  for (const stData of staffTypes) {
    const staffType = await prisma.staffType.upsert({
      where: { code: stData.code },
      update: {},
      create: stData,
    });
    createdStaffTypes.push(staffType);
  }
  console.log(`✅ Created ${createdStaffTypes.length} staff types`);

  // 4b. Create Work Hours Configs for Staff Types
  console.log('⏰ Creating work hours configs...');
  const hrhStaffType = createdStaffTypes.find((st) => st.code === 'hrh');
  const regularStaffType = createdStaffTypes.find((st) => st.code === 'regular');
  const tempStaffType = createdStaffTypes.find((st) => st.code === 'temporary');

  if (hrhStaffType) {
    // HRH: Mon-Fri 8 hours/day
    const hrhDays = [
      { day: 1, hours: 8 }, // Monday
      { day: 2, hours: 8 }, // Tuesday
      { day: 3, hours: 8 }, // Wednesday
      { day: 4, hours: 8 }, // Thursday
      { day: 5, hours: 8 }, // Friday
    ];
    for (const dayConfig of hrhDays) {
      const existing = await prisma.workHoursConfig.findFirst({
        where: {
          staff_type_id: hrhStaffType.id,
          location_id: null,
          day_of_week: dayConfig.day,
        },
      });

      if (existing) {
        await prisma.workHoursConfig.update({
          where: { id: existing.id },
          data: { hours: dayConfig.hours, is_active: true },
        });
      } else {
        await prisma.workHoursConfig.create({
          data: {
            staff_type_id: hrhStaffType.id,
            location_id: null,
            day_of_week: dayConfig.day,
            hours: dayConfig.hours,
            is_active: true,
          },
        });
      }
    }
    console.log('   ✅ HRH: Mon-Fri 8 hours/day');
  }

  if (regularStaffType && tempStaffType) {
    // Regular/Temporary: Mon-Thu 8.5 hours, Fri 6 hours
    const regularDays = [
      { day: 1, hours: 8.5 }, // Monday
      { day: 2, hours: 8.5 }, // Tuesday
      { day: 3, hours: 8.5 }, // Wednesday
      { day: 4, hours: 8.5 }, // Thursday
      { day: 5, hours: 6 }, // Friday
    ];
    for (const staffType of [regularStaffType, tempStaffType]) {
      for (const dayConfig of regularDays) {
        const existing = await prisma.workHoursConfig.findFirst({
          where: {
            staff_type_id: staffType.id,
            location_id: null,
            day_of_week: dayConfig.day,
          },
        });

        if (existing) {
          await prisma.workHoursConfig.update({
            where: { id: existing.id },
            data: { hours: dayConfig.hours, is_active: true },
          });
        } else {
          await prisma.workHoursConfig.create({
            data: {
              staff_type_id: staffType.id,
              location_id: null,
              day_of_week: dayConfig.day,
              hours: dayConfig.hours,
              is_active: true,
            },
          });
        }
      }
    }
    console.log('   ✅ Regular/Temporary: Mon-Thu 8.5 hours, Fri 6 hours');
  }

  // 5. Create Admin User
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

  // 6. Create default leave types
  console.log('\n🏖️  Creating default leave types...');
  const leaveTypes = [
    { name: 'Annual Leave', description: 'Paid annual vacation leave', is_paid: true, max_days_per_year: 21 },
    { name: 'Sick Leave', description: 'Paid sick leave', is_paid: true, max_days_per_year: 10 },
    { name: 'Emergency Leave', description: 'Unpaid emergency leave', is_paid: false, max_days_per_year: null },
    { name: 'Maternity Leave', description: 'Paid maternity leave', is_paid: true, max_days_per_year: 90 },
    { name: 'Paternity Leave', description: 'Paid paternity leave', is_paid: true, max_days_per_year: 14 },
  ];

  const createdLeaveTypes = [];
  for (const ltData of leaveTypes) {
    const leaveType = await prisma.leaveType.upsert({
      where: { name: ltData.name },
      update: {},
      create: ltData,
    });
    createdLeaveTypes.push(leaveType);
  }
  console.log(`✅ Created ${createdLeaveTypes.length} leave types`);

  // 7. Create default leave accrual configs (1.75 days/month default)
  console.log('\n📊 Creating default leave accrual configs...');
  const accrualConfigs = [];
  
  // Default accrual config for Annual Leave (1.75 days/month for all)
  for (const leaveType of createdLeaveTypes) {
    if (leaveType.name === 'Annual Leave') {
      // System default (location=null, staff_type=null)
      // Check if exists first (can't use upsert with null in unique constraint)
      const existing = await prisma.leaveAccrualConfig.findFirst({
        where: {
          leave_type_id: leaveType.id,
          location_id: null,
          staff_type_id: null,
          deleted_at: null,
        },
      });

      if (!existing) {
        const defaultConfig = await prisma.leaveAccrualConfig.create({
          data: {
            leave_type_id: leaveType.id,
            location_id: null,
            staff_type_id: null,
            accrual_rate: 1.75, // 1.75 days per month
            accrual_period: 'monthly',
            is_active: true,
          },
        });
        accrualConfigs.push(defaultConfig);
      } else {
        accrualConfigs.push(existing);
      }
    }
  }
  console.log(`✅ Created ${accrualConfigs.length} default accrual configs`);
  console.log('   Default: 1.75 days/month for Annual Leave (system-wide)');

  // 8. Create default workflow templates for each location
  console.log('\n📋 Creating default workflow templates...');
  const workflowTemplates = [];

  // Get leave.approve permission
  const leaveApprovePermission = await prisma.permission.findUnique({
    where: { name: 'leave.approve' },
  });

  const timesheetApprovePermission = await prisma.permission.findUnique({
    where: { name: 'timesheet.approve' },
  });

  if (leaveApprovePermission && timesheetApprovePermission) {
    // Create workflow templates for each location
    for (const location of createdLocations) {
      // Leave Request Workflow (3-step: Manager → Program Officer → HR Manager)
      const leaveTemplate = await prisma.workflowTemplate.create({
        data: {
          name: `${location.name} - Leave Request Approval`,
          resource_type: 'leave',
          location_id: location.id,
          version: 1,
          status: 'active',
          steps: {
            create: [
              {
                step_order: 1,
                required_permission: 'leave.approve',
                allow_decline: true,
                allow_adjust: true,
              },
              {
                step_order: 2,
                required_permission: 'leave.approve',
                allow_decline: true,
                allow_adjust: false,
              },
              {
                step_order: 3,
                required_permission: 'leave.approve',
                allow_decline: true,
                allow_adjust: false,
              },
            ],
          },
        },
        include: {
          steps: true,
        },
      });
      workflowTemplates.push(leaveTemplate);

      // Timesheet Approval Workflow (2-step: Manager → HR Manager)
      const timesheetTemplate = await prisma.workflowTemplate.create({
        data: {
          name: `${location.name} - Timesheet Approval`,
          resource_type: 'timesheet',
          location_id: location.id,
          version: 1,
          status: 'active',
          steps: {
            create: [
              {
                step_order: 1,
                required_permission: 'timesheet.approve',
                allow_decline: true,
                allow_adjust: true,
              },
              {
                step_order: 2,
                required_permission: 'timesheet.approve',
                allow_decline: true,
                allow_adjust: false,
              },
            ],
          },
        },
        include: {
          steps: true,
        },
      });
      workflowTemplates.push(timesheetTemplate);
    }

    console.log(`✅ Created ${workflowTemplates.length} workflow templates`);
    console.log('   Note: These are example templates and can be modified or deleted');
  }

  // 9. Seed Kenya holidays
  console.log('\n🇰🇪 Seeding Kenya national holidays...');
  const { seedKenyaHolidays } = await import('../app/lib/services/country-holidays');
  const seededHolidays = await seedKenyaHolidays();
  console.log(`✅ Seeded ${seededHolidays.length} Kenya holidays`);
  if (seededHolidays.length > 0) {
    console.log(`   Holidays: ${seededHolidays.slice(0, 5).join(', ')}${seededHolidays.length > 5 ? '...' : ''}`);
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   - ${createdPermissions.length} permissions created`);
  console.log(`   - ${createdRoles.length} roles created`);
  console.log(`   - ${createdLocations.length} locations created`);
  console.log(`   - ${createdStaffTypes.length} staff types created`);
  console.log(`   - ${createdLeaveTypes.length} leave types created`);
  console.log(`   - ${accrualConfigs.length} accrual configs created`);
  console.log(`   - ${workflowTemplates.length} workflow templates created`);
  console.log(`   - ${seededHolidays.length} Kenya holidays seeded`);
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
