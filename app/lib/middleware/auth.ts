import { NextRequest } from 'next/server';
import { verifyAccessToken, TokenPayload } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  status: string;
}

/**
 * Authenticate request and return user
 */
export async function authenticate(request: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized - No token provided');
  }

  const token = authHeader.substring(7);

  try {
    // Verify token
    const decoded = verifyAccessToken(token) as TokenPayload;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        deleted_at: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.status !== 'active') {
      throw new Error('User is not active');
    }

    if (user.deleted_at) {
      throw new Error('User has been deleted');
    }

    // Verify email matches (extra security check)
    if (user.email !== decoded.email) {
      throw new Error('Token email mismatch');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    };
  } catch (error: any) {
    if (error.message.includes('expired')) {
      throw new Error('Unauthorized - Token expired');
    }
    if (error.message.includes('Invalid')) {
      throw new Error('Unauthorized - Invalid token');
    }
    throw new Error(`Unauthorized - ${error.message}`);
  }
}
