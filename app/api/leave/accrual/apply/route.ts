import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { applyLeaveAccrualSchema } from '@/lib/utils/validation';
import { prisma } from '@/lib/db';
import { calculateAccrual } from '@/lib/services/leave-accrual';
import { allocateLeaveDays } from '@/lib/services/leave-balance';

function yearSegments(start: Date, end: Date): Array<{ year: number; from: Date; to: Date }> {
  const segments: Array<{ year: number; from: Date; to: Date }> = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const yearEnd = new Date(year, 11, 31);
    const segmentEnd = yearEnd < end ? yearEnd : end;
    segments.push({ year, from: new Date(cursor), to: new Date(segmentEnd) });
    cursor = new Date(segmentEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return segments;
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return errorResponse('Unauthorized', 401);

    const requester = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });
    const locationId = requester?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    if (!locationId) return errorResponse('No location available for permission check', 400);

    const allowed =
      (await checkPermission(user, 'system.admin', { locationId })) ||
      (await checkPermission(user, 'leave.approve', { locationId }));
    if (!allowed) return errorResponse('Forbidden: Insufficient permissions', 403);

    const body = await request.json();
    const validated = applyLeaveAccrualSchema.parse(body);
    const startDate = new Date(validated.start_date);
    const endDate = new Date(validated.end_date);

    // Build target users filter
    const where: any = {
      deleted_at: null,
      status: 'active',
    };
    if (validated.location_id) where.primary_location_id = validated.location_id;
    if (validated.staff_type_id) where.staff_type_id = validated.staff_type_id;

    const targetUsers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        primary_location_id: true,
        staff_type_id: true,
        contract_start_date: true,
        contract_end_date: true,
      },
    });

    const roleSet = new Set(validated.role_ids || []);
    const categorySet = new Set(validated.user_category_ids || []);
    const explicitUserSet = new Set(validated.user_ids || []);

    const filteredUsers = [];
    for (const target of targetUsers) {
      let match = true;

      if (explicitUserSet.size > 0) {
        match = explicitUserSet.has(target.id);
      }

      if (match && roleSet.size > 0) {
        const hasRole = await prisma.userRole.findFirst({
          where: {
            user_id: target.id,
            deleted_at: null,
            role_id: { in: Array.from(roleSet) },
            role: { status: 'active' },
          },
          select: { role_id: true },
        });
        match = !!hasRole;
      }

      if (match && categorySet.size > 0) {
        const assignment = await prisma.userCategoryAssignment.findFirst({
          where: {
            user_id: target.id,
            user_category_id: { in: Array.from(categorySet) },
            OR: [{ expires_at: null }, { expires_at: { gte: new Date() } }],
          },
          select: { id: true },
        });
        match = !!assignment;
      }

      if (match) filteredUsers.push(target);
    }

    const segments = yearSegments(startDate, endDate);
    const perUser: Array<{
      user_id: string;
      name: string;
      total_days: number;
      by_year: Array<{ year: number; days: number }>;
    }> = [];

    let totalDays = 0;
    for (const target of filteredUsers) {
      let userDays = 0;
      const byYear: Array<{ year: number; days: number }> = [];

      for (const seg of segments) {
        const days = await calculateAccrual(target.id, validated.leave_type_id, seg.from, seg.to);
        if (days > 0) {
          byYear.push({ year: seg.year, days });
          userDays += days;
          if (!validated.dry_run) {
            await allocateLeaveDays(target.id, validated.leave_type_id, seg.year, days);
          }
        }
      }

      totalDays += userDays;
      perUser.push({
        user_id: target.id,
        name: target.name,
        total_days: Number(userDays.toFixed(2)),
        by_year: byYear.map((y) => ({ year: y.year, days: Number(y.days.toFixed(2)) })),
      });
    }

    return successResponse({
      dry_run: validated.dry_run,
      leave_type_id: validated.leave_type_id,
      start_date: validated.start_date,
      end_date: validated.end_date,
      targeted_users: filteredUsers.length,
      total_days: Number(totalDays.toFixed(2)),
      users: perUser,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0]?.message, 400);
    }
    return errorResponse(error.message || 'Failed to apply leave accrual', 500);
  }
}
