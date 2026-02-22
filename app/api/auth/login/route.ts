import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
} from '@/lib/auth/jwt';
import { loginSchema } from '@/lib/utils/validation';
import { errorResponse, successResponse } from '@/lib/utils/responses';
import { corsHeaders, handleCorsOptions } from '@/lib/middleware/cors';

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const { email, password } = validationResult.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password_hash: true,
        status: true,
        deleted_at: true,
      },
    });

    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    // Check if user is active
    if (user.status !== 'active') {
      return errorResponse('User account is not active', 403);
    }

    if (user.deleted_at) {
      return errorResponse('User account has been deleted', 403);
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return errorResponse('Invalid email or password', 401);
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Store refresh token in Redis
    await storeRefreshToken(user.id, refreshToken);

    // Return tokens and user info
    const response = successResponse(
      {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          status: user.status,
        },
      },
      'Login successful',
      200
    );
    
    // Add CORS headers
    Object.entries(corsHeaders()).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
