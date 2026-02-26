import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import {
  KNOWN_COMPONENTS,
  resolveRoleProfile,
  isComponentVisibleForProfile,
} from '@/lib/config/component-visibility-baseline';

const applyBaselineSchema = z.object({
  mode: z.enum(['apply', 'reset']).default('apply'),
  dry_run: z.boolean().optional().default(false),
});

async function requireSystemAdmin(user: { id: string; email: string; name: string; status: string }) {
  const userWithLocation = await prisma.user.findUnique({
    where: { id: user.id },
    select: { primary_location_id: true },
  });

  const locationId =
    userWithLocation?.primary_location_id ||
    (await prisma.location.findFirst({ select: { id: true } }))?.id;

  if (!locationId) {
    throw new Error('No location available for permission check');
  }

  await requirePermission(user, 'system.admin', { locationId });
}

/**
 * GET /api/admin/component-visibility/baseline
 * Preview baseline impact by role.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await requireSystemAdmin(user);

    const roles = await prisma.role.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const preview = roles.map((role) => {
      const profile = resolveRoleProfile(role.name);
      const visibleCount = KNOWN_COMPONENTS.filter((component) =>
        isComponentVisibleForProfile(component.id, profile)
      ).length;

      return {
        role_id: role.id,
        role_name: role.name,
        profile,
        total_components: KNOWN_COMPONENTS.length,
        visible_components: visibleCount,
        hidden_components: KNOWN_COMPONENTS.length - visibleCount,
      };
    });

    return successResponse({
      total_known_components: KNOWN_COMPONENTS.length,
      total_roles: roles.length,
      preview,
    });
  } catch (error: any) {
    console.error('Error previewing component visibility baseline:', error);
    return errorResponse(error.message || 'Failed to preview baseline', 500);
  }
}

/**
 * POST /api/admin/component-visibility/baseline
 * Apply or reset role-based baseline component visibility configs.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    await requireSystemAdmin(user);

    const body = await request.json();
    const validated = applyBaselineSchema.parse(body);

    const roles = await prisma.role.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (!roles.length) {
      return errorResponse('No active roles found', 400);
    }

    const targetRoleIds = roles.map((role) => role.id);

    if (validated.mode === 'reset' && !validated.dry_run) {
      await prisma.componentVisibilityConfig.deleteMany({
        where: {
          role_id: { in: targetRoleIds },
          user_category_id: null,
          user_id: null,
        },
      });
    }

    let created = 0;
    let updated = 0;

    for (const role of roles) {
      const profile = resolveRoleProfile(role.name);

      for (const component of KNOWN_COMPONENTS) {
        const visible = isComponentVisibleForProfile(component.id, profile);
        const payload = {
          visible,
          enabled: visible,
          priority: 100,
          metadata: {
            source: 'baseline',
            version: 'v1',
            profile,
          },
        };

        const existing = await prisma.componentVisibilityConfig.findFirst({
          where: {
            component_id: component.id,
            role_id: role.id,
            user_category_id: null,
            user_id: null,
          },
          select: { id: true },
        });

        if (validated.dry_run) {
          if (existing) {
            updated += 1;
          } else {
            created += 1;
          }
          continue;
        }

        if (existing) {
          await prisma.componentVisibilityConfig.update({
            where: { id: existing.id },
            data: payload,
          });
          updated += 1;
        } else {
          await prisma.componentVisibilityConfig.create({
            data: {
              component_id: component.id,
              role_id: role.id,
              created_by: user.id,
              ...payload,
            },
          });
          created += 1;
        }
      }
    }

    return successResponse({
      mode: validated.mode,
      dry_run: validated.dry_run,
      total_roles: roles.length,
      total_components: KNOWN_COMPONENTS.length,
      total_records: roles.length * KNOWN_COMPONENTS.length,
      created,
      updated,
    }, validated.dry_run ? 'Baseline preview calculated' : 'Baseline applied successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error applying component visibility baseline:', error);
    return errorResponse(error.message || 'Failed to apply baseline', 500);
  }
}
