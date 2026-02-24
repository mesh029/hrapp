#!/usr/bin/env tsx
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
  const steps = await prisma.workflowStep.findMany({
    include: {
      template: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  console.log(`Found ${steps.length} workflow steps:\n`);
  
  const byScope = steps.reduce((acc, step) => {
    const scope = step.location_scope || 'null';
    if (!acc[scope]) acc[scope] = [];
    acc[scope].push(step);
    return acc;
  }, {} as Record<string, typeof steps>);

  for (const [scope, stepList] of Object.entries(byScope)) {
    console.log(`Location Scope: "${scope}" (${stepList.length} step(s))`);
    stepList.slice(0, 5).forEach(s => {
      console.log(`  • Step ${s.step_order} in "${s.template.name}" (template: ${s.template.id})`);
    });
    if (stepList.length > 5) {
      console.log(`  ... and ${stepList.length - 5} more`);
    }
    console.log();
  }

  await prisma.$disconnect();
}

main().catch(console.error);
