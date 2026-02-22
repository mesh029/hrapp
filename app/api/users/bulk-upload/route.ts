import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { Workbook } from 'exceljs';
import { z } from 'zod';

const userRowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  staff_number: z.string().optional(),
  charge_code: z.string().optional(),
  primary_location_id: z.string().uuid('Invalid location ID').optional(),
  manager_email: z.string().email('Invalid manager email').optional().nullable(),
  status: z.enum(['active', 'suspended']).default('active'),
});

/**
 * POST /api/users/bulk-upload
 * Upload Excel file to create multiple users
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || 
      (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    await requirePermission(user, 'users.create', { locationId });

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return errorResponse('No file uploaded', 400);
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return errorResponse('Invalid file type. Please upload an Excel file (.xlsx or .xls)', 400);
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();

    // Parse Excel
    const workbook = new Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.getWorksheet('Users') || workbook.worksheets[0];
    if (!worksheet) {
      return errorResponse('No worksheet found in Excel file', 400);
    }

    const results = {
      success: [] as any[],
      errors: [] as any[],
      total: 0,
    };

    // Process rows (skip header)
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      
      // Skip empty rows
      if (!row.getCell(1).value) {
        continue;
      }

      results.total++;

      try {
        // Extract row data
        const rowData: any = {
          name: row.getCell(1).value?.toString() || '',
          email: row.getCell(2).value?.toString() || '',
          password: row.getCell(3).value?.toString() || '',
          staff_number: row.getCell(4).value?.toString() || undefined,
          charge_code: row.getCell(5).value?.toString() || undefined,
          primary_location_id: row.getCell(6).value?.toString() || undefined,
          manager_email: row.getCell(7).value?.toString() || undefined,
          status: (row.getCell(8).value?.toString() || 'active') as 'active' | 'suspended',
        };

        // Validate row data
        const validationResult = userRowSchema.safeParse(rowData);
        if (!validationResult.success) {
          results.errors.push({
            row: i,
            email: rowData.email,
            errors: validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
          });
          continue;
        }

        const validatedData = validationResult.data;

        // Check if email already exists
        const existingEmail = await prisma.user.findUnique({
          where: { email: validatedData.email },
        });

        if (existingEmail) {
          results.errors.push({
            row: i,
            email: validatedData.email,
            errors: ['Email already exists'],
          });
          continue;
        }

        // Check if staff_number already exists (if provided)
        if (validatedData.staff_number) {
          const existingStaffNumber = await prisma.user.findUnique({
            where: { staff_number: validatedData.staff_number },
          });

          if (existingStaffNumber) {
            results.errors.push({
              row: i,
              email: validatedData.email,
              errors: [`Staff number ${validatedData.staff_number} already exists`],
            });
            continue;
          }
        }

        // Validate location if provided
        let finalLocationId = validatedData.primary_location_id;
        if (finalLocationId) {
          const location = await prisma.location.findUnique({
            where: { id: finalLocationId },
          });

          if (!location) {
            results.errors.push({
              row: i,
              email: validatedData.email,
              errors: [`Location ID ${finalLocationId} not found`],
            });
            continue;
          }
        } else {
          // Use admin's location if not provided
          finalLocationId = locationId;
        }

        // Find manager if email provided
        let managerId: string | null = null;
        if (validatedData.manager_email) {
          const manager = await prisma.user.findUnique({
            where: { email: validatedData.manager_email },
            select: { id: true, status: true, deleted_at: true },
          });

          if (!manager || manager.deleted_at || manager.status !== 'active') {
            results.errors.push({
              row: i,
              email: validatedData.email,
              errors: [`Manager with email ${validatedData.manager_email} not found or inactive`],
            });
            continue;
          }

          managerId = manager.id;
        }

        // Hash password
        const password_hash = await hashPassword(validatedData.password);

        // Create user
        const newUser = await prisma.user.create({
          data: {
            name: validatedData.name,
            email: validatedData.email,
            password_hash,
            status: validatedData.status,
            primary_location_id: finalLocationId,
            manager_id: managerId,
            staff_number: validatedData.staff_number || null,
            charge_code: validatedData.charge_code || null,
          },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            staff_number: true,
            charge_code: true,
          },
        });

        results.success.push({
          row: i,
          user: newUser,
        });
      } catch (error: any) {
        results.errors.push({
          row: i,
          email: row.getCell(2).value?.toString() || 'unknown',
          errors: [error.message || 'Unknown error'],
        });
      }
    }

    return successResponse(
      {
        total: results.total,
        successful: results.success.length,
        failed: results.errors.length,
        success: results.success,
        errors: results.errors,
      },
      `Bulk upload completed: ${results.success.length} successful, ${results.errors.length} failed`,
      200
    );
  } catch (error: any) {
    console.error('Bulk upload error:', error);
    return errorResponse(error.message || 'Failed to process bulk upload', 500);
  }
}
