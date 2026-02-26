import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { Prisma } from '@prisma/client';

export interface LeaveUtilizationFilters {
  locationId?: string;
  staffTypeId?: string;
  leaveTypeId?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
}

export interface LeaveBalanceSummaryFilters {
  locationId?: string;
  staffTypeId?: string;
  leaveTypeId?: string;
  userId?: string;
}

export interface TimesheetSummaryFilters {
  locationId?: string;
  staffTypeId?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  status?: string;
}

export interface DashboardFilters {
  locationId?: string;
  staffTypeId?: string;
  userId?: string; // For employee-specific data
  startDate?: Date;
  endDate?: Date;
}

/**
 * Get leave utilization report
 */
export async function getLeaveUtilization(filters: LeaveUtilizationFilters = {}) {
  const {
    locationId,
    staffTypeId,
    leaveTypeId,
    startDate,
    endDate,
    userId,
  } = filters;

  const where: Prisma.LeaveRequestWhereInput = {
    deleted_at: null,
  };

  if (userId) {
    where.user_id = userId;
  }

  if (locationId) {
    where.location_id = locationId;
  }

  if (leaveTypeId) {
    where.leave_type_id = leaveTypeId;
  }

  if (startDate || endDate) {
    where.start_date = {};
    if (startDate) {
      where.start_date.gte = startDate;
    }
    if (endDate) {
      where.start_date.lte = endDate;
    }
  }

  // Get leave requests with user and leave type info
  const leaveRequests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        include: {
          staff_type: true,
          primary_location: true,
        },
      },
      leave_type: true,
    },
  });

  // Filter by staff type if provided
  let filteredRequests = leaveRequests;
  if (staffTypeId) {
    filteredRequests = leaveRequests.filter((lr) => lr.user.staff_type_id === staffTypeId);
  }

  // Aggregate data
  const utilization = filteredRequests.reduce((acc, lr) => {
    const key = `${lr.user_id}_${lr.leave_type_id}`;
    if (!acc[key]) {
      acc[key] = {
        userId: lr.user_id,
        userName: lr.user.name,
        userEmail: lr.user.email,
        staffNumber: lr.user.staff_number,
        chargeCode: lr.user.charge_code,
        leaveTypeId: lr.leave_type_id,
        leaveTypeName: lr.leave_type.name,
        locationId: lr.location_id,
        locationName: lr.user.primary_location?.name || 'Unknown',
        staffTypeId: lr.user.staff_type_id,
        staffTypeName: lr.user.staff_type?.name || 'Unknown',
        totalDays: 0,
        approvedDays: 0,
        pendingDays: 0,
        declinedDays: 0,
        requests: [],
      };
    }

    const days = lr.days_requested.toNumber();
    acc[key].totalDays += days;
    acc[key].requests.push({
      id: lr.id,
      startDate: lr.start_date,
      endDate: lr.end_date,
      days: days,
      status: lr.status,
    });

    if (lr.status === 'Approved' || lr.status === 'Submitted') {
      acc[key].approvedDays += days;
    } else if (lr.status === 'UnderReview' || lr.status === 'Draft') {
      acc[key].pendingDays += days;
    } else if (lr.status === 'Declined') {
      acc[key].declinedDays += days;
    }

    return acc;
  }, {} as Record<string, any>);

  return {
    summary: {
      totalRequests: filteredRequests.length,
      approvedRequests: filteredRequests.filter(
        (lr) => lr.status === 'Approved' || lr.status === 'Submitted'
      ).length,
      pendingRequests: filteredRequests.filter(
        (lr) => lr.status === 'UnderReview' || lr.status === 'Draft'
      ).length,
      declinedRequests: filteredRequests.filter((lr) => lr.status === 'Declined').length,
      totalDays: filteredRequests.reduce((sum, lr) => sum + lr.days_requested.toNumber(), 0),
      approvedDays: filteredRequests
        .filter((lr) => lr.status === 'Approved' || lr.status === 'Submitted')
        .reduce((sum, lr) => sum + lr.days_requested.toNumber(), 0),
      pendingDays: filteredRequests
        .filter((lr) => lr.status === 'UnderReview' || lr.status === 'Draft')
        .reduce((sum, lr) => sum + lr.days_requested.toNumber(), 0),
      declinedDays: filteredRequests
        .filter((lr) => lr.status === 'Declined')
        .reduce((sum, lr) => sum + lr.days_requested.toNumber(), 0),
    },
    utilization: Object.values(utilization),
    filters,
  };
}

async function getContractInsights(filters: DashboardFilters = {}) {
  const { locationId, staffTypeId, userId } = filters;
  const now = new Date();
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  const userWhere: Prisma.UserWhereInput = {
    deleted_at: null,
    status: { in: ['active', 'suspended'] },
  };
  if (userId) userWhere.id = userId;
  if (locationId) userWhere.primary_location_id = locationId;
  if (staffTypeId) userWhere.staff_type_id = staffTypeId;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      contract_start_date: true,
      contract_end_date: true,
      contract_status: true,
    },
  });

  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    return {
      totalWithContracts: 0,
      expiringIn30Days: 0,
      expiredContracts: 0,
      utilizedDaysForExpiredUsers: 0,
      availableDaysForExpiredUsers: 0,
    };
  }

  const expiredUserIds = users
    .filter((u) => u.contract_end_date && u.contract_end_date < now)
    .map((u) => u.id);

  const expiringIn30Days = users.filter(
    (u) => u.contract_end_date && u.contract_end_date >= now && u.contract_end_date <= in30Days
  ).length;

  const expiredBalances = expiredUserIds.length
    ? await prisma.leaveBalance.findMany({
        where: { user_id: { in: expiredUserIds } },
        select: { allocated: true, used: true, pending: true },
      })
    : [];

  const utilizedDaysForExpiredUsers = expiredBalances.reduce((sum, b) => sum + b.used.toNumber(), 0);
  const availableDaysForExpiredUsers = expiredBalances.reduce(
    (sum, b) => sum + (b.allocated.toNumber() - b.used.toNumber() - b.pending.toNumber()),
    0
  );

  return {
    totalWithContracts: users.filter((u) => !!u.contract_start_date).length,
    expiringIn30Days,
    expiredContracts: expiredUserIds.length,
    utilizedDaysForExpiredUsers,
    availableDaysForExpiredUsers,
  };
}

/**
 * Get leave balance summary
 */
export async function getLeaveBalanceSummary(filters: LeaveBalanceSummaryFilters = {}) {
  const { locationId, staffTypeId, leaveTypeId, userId } = filters;

  const where: Prisma.LeaveBalanceWhereInput = {};

  if (userId) {
    where.user_id = userId;
  }

  if (leaveTypeId) {
    where.leave_type_id = leaveTypeId;
  }

  const balances = await prisma.leaveBalance.findMany({
    where,
    include: {
      user: {
        include: {
          staff_type: true,
          primary_location: true,
        },
      },
      leave_type: true,
    },
  });

  // Filter by location and staff type
  let filteredBalances = balances;
  if (locationId) {
    filteredBalances = filteredBalances.filter(
      (b) => b.user.primary_location_id === locationId
    );
  }
  if (staffTypeId) {
    filteredBalances = filteredBalances.filter(
      (b) => b.user.staff_type_id === staffTypeId
    );
  }

  // Calculate summary
  const summary = filteredBalances.reduce(
    (acc, balance) => {
      const allocated = balance.allocated.toNumber();
      const used = balance.used.toNumber();
      const pending = balance.pending.toNumber();
      acc.totalAllocated += allocated;
      acc.totalUsed += used;
      acc.totalPending += pending;
      acc.totalAvailable += allocated - used - pending;
      return acc;
    },
    {
      totalAllocated: 0,
      totalUsed: 0,
      totalPending: 0,
      totalAvailable: 0,
    }
  );

  return {
    summary,
    balances: filteredBalances.map((b) => ({
      userId: b.user_id,
      userName: b.user.name,
      userEmail: b.user.email,
      staffNumber: b.user.staff_number,
      chargeCode: b.user.charge_code,
      leaveTypeId: b.leave_type_id,
      leaveTypeName: b.leave_type.name,
      locationId: b.user.primary_location_id,
      locationName: b.user.primary_location?.name || 'Unknown',
      staffTypeId: b.user.staff_type_id,
      staffTypeName: b.user.staff_type?.name || 'Unknown',
      year: b.year,
      allocatedDays: b.allocated.toNumber(),
      usedDays: b.used.toNumber(),
      pendingDays: b.pending.toNumber(),
      availableDays: b.allocated.toNumber() - b.used.toNumber() - b.pending.toNumber(),
    })),
    filters,
  };
}

/**
 * Get timesheet summary
 */
export async function getTimesheetSummary(filters: TimesheetSummaryFilters = {}) {
  const {
    locationId,
    staffTypeId,
    startDate,
    endDate,
    userId,
    status,
  } = filters;

  const where: Prisma.TimesheetWhereInput = {
    deleted_at: null,
  };

  if (userId) {
    where.user_id = userId;
  }

  if (locationId) {
    where.location_id = locationId;
  }

  if (status) {
    where.status = status as any;
  }

  if (startDate || endDate) {
    if (startDate && endDate) {
      where.period_start = { gte: startDate };
      where.period_end = { lte: endDate };
    } else if (startDate) {
      where.period_start = { gte: startDate };
    } else if (endDate) {
      where.period_end = { lte: endDate };
    }
  }

  const timesheets = await prisma.timesheet.findMany({
    where,
    include: {
      user: {
        include: {
          staff_type: true,
          primary_location: true,
        },
      },
      entries: true,
    },
  });

  // Filter by staff type if provided
  let filteredTimesheets = timesheets;
  if (staffTypeId) {
    filteredTimesheets = timesheets.filter((t) => t.user.staff_type_id === staffTypeId);
  }

  // Filter by date range if provided
  if (startDate || endDate) {
    filteredTimesheets = filteredTimesheets.filter((t) => {
      if (startDate && t.period_end < startDate) return false;
      if (endDate && t.period_start > endDate) return false;
      return true;
    });
  }

  // Calculate summary
  const summary = filteredTimesheets.reduce(
    (acc, timesheet) => {
      acc.totalTimesheets++;
      const workHours = timesheet.entries.reduce((sum, e) => sum + e.work_hours.toNumber(), 0);
      const leaveHours = timesheet.entries.reduce((sum, e) => sum + e.leave_hours.toNumber(), 0);
      const holidayHours = timesheet.entries.reduce((sum, e) => sum + e.holiday_hours.toNumber(), 0);
      const weekendExtraHours = timesheet.entries.reduce((sum, e) => sum + e.weekend_extra_hours.toNumber(), 0);
      const overtimeHours = timesheet.entries.reduce((sum, e) => sum + e.overtime_hours.toNumber(), 0);
      acc.totalWorkHours += workHours;
      acc.totalLeaveHours += leaveHours;
      acc.totalHolidayHours += holidayHours;
      acc.totalWeekendExtraHours += weekendExtraHours;
      acc.totalOvertimeHours += overtimeHours;
      acc.totalHours += timesheet.total_hours.toNumber();

      if (timesheet.status === 'Approved') {
        acc.approvedTimesheets++;
      } else if (timesheet.status === 'Submitted' || timesheet.status === 'UnderReview') {
        acc.pendingTimesheets++;
      } else if (timesheet.status === 'Declined') {
        acc.declinedTimesheets++;
      }

      return acc;
    },
    {
      totalTimesheets: 0,
      approvedTimesheets: 0,
      pendingTimesheets: 0,
      declinedTimesheets: 0,
      totalWorkHours: 0,
      totalLeaveHours: 0,
      totalHolidayHours: 0,
      totalWeekendExtraHours: 0,
      totalOvertimeHours: 0,
      totalHours: 0,
    }
  );

  return {
    summary,
    timesheets: filteredTimesheets.map((t) => ({
      id: t.id,
      userId: t.user_id,
      userName: t.user.name,
      userEmail: t.user.email,
      staffNumber: t.user.staff_number,
      chargeCode: t.user.charge_code,
      locationId: t.location_id,
      locationName: t.user.primary_location?.name || 'Unknown',
      staffTypeId: t.user.staff_type_id,
      staffTypeName: t.user.staff_type?.name || 'Unknown',
      year: t.period_start.getFullYear(),
      month: t.period_start.getMonth() + 1,
      status: t.status,
      totalWorkHours: t.entries.reduce((sum, e) => sum + e.work_hours.toNumber(), 0),
      totalLeaveHours: t.entries.reduce((sum, e) => sum + e.leave_hours.toNumber(), 0),
      totalHolidayHours: t.entries.reduce((sum, e) => sum + e.holiday_hours.toNumber(), 0),
      totalHours: t.total_hours.toNumber(),
    })),
    filters,
  };
}

/**
 * Get pending approvals dashboard
 */
export async function getPendingApprovals(filters: DashboardFilters = {}) {
  const { locationId, userId, startDate, endDate } = filters;

  const where: Prisma.WorkflowInstanceWhereInput = {
    status: { in: ['Submitted', 'UnderReview'] },
  };

  // Filter by user if provided (for employee view)
  if (userId) {
    where.creator = {
      id: userId,
    };
  }

  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) {
      where.created_at.gte = startDate;
    }
    if (endDate) {
      where.created_at.lte = endDate;
    }
  }

  const workflowInstances = await prisma.workflowInstance.findMany({
    where,
    include: {
      template: {
        include: {
          steps: {
            orderBy: { step_order: 'asc' },
          },
        },
      },
      creator: {
        include: {
          primary_location: true,
          staff_type: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  // Filter by location if provided
  let filteredInstances = workflowInstances;
  if (locationId) {
    filteredInstances = workflowInstances.filter(
      (wi) => wi.creator.primary_location_id === locationId
    );
  }

  // Group by current step and resource type
  const grouped = filteredInstances.reduce(
    (acc, instance) => {
      const currentStep = instance.template.steps.find(
        (s) => s.step_order === instance.current_step_order
      );
      const stepKey = currentStep?.step_order || 0;
      const resourceKey = instance.resource_type;

      if (!acc[resourceKey]) {
        acc[resourceKey] = {};
      }
      if (!acc[resourceKey][stepKey]) {
        acc[resourceKey][stepKey] = {
          stepOrder: stepKey,
          requiredPermission: currentStep?.required_permission || 'unknown',
          count: 0,
          instances: [],
        };
      }

      acc[resourceKey][stepKey].count++;
      acc[resourceKey][stepKey].instances.push({
        id: instance.id,
        resourceId: instance.resource_id,
        resourceType: instance.resource_type,
        createdBy: instance.created_by,
        creatorName: instance.creator.name,
        creatorEmail: instance.creator.email,
        creatorStaffNumber: instance.creator.staff_number,
        creatorChargeCode: instance.creator.charge_code,
        locationId: instance.creator.primary_location_id,
        locationName: instance.creator.primary_location?.name || 'Unknown',
        createdAt: instance.created_at,
        currentStepOrder: instance.current_step_order,
      });

      return acc;
    },
    {} as Record<string, Record<number, any>>
  );

  return {
    summary: {
      totalPending: filteredInstances.length,
      byResourceType: Object.keys(grouped).reduce((acc, key) => {
        acc[key] = Object.values(grouped[key]).reduce(
          (sum, step) => sum + step.count,
          0
        );
        return acc;
      }, {} as Record<string, number>),
    },
    grouped,
    filters,
  };
}

/**
 * Get dashboard data (aggregated metrics)
 */
export async function getDashboardData(filters: DashboardFilters = {}) {
  const cacheKey = `dashboard:v2:${JSON.stringify(filters)}`;
  
  // Try to get from cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const { locationId, staffTypeId, userId, startDate, endDate } = filters;

  // Get leave utilization (filter by userId if provided)
  const leaveUtilization = await getLeaveUtilization({
    locationId,
    staffTypeId,
    userId, // Pass userId for employee-specific filtering
    startDate,
    endDate,
  });

  // Get leave balances (filter by userId if provided)
  const leaveBalances = await getLeaveBalanceSummary({
    locationId,
    staffTypeId,
    userId, // Pass userId for employee-specific filtering
  });

  // Get timesheet summary (filter by userId if provided)
  const timesheetSummary = await getTimesheetSummary({
    locationId,
    staffTypeId,
    userId, // Pass userId for employee-specific filtering
    startDate,
    endDate,
  });

  // Get pending approvals (filter by userId if provided for employee view)
  const pendingApprovals = await getPendingApprovals({
    locationId,
    userId, // Pass userId for employee-specific filtering
    startDate,
    endDate,
  });

  const contracts = await getContractInsights({
    locationId,
    staffTypeId,
    userId,
  });

  const dashboardData = {
    period: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    leave: {
      utilization: leaveUtilization.summary,
      balances: leaveBalances.summary,
    },
    timesheets: timesheetSummary.summary,
    approvals: pendingApprovals.summary,
    contracts,
    filters,
  };

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(dashboardData));

  return dashboardData;
}
