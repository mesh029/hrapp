import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Seed primary locations for users who don't have one
 * Assigns the first available location (or creates a default one if none exists)
 */
async function main() {
  console.log('🔍 Checking for users without primary locations...');

  // Use raw SQL to find users without primary locations (since schema now requires it)
  const usersWithoutLocation = await prisma.$queryRaw<Array<{ id: string; name: string; email: string }>>`
    SELECT id, name, email
    FROM users
    WHERE primary_location_id IS NULL
      AND deleted_at IS NULL
  `;

  console.log(`Found ${usersWithoutLocation.length} users without primary locations`);

  if (usersWithoutLocation.length === 0) {
    console.log('✅ All users already have primary locations assigned');
    return;
  }

  // Get the first active location, or create a default one
  let defaultLocation = await prisma.location.findFirst({
    where: {
      status: 'active',
    },
    orderBy: {
      created_at: 'asc',
    },
  });

  // If no location exists, create a default one
  if (!defaultLocation) {
    console.log('⚠️  No locations found. Creating default location...');
    defaultLocation = await prisma.location.create({
      data: {
        name: 'Default Location',
        code: 'DEFAULT',
        status: 'active',
        is_system: true,
      },
    });
    console.log(`✅ Created default location: ${defaultLocation.name} (${defaultLocation.id})`);
  } else {
    console.log(`📍 Using existing location: ${defaultLocation.name} (${defaultLocation.id})`);
  }

  // Update all users without locations using raw SQL
  const result = await prisma.$executeRaw`
    UPDATE users
    SET primary_location_id = ${defaultLocation.id}
    WHERE primary_location_id IS NULL
      AND deleted_at IS NULL
  `;

  console.log(`✅ Assigned primary location to ${result} users`);
  console.log('\n📋 Updated users:');
  usersWithoutLocation.forEach(user => {
    console.log(`   - ${user.name} (${user.email})`);
  });
}

main()
  .catch((error) => {
    console.error('❌ Error seeding primary locations:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
