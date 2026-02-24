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
  console.log('🔍 Checking for admin users...\n');

  // Find System Administrator role
  const adminRole = await prisma.role.findFirst({
    where: { name: 'System Administrator' },
    include: {
      user_roles: {
        where: { deleted_at: null },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!adminRole) {
    console.log('❌ System Administrator role not found');
  } else {
    console.log(`✅ Found System Administrator role`);
    console.log(`   Users with admin role: ${adminRole.user_roles.length}\n`);
    
    if (adminRole.user_roles.length === 0) {
      console.log('⚠️  No users have the System Administrator role!\n');
    } else {
      console.log('👥 Admin users:');
      adminRole.user_roles.forEach(ur => {
        console.log(`   - ${ur.user.name} (${ur.user.email}) - Status: ${ur.user.status}`);
      });
    }
  }

  // Also check all users
  const allUsers = await prisma.user.findMany({
    where: { deleted_at: null },
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

  console.log(`\n📊 Total users in system: ${allUsers.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));
