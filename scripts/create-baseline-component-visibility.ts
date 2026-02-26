/**
 * Create or reset role-based baseline component visibility configs.
 *
 * Usage:
 *   npx tsx scripts/create-baseline-component-visibility.ts
 *   npx tsx scripts/create-baseline-component-visibility.ts --reset
 *   npx tsx scripts/create-baseline-component-visibility.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import {
  KNOWN_COMPONENTS,
  resolveRoleProfile,
  isComponentVisibleForProfile,
} from '../app/lib/config/component-visibility-baseline';

dotenv.config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const reset = process.argv.includes('--reset');

  try {
    console.log(`\n🔧 Baseline component visibility (${dryRun ? 'DRY RUN' : 'APPLY'})`);
    console.log(`Mode: ${reset ? 'reset + apply' : 'apply'}\n`);

    const roles = await prisma.role.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    if (!roles.length) {
      throw new Error('No active roles found.');
    }

    const firstAdmin = await prisma.user.findFirst({
      where: {
        deleted_at: null,
        status: 'active',
      },
      select: { id: true },
    });

    if (!firstAdmin) {
      throw new Error('No active user found for created_by.');
    }

    if (reset && !dryRun) {
      const deleted = await prisma.componentVisibilityConfig.deleteMany({
        where: {
          role_id: { in: roles.map((r) => r.id) },
          user_category_id: null,
          user_id: null,
        },
      });
      console.log(`🗑️  Deleted existing role baseline configs: ${deleted.count}`);
    }

    let created = 0;
    let updated = 0;

    for (const role of roles) {
      const profile = resolveRoleProfile(role.name);
      console.log(`\n• ${role.name} -> ${profile}`);

      for (const component of KNOWN_COMPONENTS) {
        const visible = isComponentVisibleForProfile(component.id, profile);

        const existing = await prisma.componentVisibilityConfig.findFirst({
          where: {
            component_id: component.id,
            role_id: role.id,
            user_category_id: null,
            user_id: null,
          },
          select: { id: true },
        });

        if (dryRun) {
          if (existing) updated += 1;
          else created += 1;
          continue;
        }

        const data = {
          visible,
          enabled: visible,
          priority: 100,
          metadata: {
            source: 'baseline',
            version: 'v1',
            profile,
          },
        };

        if (existing) {
          await prisma.componentVisibilityConfig.update({
            where: { id: existing.id },
            data,
          });
          updated += 1;
        } else {
          await prisma.componentVisibilityConfig.create({
            data: {
              component_id: component.id,
              role_id: role.id,
              created_by: firstAdmin.id,
              ...data,
            },
          });
          created += 1;
        }
      }
    }

    const total = roles.length * KNOWN_COMPONENTS.length;
    console.log('\n✅ Done');
    console.log(`Roles: ${roles.length}`);
    console.log(`Components: ${KNOWN_COMPONENTS.length}`);
    console.log(`Expected records: ${total}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}\n`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
