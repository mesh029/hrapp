#!/usr/bin/env tsx
/**
 * Script to update workflow steps with null or empty location_scope to 'all'
 * This fixes existing steps that were created before the default was changed to 'all'
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
  console.log('🔧 Fixing location_scope defaults for workflow steps...\n');

  // Find all steps with null, undefined, or empty location_scope
  const stepsToFix = await prisma.workflowStep.findMany({
    where: {
      OR: [
        { location_scope: null },
        { location_scope: '' },
      ],
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (stepsToFix.length === 0) {
    console.log('✅ No steps found with null or empty location_scope. All steps are already configured.');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`📋 Found ${stepsToFix.length} step(s) to update:\n`);

  for (const step of stepsToFix) {
    console.log(`  • Step ${step.step_order} in template "${step.template.name}" (${step.template.id})`);
    console.log(`    Current location_scope: ${step.location_scope || 'null'}`);
  }

  console.log('\n🔄 Updating steps to location_scope: "all"...\n');

  const result = await prisma.workflowStep.updateMany({
    where: {
      OR: [
        { location_scope: null },
        { location_scope: '' },
      ],
    },
    data: {
      location_scope: 'all',
    },
  });

  console.log(`✅ Updated ${result.count} step(s) to use location_scope: "all"`);
  console.log('\n💡 All workflow steps now default to "Any Location" when location_scope is not specified.');
  console.log('   This matches the UI behavior where "Any Location" is the recommended default.');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
