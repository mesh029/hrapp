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
  console.log('🔍 Checking for roles...\n');

  const roles = await prisma.role.findMany({
    where: { status: 'active' },
    include: {
      _count: {
        select: {
          role_permissions: true,
          user_roles: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`✅ Found ${roles.length} active roles:\n`);
  
  if (roles.length === 0) {
    console.log('⚠️  No roles found! Run: npm run db:seed:users\n');
  } else {
    roles.forEach(role => {
      console.log(`  - ${role.name}`);
      console.log(`    ID: ${role.id}`);
      console.log(`    Permissions: ${role._count.role_permissions}`);
      console.log(`    Users: ${role._count.user_roles}`);
      console.log('');
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect().then(() => pool.end()));
