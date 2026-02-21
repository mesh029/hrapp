import * as jwt from 'jsonwebtoken';
import { redis } from '@/lib/redis';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10); // 1 hour default
const JWT_REFRESH_EXPIRES_IN = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10); // 7 days default

export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface DigitalSignaturePayload {
  userId: string;
  workflowInstanceId: string;
  stepOrder: number;
  action: string;
  timestamp: Date;
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Store refresh token in Redis
 */
export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const key = `refresh_token:${userId}`;
  await redis.setex(key, JWT_REFRESH_EXPIRES_IN, token);
}

/**
 * Get refresh token from Redis
 */
export async function getRefreshToken(userId: string): Promise<string | null> {
  const key = `refresh_token:${userId}`;
  return await redis.get(key);
}

/**
 * Remove refresh token from Redis (logout)
 */
export async function removeRefreshToken(userId: string): Promise<void> {
  const key = `refresh_token:${userId}`;
  await redis.del(key);
}

/**
 * Generate digital signature for workflow approvals
 */
export async function generateDigitalSignature(
  payload: DigitalSignaturePayload
): Promise<{ token: string; hash: string }> {
  const signatureToken = jwt.sign(
    {
      userId: payload.userId,
      workflowInstanceId: payload.workflowInstanceId,
      stepOrder: payload.stepOrder,
      action: payload.action,
      timestamp: payload.timestamp.toISOString(),
    },
    JWT_SECRET,
    { expiresIn: '31536000' } // 1 year - signatures should be long-lived
  );

  // Generate hash for quick lookup
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(signatureToken).digest('hex');

  return {
    token: signatureToken,
    hash,
  };
}

/**
 * Verify digital signature
 */
export function verifyDigitalSignature(token: string): DigitalSignaturePayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      workflowInstanceId: decoded.workflowInstanceId,
      stepOrder: decoded.stepOrder,
      action: decoded.action,
      timestamp: new Date(decoded.timestamp),
    };
  } catch (error) {
    throw new Error('Invalid digital signature');
  }
}
