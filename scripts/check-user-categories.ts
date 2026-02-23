/**
 * Script to check existing user categories in the database
 */

import { prisma } from '../app/lib/db';

async function checkUserCategories() {
  try {
    console.log('🔍 Checking user categories in database...\n');

    // Check all categories (including deleted)
    const allCategories = await prisma.userCategory.findMany({
      orderBy: { name: 'asc' },
    });

    console.log(`📊 Total categories (including deleted): ${allCategories.length}`);
    console.log('\nAll Categories:');
    allCategories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id})`);
      console.log(`    Description: ${cat.description || 'N/A'}`);
      console.log(`    Color: ${cat.color || 'N/A'}`);
      console.log(`    Priority: ${cat.priority}`);
      console.log(`    Deleted: ${cat.deleted_at ? 'YES' : 'NO'}`);
      if (cat.deleted_at) {
        console.log(`    Deleted At: ${cat.deleted_at}`);
      }
      console.log('');
    });

    // Check only active categories
    const activeCategories = await prisma.userCategory.findMany({
      where: {
        deleted_at: null,
      },
      include: {
        _count: {
          select: {
            assignments: true,
            visibility_configs: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { name: 'asc' },
      ],
    });

    console.log(`\n✅ Active categories (not deleted): ${activeCategories.length}`);
    if (activeCategories.length > 0) {
      console.log('\nActive Categories:');
      activeCategories.forEach(cat => {
        console.log(`  - ${cat.name}`);
        console.log(`    Users assigned: ${cat._count.assignments}`);
        console.log(`    Visibility configs: ${cat._count.visibility_configs}`);
      });
    } else {
      console.log('\n⚠️  No active categories found!');
      console.log('   This is why the API returns an empty array.');
    }

    // Check if there are any categories that should be active
    const softDeleted = allCategories.filter(c => c.deleted_at !== null);
    if (softDeleted.length > 0) {
      console.log(`\n🗑️  Soft-deleted categories: ${softDeleted.length}`);
      console.log('   These are filtered out by the API:');
      softDeleted.forEach(cat => {
        console.log(`     - ${cat.name} (deleted at: ${cat.deleted_at})`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserCategories();
