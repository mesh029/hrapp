/**
 * Script to create User Categories from existing Roles
 * This helps migrate existing role-based groupings to User Categories
 */

// Use relative path that works from scripts directory
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function syncCategoriesFromRoles() {
  try {
    console.log('🔄 Syncing User Categories from existing Roles...\n');

    // Get all active roles
    const roles = await prisma.role.findMany({
      where: {
        status: 'active',
        deleted_at: null,
      },
      orderBy: { name: 'asc' },
    });

    console.log(`Found ${roles.length} active roles:\n`);
    roles.forEach(role => {
      console.log(`  - ${role.name} (${role.description || 'No description'})`);
    });

    // Create User Categories from Roles
    const createdCategories: string[] = [];
    const skippedCategories: string[] = [];

    for (const role of roles) {
      // Check if category already exists
      const existing = await prisma.userCategory.findFirst({
        where: {
          name: role.name,
          deleted_at: null,
        },
      });

      if (existing) {
        console.log(`\n⏭️  Skipping "${role.name}" - User Category already exists`);
        skippedCategories.push(role.name);
        continue;
      }

      // Create User Category from Role
      try {
        const category = await prisma.userCategory.create({
          data: {
            name: role.name,
            description: role.description || `User category for ${role.name} role`,
            priority: 0, // Default priority
          },
        });

        console.log(`✅ Created User Category: "${category.name}"`);
        createdCategories.push(category.name);
      } catch (error: any) {
        console.error(`❌ Failed to create category for "${role.name}":`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Created: ${createdCategories.length} categories`);
    console.log(`  ⏭️  Skipped: ${skippedCategories.length} categories (already exist)`);
    
    if (createdCategories.length > 0) {
      console.log('\nCreated categories:');
      createdCategories.forEach(name => console.log(`  - ${name}`));
    }

    // Also check for common categories that might not be roles
    const commonCategories = [
      { name: 'Admins', description: 'System administrators', priority: 100 },
      { name: 'HR Assistants', description: 'Human resources assistants', priority: 90 },
      { name: 'Employees', description: 'Regular employees', priority: 0 },
      { name: 'Managers', description: 'Management staff', priority: 80 },
    ];

    console.log('\n🔍 Checking for common categories...');
    for (const cat of commonCategories) {
      const existing = await prisma.userCategory.findFirst({
        where: {
          name: cat.name,
          deleted_at: null,
        },
      });

      if (!existing) {
        try {
          await prisma.userCategory.create({
            data: cat,
          });
          console.log(`✅ Created common category: "${cat.name}"`);
          createdCategories.push(cat.name);
        } catch (error: any) {
          console.error(`❌ Failed to create "${cat.name}":`, error.message);
        }
      } else {
        console.log(`⏭️  "${cat.name}" already exists`);
      }
    }

    // Final count
    const finalCount = await prisma.userCategory.count({
      where: { deleted_at: null },
    });

    console.log(`\n✨ Total active User Categories: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error syncing categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncCategoriesFromRoles();
