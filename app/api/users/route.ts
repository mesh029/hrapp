import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  primary_location_id: z.string().uuid().optional(),
  manager_id: z.string().uuid().optional().nullable(), // Optional manager assignment
  status: z.enum(['active', 'suspended', 'deactivated']).optional().default('active'),
  staff_number: z.string().optional().nullable(), // Optional unique staff number
  charge_code: z.string().optional().nullable(), // Optional charge code
});

/**
 * GET /api/users
 * List users (scope-filtered)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    await requirePermission(user, 'users.read', { locationId });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const location = searchParams.get('location');

    const where: any = {
      deleted_at: null,
    };

    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (location) {
      where.primary_location_id = location;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          primary_location_id: true,
          manager_id: true,
          staff_number: true,
          charge_code: true,
          primary_location: {
            select: {
              id: true,
              name: true,
            },
          },
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return successResponse({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('List users error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/users
 * Create new user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    await requirePermission(user, 'users.create', { locationId });

    const body = await request.json();
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const { name, email, password, primary_location_id, manager_id, status, staff_number, charge_code } = validationResult.data;

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return errorResponse('User with this email already exists', 409);
    }

    // Check if staff_number already exists (if provided)
    if (staff_number) {
      const existingStaffNumber = await prisma.user.findUnique({
        where: { staff_number },
      });

      if (existingStaffNumber) {
        return errorResponse('User with this staff number already exists', 409);
      }
    }

    // Validate manager if provided
    if (manager_id) {
      const manager = await prisma.user.findUnique({
        where: { id: manager_id },
      });

      if (!manager || manager.deleted_at || manager.status !== 'active') {
        return errorResponse('Invalid or inactive manager', 400);
      }

      // Prevent circular manager relationships (manager cannot be the user themselves)
      if (manager_id === user.id) {
        return errorResponse('User cannot be their own manager', 400);
      }
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        status,
        primary_location_id: primary_location_id || null,
        manager_id: manager_id || null,
        staff_number: staff_number || null,
        charge_code: charge_code || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        primary_location_id: true,
        manager_id: true,
        staff_number: true,
        charge_code: true,
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        created_at: true,
      },
    });

    return successResponse(newUser, 'User created successfully', 201);
  } catch (error: any) {
    console.error('Create user error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
