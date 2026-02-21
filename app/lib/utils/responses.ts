import { NextResponse } from 'next/server';

/**
 * Standard success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
}

/**
 * Standard error response
 */
export function errorResponse(
  message: string,
  status: number = 400,
  errors?: Record<string, string[]>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
    },
    { status }
  );
}

/**
 * Unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return errorResponse(message, 401);
}

/**
 * Forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return errorResponse(message, 403);
}

/**
 * Not found response
 */
export function notFoundResponse(message: string = 'Resource not found'): NextResponse {
  return errorResponse(message, 404);
}

/**
 * Internal server error response
 */
export function internalErrorResponse(
  message: string = 'Internal server error'
): NextResponse {
  return errorResponse(message, 500);
}
