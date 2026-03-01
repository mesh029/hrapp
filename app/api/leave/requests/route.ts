import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission, requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/utils/responses';
import { createLeaveRequestSchema, paginationSchema } from '@/lib/utils/validation';
import { validateLeaveRequest } from '@/lib/services/leave-validation';
import { calculateDaysBetween, addPendingDays } from '@/lib/services/leave-balance';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

/**
 * GET /api/leave/requests
 * List leave requests (scope-filtered by user's location access)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    // Primary location is now required for all users
    if (!userWithLocation?.primary_location_id) {
      return errorResponse('User must have a primary location assigned. Please contact your administrator.', 400);
    }
    
    const locationId = userWithLocation.primary_location_id;

    const hasLeaveRead = await checkPermission(user, 'leave.read', { locationId });
    const hasLeaveCreate = await checkPermission(user, 'leave.create', { locationId });
    const hasLeaveSubmit = await checkPermission(user, 'leave.submit', { locationId });
    const hasLeaveApprove = await checkPermission(user, 'leave.approve', { locationId });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });
    
    // Allow users with create, submit, read, approve permissions, or admins
    if (!hasLeaveRead && !hasLeaveCreate && !hasLeaveSubmit && !hasLeaveApprove && !isAdmin) {
      return forbiddenResponse('You do not have permission to view leave requests');
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');
    const user_id = searchParams.get('user_id');
    const location_id = searchParams.get('location_id');
    const leave_type_id = searchParams.get('leave_type_id');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    // Build where clause
    const where: any = {
      deleted_at: null,
    };

    if (status) {
      where.status = status;
    }

    // Non-approvers (create-only, submit-only, read-only without approve) see only their own
    // Approvers and admins can see location-scoped/all leave requests
    if (!hasLeaveApprove && !isAdmin) {
      // Users without approve permission can only view their own leave requests
      where.user_id = user.id;
    } else if (user_id) {
      // Approvers/admins can filter by user_id if provided
      where.user_id = user_id;
    }

    if (location_id) {
      where.location_id = location_id;
    }

    if (leave_type_id) {
      where.leave_type_id = leave_type_id;
    }

    if (start_date || end_date) {
      where.OR = [];
      if (start_date) {
        where.OR.push({ start_date: { gte: new Date(start_date) } });
      }
      if (end_date) {
        where.OR.push({ end_date: { lte: new Date(end_date) } });
      }
    }

    // Get leave requests
    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ created_at: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              staff_number: true,
              charge_code: true,
            },
          },
          leave_type: {
            select: {
              id: true,
              name: true,
              is_paid: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return successResponse({
      requests: requests.map((req) => ({
        ...req,
        days_requested: req.days_requested.toNumber(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('List leave requests error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/leave/requests
 * Create a new leave request (Draft status)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    // Primary location is now required for all users
    if (!userWithLocation?.primary_location_id) {
      return errorResponse('User must have a primary location assigned. Please contact your administrator.', 400);
    }
    
    const locationId = userWithLocation.primary_location_id;

    try {
      await requirePermission(user, 'leave.create', { locationId });
    } catch {
      const hasSystemAdmin = await prisma.userRole.findFirst({
        where: {
          user_id: user.id,
          deleted_at: null,
          role: {
            status: 'active',
            role_permissions: {
              some: {
                permission: {
                  name: 'system.admin',
                },
              },
            },
          },
        },
      });

      if (!hasSystemAdmin) {
        return unauthorizedResponse('You do not have permission to create leave requests');
      }
    }

    const body = await request.json();
    const validation = createLeaveRequestSchema.safeParse(body);
    if (!validation.success) {
      // ENHANCED: Return detailed validation errors
      const fieldErrors = validation.error.flatten().fieldErrors;
      const errorMessages: string[] = [];
      
      // Convert field errors to readable messages
      Object.entries(fieldErrors).forEach(([field, messages]) => {
        if (messages && messages.length > 0) {
          messages.forEach(msg => {
            errorMessages.push(`${field}: ${msg}`);
          });
        }
      });
      
      return errorResponse(
        errorMessages.length > 0 
          ? `Validation failed: ${errorMessages.join('; ')}`
          : 'Validation failed. Please check all required fields are filled correctly.',
        400,
        {
          errors: errorMessages,
          fieldErrors: fieldErrors,
        }
      );
    }

    // Validate leave type exists and is active
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: validation.data.leave_type_id },
    });

    if (!leaveType || leaveType.deleted_at || leaveType.status === 'inactive') {
      return errorResponse('Leave type not found or inactive', 400);
    }

    // ENHANCED: Use provided location_id or use user's primary location (which is now always required)
    let finalLocationId: string;
    if (validation.data.location_id) {
      finalLocationId = validation.data.location_id;
    } else {
      // Use user's primary location (guaranteed to exist since it's required)
      finalLocationId = userWithLocation.primary_location_id;
    }

    // Validate location exists
    const location = await prisma.location.findUnique({
      where: { id: finalLocationId },
    });

    if (!location || location.status === 'inactive') {
      return errorResponse('Invalid or inactive location', 400);
    }

    // Calculate days requested
    const startDate = new Date(validation.data.start_date);
    const endDate = new Date(validation.data.end_date);
    const daysRequested = calculateDaysBetween(startDate, endDate);

    // Get available leave balance to show in error message
    const currentYear = new Date().getFullYear();
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        user_id_leave_type_id_year: {
          user_id: user.id,
          leave_type_id: validation.data.leave_type_id,
          year: currentYear,
        },
      },
    });

    const allocated = leaveBalance?.allocated.toNumber() || 0;
    const used = leaveBalance?.used.toNumber() || 0;
    const pending = leaveBalance?.pending.toNumber() || 0;
    const available = allocated - used - pending;

    // Validate leave request
    const validationResult = await validateLeaveRequest(
      validation.data.leave_type_id,
      user.id,
      startDate,
      endDate,
      daysRequested
    );

    if (!validationResult.valid) {
      // ENHANCED: Return detailed error messages with available balance
      const errorMessages = validationResult.errors.map(err => {
        if (err.includes('exceed allocated balance')) {
          return `Insufficient leave balance: You have ${available.toFixed(1)} days available, but requested ${daysRequested} days. (Allocated: ${allocated.toFixed(1)}, Used: ${used.toFixed(1)}, Pending: ${pending.toFixed(1)})`;
        }
        return err;
      });
      
      return errorResponse('Leave request validation failed', 400, {
        errors: errorMessages,
        warnings: validationResult.warnings,
        availableBalance: available,
        requestedDays: daysRequested,
        allocated: allocated,
        used: used,
        pending: pending,
      });
    }

    // Create leave request (Draft status - not submitted yet)
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        user_id: user.id,
        leave_type_id: validation.data.leave_type_id,
        start_date: startDate,
        end_date: endDate,
        days_requested: new Decimal(daysRequested),
        reason: validation.data.reason || null,
        location_id: finalLocationId, // Use resolved locationId
        status: 'Draft',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        leave_type: {
          select: {
            id: true,
            name: true,
            is_paid: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return successResponse({
      ...leaveRequest,
      days_requested: leaveRequest.days_requested.toNumber(),
    }, 'Leave request created successfully', 201);
  } catch (error: any) {
    console.error('Create leave request error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
