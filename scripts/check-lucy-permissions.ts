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
  const lucy = await prisma.user.findFirst({
    where: { email: 'lucy.nyawira@test.com' },
    include: {
      user_roles: {
        where: { deleted_at: null },
        include: {
          role: {
            include: {
              role_permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!lucy) {
    console.log('LUCY_NOT_FOUND');
    await prisma.$disconnect();
    return;
  }

  const perms = [
    ...new Set(
      lucy.user_roles
        .flatMap((ur) => ur.role?.role_permissions?.map((rp) => rp.permission?.name) || [])
        .filter(Boolean)
    ),
  ];
  console.log('LUCY_ROLE_PERMISSIONS:', JSON.stringify(perms.sort(), null, 2));

  const scopes = await prisma.userPermissionScope.findMany({
    where: { user_id: lucy.id, status: 'active' },
    include: { permission: true },
  });
  const scopePerms = [...new Set(scopes.map((s) => s.permission?.name).filter(Boolean))];
  console.log('LUCY_SCOPE_PERMISSIONS:', JSON.stringify(scopePerms.sort(), null, 2));

  const missing = perms.filter((p) => !scopePerms.includes(p));
  console.log('MISSING_SCOPES:', JSON.stringify(missing, null, 2));

  const hasLeave = perms.some((p) => p.includes('leave'));
  const hasTimesheet = perms.some((p) => p.includes('timesheet'));
  console.log('HAS_LEAVE_PERM:', hasLeave);
  console.log('HAS_TIMESHEET_PERM:', hasTimesheet);

  await prisma.$disconnect();
}

main().catch(console.error);
