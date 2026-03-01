import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function findDavid() {
  try {
    console.log('🔍 Finding David Kipchoge...\n');

    // Find David
    const david = await prisma.user.findFirst({
      where: {
        OR: [
          { name: { contains: 'David', mode: 'insensitive' } },
          { name: { contains: 'Kipchoge', mode: 'insensitive' } },
        ],
      },
      include: {
        primary_location: {
          select: { id: true, name: true },
        },
        user_roles: {
          where: { deleted_at: null },
          include: {
            role: {
              select: { name: true, status: true },
            },
          },
        },
        direct_reports: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!david) {
      console.log('❌ David Kipchoge not found');
      console.log('\nSearching for all users with "manager" in name or role...\n');
      
      const allUsers = await prisma.user.findMany({
        where: {
          deleted_at: null,
          status: 'active',
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
        take: 20,
      });

      console.log('Available users:');
      allUsers.forEach(u => {
        const roles = u.user_roles.map(ur => ur.role.name).join(', ');
        console.log(`  - ${u.name} (${u.email}) - Roles: ${roles || 'None'}`);
      });
      return;
    }

    console.log('✅ Found David Kipchoge:');
    console.log(`   ID: ${david.id}`);
    console.log(`   Email: ${david.email}`);
    console.log(`   Name: ${david.name}`);
    console.log(`   Primary Location: ${david.primary_location?.name || 'NOT SET'}`);
    console.log(`   Status: ${david.status}\n`);

    console.log('Roles:');
    david.user_roles.forEach(ur => {
      console.log(`   - ${ur.role.name} (${ur.role.status})`);
    });
    console.log('');

    console.log('Direct Reports (employees managed by David):');
    if (david.direct_reports.length === 0) {
      console.log('   No direct reports found');
    } else {
      david.direct_reports.forEach(emp => {
        console.log(`   - ${emp.name} (${emp.email})`);
      });
    }
    console.log('');

    // Check if David has timesheet.approve permission
    const managerRole = david.user_roles.find(ur => 
      ur.role.name.toLowerCase().includes('manager') || 
      ur.role.name.toLowerCase().includes('hr')
    );

    if (managerRole) {
      const rolePermissions = await prisma.rolePermission.findMany({
        where: {
          role_id: managerRole.role_id,
        },
        include: {
          permission: {
            select: { name: true },
          },
        },
      });

      const hasApprove = rolePermissions.some(rp => rp.permission.name === 'timesheet.approve');
      console.log(`Timesheet Approval Permission: ${hasApprove ? '✅ YES' : '❌ NO'}\n`);
    }

    // Find Brian's submitted timesheets
    const brian = await prisma.user.findFirst({
      where: {
        name: { contains: 'Brian', mode: 'insensitive' },
      },
    });

    if (brian) {
      console.log(`\nFinding Brian's submitted timesheets...`);
      const timesheets = await prisma.timesheet.findMany({
        where: {
          user_id: brian.id,
          status: { in: ['Submitted', 'UnderReview'] },
          deleted_at: null,
        },
        include: {
          workflow_instance: {
            select: {
              id: true,
              status: true,
              current_step_order: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 5,
      });

      console.log(`Found ${timesheets.length} submitted timesheets:\n`);
      timesheets.forEach(ts => {
        console.log(`  - Timesheet ID: ${ts.id}`);
        console.log(`    Status: ${ts.status}`);
        console.log(`    Period: ${ts.period_start.toLocaleDateString()} - ${ts.period_end.toLocaleDateString()}`);
        console.log(`    Workflow Instance: ${ts.workflow_instance_id || 'NOT SET'}`);
        if (ts.workflow_instance) {
          console.log(`    Workflow Status: ${ts.workflow_instance.status}`);
          console.log(`    Current Step: ${ts.workflow_instance.current_step_order}`);
        }
        console.log('');
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

findDavid();
