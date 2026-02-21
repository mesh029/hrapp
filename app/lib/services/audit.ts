import { prisma } from '@/lib/db';

export interface CreateAuditLogParams {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeState?: any;
  afterState?: any;
  metadata?: any;
  ipAddress?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: CreateAuditLogParams) {
  const { actorId, action, resourceType, resourceId, beforeState, afterState, metadata, ipAddress } = params;

  return await prisma.auditLog.create({
    data: {
      actor_id: actorId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      before_state: beforeState ? JSON.parse(JSON.stringify(beforeState)) : null,
      after_state: afterState ? JSON.parse(JSON.stringify(afterState)) : null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      ip_address: ipAddress || null,
    },
  });
}

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(options?: {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const {
    actorId,
    action,
    resourceType,
    resourceId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options || {};

  const where: any = {};

  if (actorId) {
    where.actor_id = actorId;
  }

  if (action) {
    where.action = action;
  }

  if (resourceType) {
    where.resource_type = resourceType;
  }

  if (resourceId) {
    where.resource_id = resourceId;
  }

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) {
      where.timestamp.gte = startDate;
    }
    if (endDate) {
      where.timestamp.lte = endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
  };
}

/**
 * Get audit log by ID
 */
export async function getAuditLogById(logId: string) {
  return await prisma.auditLog.findUnique({
    where: { id: logId },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Get audit logs for a specific resource
 */
export async function getAuditLogsForResource(resourceType: string, resourceId: string, limit = 50) {
  return await prisma.auditLog.findMany({
    where: {
      resource_type: resourceType,
      resource_id: resourceId,
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: limit,
  });
}

/**
 * Audit log helpers for common actions
 */
export const AuditHelpers = {
  /**
   * Log workflow action
   */
  async logWorkflowAction(
    actorId: string,
    action: 'approve' | 'decline' | 'adjust' | 'submit' | 'cancel',
    workflowInstanceId: string,
    resourceType: string,
    resourceId: string,
    beforeState: any,
    afterState: any,
    metadata?: any,
    ipAddress?: string
  ) {
    return createAuditLog({
      actorId,
      action: `workflow.${action}`,
      resourceType: 'workflow',
      resourceId: workflowInstanceId,
      beforeState,
      afterState,
      metadata: {
        ...metadata,
        relatedResourceType: resourceType,
        relatedResourceId: resourceId,
      },
      ipAddress,
    });
  },

  /**
   * Log leave request action
   */
  async logLeaveRequestAction(
    actorId: string,
    action: 'create' | 'update' | 'submit' | 'approve' | 'decline' | 'cancel',
    leaveRequestId: string,
    beforeState?: any,
    afterState?: any,
    metadata?: any,
    ipAddress?: string
  ) {
    return createAuditLog({
      actorId,
      action: `leave.${action}`,
      resourceType: 'leave',
      resourceId: leaveRequestId,
      beforeState,
      afterState,
      metadata,
      ipAddress,
    });
  },

  /**
   * Log timesheet action
   */
  async logTimesheetAction(
    actorId: string,
    action: 'create' | 'update' | 'submit' | 'approve' | 'decline',
    timesheetId: string,
    beforeState?: any,
    afterState?: any,
    metadata?: any,
    ipAddress?: string
  ) {
    return createAuditLog({
      actorId,
      action: `timesheet.${action}`,
      resourceType: 'timesheet',
      resourceId: timesheetId,
      beforeState,
      afterState,
      metadata,
      ipAddress,
    });
  },

  /**
   * Log user action
   */
  async logUserAction(
    actorId: string,
    action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate',
    targetUserId: string,
    beforeState?: any,
    afterState?: any,
    metadata?: any,
    ipAddress?: string
  ) {
    return createAuditLog({
      actorId,
      action: `user.${action}`,
      resourceType: 'user',
      resourceId: targetUserId,
      beforeState,
      afterState,
      metadata,
      ipAddress,
    });
  },

  /**
   * Log role action
   */
  async logRoleAction(
    actorId: string,
    action: 'create' | 'update' | 'delete' | 'assign_permission' | 'remove_permission',
    roleId: string,
    beforeState?: any,
    afterState?: any,
    metadata?: any,
    ipAddress?: string
  ) {
    return createAuditLog({
      actorId,
      action: `role.${action}`,
      resourceType: 'role',
      resourceId: roleId,
      beforeState,
      afterState,
      metadata,
      ipAddress,
    });
  },

  /**
   * Log delegation action
   */
  async logDelegationAction(
    actorId: string,
    action: 'create' | 'update' | 'revoke' | 'delete',
    delegationId: string,
    beforeState?: any,
    afterState?: any,
    metadata?: any,
    ipAddress?: string
  ) {
    return createAuditLog({
      actorId,
      action: `delegation.${action}`,
      resourceType: 'delegation',
      resourceId: delegationId,
      beforeState,
      afterState,
      metadata,
      ipAddress,
    });
  },

  /**
   * Log configuration change
   */
  async logConfigChange(
    actorId: string,
    configType: 'leave_type' | 'staff_type' | 'work_hours' | 'workflow_template' | 'holiday',
    configId: string,
    action: 'create' | 'update' | 'delete',
    beforeState?: any,
    afterState?: any,
    metadata?: any,
    ipAddress?: string
  ) {
    return createAuditLog({
      actorId,
      action: `config.${configType}.${action}`,
      resourceType: configType,
      resourceId: configId,
      beforeState,
      afterState,
      metadata,
      ipAddress,
    });
  },
};
