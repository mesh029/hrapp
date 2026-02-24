#!/usr/bin/env tsx
/**
 * Script to check manager assignments for all employees
 * Helps identify employees without managers when they need them for workflows
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
  console.log('🔍 Checking Manager Assignments...\n');

  // Get all active employees (users with staff_type, excluding system admins)
  const employees = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      staff_type_id: { not: null }, // Only employees, not system users
      user_roles: {
        none: {
          role: {
            role_permissions: {
              some: {
                permission: {
                  name: 'system.admin',
                },
              },
            },
          },
        },
      },
    },
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      staff_type: {
        select: {
          name: true,
        },
      },
      primary_location: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log(`📊 Total Employees: ${employees.length}\n`);

  const employeesWithoutManagers = employees.filter(e => !e.manager_id);
  const employeesWithManagers = employees.filter(e => e.manager_id);

  console.log(`✅ Employees WITH Managers: ${employeesWithManagers.length}`);
  console.log(`⚠️  Employees WITHOUT Managers: ${employeesWithoutManagers.length}\n`);

  if (employeesWithoutManagers.length > 0) {
    console.log('⚠️  EMPLOYEES WITHOUT MANAGERS:');
    console.log('─'.repeat(80));
    employeesWithoutManagers.forEach(emp => {
      console.log(`  • ${emp.name} (${emp.email})`);
      console.log(`    Staff Type: ${emp.staff_type?.name || 'N/A'}`);
      console.log(`    Location: ${emp.primary_location?.name || 'N/A'}`);
      console.log(`    Manager ID: ${emp.manager_id || 'NULL'}`);
      console.log('');
    });
  }

  if (employeesWithManagers.length > 0) {
    console.log('\n✅ EMPLOYEES WITH MANAGERS:');
    console.log('─'.repeat(80));
    employeesWithManagers.slice(0, 10).forEach(emp => {
      console.log(`  • ${emp.name} (${emp.email})`);
      console.log(`    Manager: ${emp.manager?.name || 'N/A'} (${emp.manager?.email || 'N/A'})`);
      console.log(`    Staff Type: ${emp.staff_type?.name || 'N/A'}`);
      console.log('');
    });
    if (employeesWithManagers.length > 10) {
      console.log(`  ... and ${employeesWithManagers.length - 10} more\n`);
    }
  }

  // Check for potential managers (users who could be managers)
  const potentialManagers = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      user_roles: {
        some: {
          role: {
            status: 'active',
            role_permissions: {
              some: {
                permission: {
                  name: { contains: 'approve' },
                },
              },
            },
          },
        },
      },
    },
    include: {
      user_roles: {
        where: { deleted_at: null },
        include: {
          role: {
            select: { name: true },
          },
        },
      },
    },
  });

  console.log(`\n👔 POTENTIAL MANAGERS (Users with approval permissions): ${potentialManagers.length}`);
  potentialManagers.slice(0, 10).forEach(pm => {
    const roles = pm.user_roles.map(ur => ur.role.name).join(', ');
    console.log(`  • ${pm.name} (${pm.email}) - Roles: ${roles}`);
  });
  if (potentialManagers.length > 10) {
    console.log(`  ... and ${potentialManagers.length - 10} more`);
  }

  console.log('\n💡 RECOMMENDATIONS:');
  if (employeesWithoutManagers.length > 0) {
    console.log(`  1. Assign managers to ${employeesWithoutManagers.length} employees without managers`);
    console.log('  2. Use the user management UI or API to assign managers');
    console.log('  3. Managers should have approval permissions for workflow steps');
  } else {
    console.log('  ✅ All employees have managers assigned!');
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
