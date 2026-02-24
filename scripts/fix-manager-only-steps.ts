#!/usr/bin/env tsx
/**
 * Script to fix workflow steps that should be manager-only but have wrong strategy
 * 
 * Fixes steps where:
 * - include_manager = true
 * - required_roles is empty/null
 * - But approver_strategy is 'combined' instead of 'manager'
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
  console.log('🔧 Fixing manager-only workflow steps...\n');

  // Find steps that should be manager-only but have wrong strategy
  // Steps where include_manager=true, but strategy is not 'manager'
  const allSteps = await prisma.workflowStep.findMany({
    where: {
      include_manager: true,
      approver_strategy: { not: 'manager' },
    },
    include: {
      template: {
        select: {
          name: true,
        },
      },
    },
  });

  // Filter steps that have no roles (should be manager-only)
  const stepsToFix = allSteps.filter(step => {
    if (!step.required_roles) return true;
    try {
      const roles = typeof step.required_roles === 'string' 
        ? JSON.parse(step.required_roles) 
        : step.required_roles;
      return !Array.isArray(roles) || roles.length === 0;
    } catch {
      return true; // If parsing fails, treat as empty
    }
  });

  console.log(`Found ${stepsToFix.length} step(s) that need fixing\n`);

  if (stepsToFix.length === 0) {
    console.log('✅ No steps need fixing. All manager-only steps are correctly configured.');
    await prisma.$disconnect();
    process.exit(0);
  }

  let fixed = 0;

  for (const step of stepsToFix) {
    console.log(`Fixing Step ${step.step_order} in template "${step.template.name}":`);
    console.log(`  Current strategy: ${step.approver_strategy}`);
    console.log(`  include_manager: ${step.include_manager}`);
    console.log(`  required_roles: ${step.required_roles || 'empty'}`);

    await prisma.workflowStep.update({
      where: { id: step.id },
      data: {
        approver_strategy: 'manager',
      },
    });

    console.log(`  ✅ Changed strategy to 'manager'\n`);
    fixed++;
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`  ✅ Fixed: ${fixed} step(s)`);
  console.log(`\n✅ All manager-only steps are now correctly configured!`);
  console.log('💡 Run a simulation again - you should now see only the employee\'s manager.');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
