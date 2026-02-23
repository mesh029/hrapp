import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { z } from 'zod';

const testUserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  role_id: z.string().uuid(),
  location_id: z.string().uuid(),
  manager_id: z.string().uuid().optional(),
  is_employee: z.boolean().optional(),
});

const testScenarioSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  users: z.array(testUserSchema).min(1),
});

/**
 * GET /api/workflows/test/scenarios
 * List all test scenarios
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // For now, return empty array - scenarios will be stored in database later
    // TODO: Create TestScenario model in database
    return successResponse({
      scenarios: [],
    });
  } catch (error: any) {
    console.error('Error listing test scenarios:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/workflows/test/scenarios
 * Create a test scenario
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    await requirePermission(user, 'workflows.templates.read', { locationId });

    const body = await request.json();
    const validation = testScenarioSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Validate users exist or create test users
    // For now, just validate the structure
    // TODO: Create actual test users in database or use existing users

    // Return the scenario with a generated ID
    const scenario = {
      id: `test-scenario-${Date.now()}`,
      ...validation.data,
      created_at: new Date().toISOString(),
    };

    return successResponse(scenario, undefined, 201);
  } catch (error: any) {
    console.error('Error creating test scenario:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
