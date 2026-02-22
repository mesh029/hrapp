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
 * Safely extract text value from Excel cell
 * Uses ExcelJS's text property first, then falls back to value extraction
 */
function getCellValue(cell: any): string {
  if (!cell) {
    return '';
  }

  // First, try ExcelJS's built-in text property (most reliable)
  if (cell.text !== undefined && cell.text !== null) {
    return String(cell.text).trim();
  }

  // If text is not available, try the value property
  let value = cell.value;
  
  if (value === null || value === undefined) {
    return '';
  }

  // Handle RichText objects (ExcelJS RichText format)
  if (typeof value === 'object' && value !== null) {
    // Check for RichText array
    if (Array.isArray(value.richText)) {
      return value.richText.map((rt: any) => rt.text || '').join('').trim();
    }
    
    // Check for formula result
    if (value.formula && value.result !== undefined) {
      value = value.result;
    }
    
    // Check for text property in the value object
    if (value.text !== undefined) {
      return String(value.text).trim();
    }
    
    // Check if it's a Date object
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // If it's still an object, try to get text representation
    if (typeof value === 'object' && value.constructor === Object) {
      // Try common properties
      if (value.value !== undefined) {
        value = value.value;
      } else if (value.result !== undefined) {
        value = value.result;
      } else {
        // Log for debugging
        console.warn('[Bulk Upload] Cell value is an object, trying toString:', JSON.stringify(value));
        // Try toString on the object itself
        try {
          return String(value).trim();
        } catch {
          return '';
        }
      }
    }
  }

  // Handle primitive types
  if (typeof value === 'string') {
    return value.trim();
  }
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value.toString();
  }

  // Final fallback
  try {
    const str = String(value);
    return str.trim();
  } catch (e) {
    console.error('[Bulk Upload] Error converting cell value to string:', e, value);
    return '';
  }
}

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
      if (!getCellValue(row.getCell(1))) {
        continue;
      }

      results.total++;

      try {
        // Extract row data using safe cell value extraction
        // Force string conversion immediately to prevent object issues
        const name = String(getCellValue(row.getCell(1))).trim();
        const email = String(getCellValue(row.getCell(2))).trim();
        const password = String(getCellValue(row.getCell(3))).trim();
        const staff_number = getCellValue(row.getCell(4)).trim() || undefined;
        const charge_code = getCellValue(row.getCell(5)).trim() || undefined;
        const primary_location_id = getCellValue(row.getCell(6)).trim() || undefined;
        const manager_email = getCellValue(row.getCell(7)).trim() || undefined;
        const status = (getCellValue(row.getCell(8)).trim() || 'active') as 'active' | 'suspended';

        // Debug logging for troubleshooting - log raw cell values too
        const cell2 = row.getCell(2);
        console.log(`[Bulk Upload] Row ${i} debug:`, {
          cell2Raw: cell2?.value,
          cell2Text: cell2?.text,
          cell2Type: typeof cell2?.value,
          cell2Constructor: cell2?.value?.constructor?.name,
          extractedEmail: email,
          extractedEmailType: typeof email,
          extractedName: name,
          allCells: {
            cell1: { 
              value: row.getCell(1)?.value, 
              text: row.getCell(1)?.text,
              type: typeof row.getCell(1)?.value 
            },
            cell2: { 
              value: row.getCell(2)?.value, 
              text: row.getCell(2)?.text,
              type: typeof row.getCell(2)?.value 
            },
            cell3: { 
              value: row.getCell(3)?.value, 
              text: row.getCell(3)?.text,
              type: typeof row.getCell(3)?.value 
            },
          },
        });

        const rowData: any = {
          name,
          email,
          password,
          staff_number,
          charge_code,
          primary_location_id,
          manager_email,
          status,
        };

        // Validate row data
        const validationResult = userRowSchema.safeParse(rowData);
        if (!validationResult.success) {
          // Ensure email is a string for error reporting
          let emailForError = email;
          if (typeof emailForError !== 'string') {
            emailForError = String(emailForError) || 'unknown';
          }
          
          results.errors.push({
            row: i,
            email: emailForError,
            errors: validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
          });
          
          console.error(`[Bulk Upload] Row ${i} validation failed:`, {
            extractedValues: { name, email, password: password ? '***' : '' },
            validationErrors: validationResult.error.issues,
            rawRowData: rowData,
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
          email: getCellValue(row.getCell(2)) || 'unknown',
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
