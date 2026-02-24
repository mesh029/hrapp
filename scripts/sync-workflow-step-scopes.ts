#!/usr/bin/env tsx
/**
 * Script to sync UserPermissionScope entries for all existing workflow steps
 * 
 * This ensures that users with required roles have scopes at the correct locations
 * based on each workflow step's location_scope configuration.
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
  console.log('🔄 Syncing UserPermissionScope entries for all workflow steps...\n');

  // Import the sync function
  const { syncScopesForWorkflowStep } = await import('../app/lib/utils/sync-workflow-scopes');

  // Get all workflow steps with required roles
  const steps = await prisma.workflowStep.findMany({
    where: {
      required_roles: { not: null },
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          location_id: true,
        },
      },
    },
  });

  console.log(`Found ${steps.length} workflow steps with required roles\n`);

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const step of steps) {
    const requiredRoles = typeof step.required_roles === 'string'
      ? JSON.parse(step.required_roles)
      : (step.required_roles || []);

    if (requiredRoles.length === 0) {
      continue;
    }

    console.log(`Processing Step ${step.step_order} in template "${step.template.name}":`);
    console.log(`  Location scope: ${step.location_scope || 'all'}`);
    console.log(`  Required roles: ${requiredRoles.length}`);

    try {
      const result = await syncScopesForWorkflowStep(step.id, step.template.id);
      console.log(`  ✅ Created ${result.created}, skipped ${result.skipped}, errors: ${result.errors}\n`);

      totalCreated += result.created;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      totalErrors++;
    }
  }

  console.log('📊 SUMMARY:');
  console.log(`  ✅ Created ${totalCreated} UserPermissionScope entries`);
  console.log(`  ⏭️  Skipped ${totalSkipped} existing entries`);
  console.log(`  ❌ Errors: ${totalErrors}`);
  console.log(`  📋 Processed ${steps.length} workflow steps`);
  console.log('\n✅ Sync complete! All workflow steps now have scopes synced based on their location constraints.');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
