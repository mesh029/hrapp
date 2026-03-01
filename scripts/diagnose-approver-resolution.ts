import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function diagnose() {
  console.log('🔍 DIAGNOSING APPROVER RESOLUTION ISSUES\n');
  console.log('='.repeat(80));

  // 1. Check Brian's data
  console.log('\n1️⃣ CHECKING EMPLOYEE DATA (Brian Kiprotich)');
  console.log('-'.repeat(80));
  const brian = await prisma.user.findUnique({
    where: { email: 'brian.kiprotich@test.com' },
    select: {
      id: true,
      name: true,
      email: true,
      manager_id: true,
      primary_location_id: true,
      status: true,
      deleted_at: true,
    },
  });

  if (!brian) {
    console.error('❌ Brian not found!');
    return;
  }

  console.log('✅ Employee found:', {
    id: brian.id,
    name: brian.name,
    manager_id: brian.manager_id,
    primary_location_id: brian.primary_location_id,
    status: brian.status,
    deleted: !!brian.deleted_at,
  });

  if (!brian.manager_id) {
    console.error('❌ PROBLEM: Brian has no manager_id!');
  }

  // 2. Check Manager (David)
  console.log('\n2️⃣ CHECKING MANAGER (David Kipchoge)');
  console.log('-'.repeat(80));
  if (brian.manager_id) {
    const manager = await prisma.user.findUnique({
      where: { id: brian.manager_id },
      include: {
        user_roles: {
          where: { deleted_at: null },
          include: {
            role: {
              where: { status: 'active' },
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

    if (!manager) {
      console.error('❌ PROBLEM: Manager not found!');
    } else {
      console.log('✅ Manager found:', {
        id: manager.id,
        name: manager.name,
        email: manager.email,
        status: manager.status,
        deleted: !!manager.deleted_at,
        primary_location_id: manager.primary_location_id,
        roles: manager.user_roles.map(ur => ur.role.name),
      });

      const hasLeaveApprove = manager.user_roles.some(ur =>
        ur.role.status === 'active' &&
        ur.role.role_permissions.some(rp =>
          rp.permission.name === 'leave.approve'
        )
      );

      const hasTimesheetApprove = manager.user_roles.some(ur =>
        ur.role.status === 'active' &&
        ur.role.role_permissions.some(rp =>
          rp.permission.name === 'timesheet.approve'
        )
      );

      console.log('✅ Manager permissions:', {
        leave_approve: hasLeaveApprove,
        timesheet_approve: hasTimesheetApprove,
      });

      const sameLocation = manager.primary_location_id === brian.primary_location_id;
      console.log('✅ Location check:', {
        manager_location: manager.primary_location_id,
        employee_location: brian.primary_location_id,
        same_location: sameLocation,
      });

      if (!hasLeaveApprove || !hasTimesheetApprove) {
        console.error('❌ PROBLEM: Manager missing required permissions!');
      }
      if (!sameLocation) {
        console.error('❌ PROBLEM: Manager and employee in different locations!');
      }
    }
  }

  // 3. Check Workflow Templates
  console.log('\n3️⃣ CHECKING WORKFLOW TEMPLATES');
  console.log('-'.repeat(80));
  const templates = await prisma.workflowTemplate.findMany({
    where: { name: { contains: 'SOLID' } },
    include: {
      steps: {
        orderBy: { step_order: 'asc' },
      },
    },
  });

  for (const template of templates) {
    console.log(`\n📋 Template: ${template.name}`);
    console.log(`   Location ID: ${template.location_id}`);
    console.log(`   Resource Type: ${template.resource_type}`);
    console.log(`   Steps: ${template.steps.length}`);
    
    for (const step of template.steps) {
      console.log(`\n   Step ${step.step_order}:`);
      console.log(`     Strategy: ${step.approver_strategy}`);
      console.log(`     Include Manager: ${step.include_manager} (type: ${typeof step.include_manager})`);
      console.log(`     Location Scope: ${step.location_scope}`);
      console.log(`     Required Permission: ${step.required_permission}`);
      console.log(`     Required Roles: ${step.required_roles}`);
      
      // Test resolution for this step
      if (step.approver_strategy === 'manager') {
        console.log(`     🔍 Testing manager resolution...`);
        if (!brian.manager_id) {
          console.error(`     ❌ PROBLEM: Employee has no manager_id!`);
        } else {
          const manager = await prisma.user.findUnique({
            where: { id: brian.manager_id },
            include: {
              user_roles: {
                where: { deleted_at: null },
                include: {
                  role: {
                    where: { status: 'active' },
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

          if (manager && manager.status === 'active' && !manager.deleted_at) {
            const hasPermission = manager.user_roles.some(ur =>
              ur.role.status === 'active' &&
              ur.role.role_permissions.some(rp =>
                rp.permission.name === step.required_permission
              )
            );

            const sameLocation = manager.primary_location_id === brian.primary_location_id;
            const locationMatch = step.location_scope === 'all' || sameLocation;

            console.log(`     ✅ Manager found: ${manager.name}`);
            console.log(`     ✅ Has permission: ${hasPermission}`);
            console.log(`     ✅ Location match: ${locationMatch}`);
            
            if (!hasPermission || !locationMatch) {
              console.error(`     ❌ PROBLEM: Manager should be approver but isn't!`);
            }
          }
        }
      } else if (step.approver_strategy === 'permission' && step.location_scope === 'all') {
        console.log(`     🔍 Testing permission-based resolution (all locations)...`);
        const usersWithPermission = await prisma.user.findMany({
          where: {
            status: 'active',
            deleted_at: null,
            user_roles: {
              some: {
                deleted_at: null,
                role: {
                  status: 'active',
                  role_permissions: {
                    some: {
                      permission: {
                        name: step.required_permission,
                      },
                    },
                  },
                },
              },
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            primary_location_id: true,
          },
        });

        console.log(`     ✅ Found ${usersWithPermission.length} users with permission ${step.required_permission}`);
        if (usersWithPermission.length === 0) {
          console.error(`     ❌ PROBLEM: No users found with permission ${step.required_permission}!`);
        } else {
          console.log(`     ✅ Users:`, usersWithPermission.map(u => u.name).join(', '));
        }
      }
    }
  }

  // 4. Check all users with leave.approve and timesheet.approve
  console.log('\n4️⃣ CHECKING ALL USERS WITH PERMISSIONS');
  console.log('-'.repeat(80));
  
  for (const permission of ['leave.approve', 'timesheet.approve']) {
    console.log(`\n📋 Users with ${permission}:`);
    const users = await prisma.user.findMany({
      where: {
        status: 'active',
        deleted_at: null,
        user_roles: {
          some: {
            deleted_at: null,
            role: {
              status: 'active',
              role_permissions: {
                some: {
                  permission: {
                    name: permission,
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        primary_location_id: true,
      },
    });

    console.log(`   Total: ${users.length} users`);
    users.forEach(u => {
      console.log(`   - ${u.name} (${u.email}) - Location: ${u.primary_location_id}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ DIAGNOSIS COMPLETE');
}

diagnose()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
