import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/utils/responses';
import { Workbook } from 'exceljs';

/**
 * GET /api/users/bulk-upload/template
 * Download Excel template for bulk user upload
 */
export async function GET(request: NextRequest) {
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

    // Create workbook
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Users');

           // Define columns with proper formatting
           worksheet.columns = [
             { header: 'Name', key: 'name', width: 30 },
             { header: 'Email', key: 'email', width: 30 },
             { header: 'Password', key: 'password', width: 20 },
             { header: 'Staff Number', key: 'staff_number', width: 15 },
             { header: 'Charge Code', key: 'charge_code', width: 15 },
             { header: 'Primary Location ID', key: 'primary_location_id', width: 25 },
             { header: 'Manager Email', key: 'manager_email', width: 30 },
             { header: 'Status', key: 'status', width: 15 },
           ];

           // Set column protection - make all columns editable
           worksheet.columns.forEach((column, index) => {
             if (column.key) {
               worksheet.getColumn(index + 1).protection = {
                 locked: false,
               };
             }
           });

           // Style header row
           const headerRow = worksheet.getRow(1);
           headerRow.font = { bold: true, size: 11 };
           headerRow.fill = {
             type: 'pattern',
             pattern: 'solid',
             fgColor: { argb: 'FFE0E0E0' },
           };
           headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
           headerRow.height = 20;

           // Ensure worksheet is NOT protected (allows full editing)
           // Don't call protect() - we want the worksheet to be fully editable

    // Add example row
    worksheet.addRow({
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'TempPassword123!',
      staff_number: 'EMP001',
      charge_code: 'CC001',
      primary_location_id: '', // Will be filled by admin
      manager_email: '', // Optional
      status: 'active',
    });

    // Add instructions sheet
    const instructionsSheet = workbook.addWorksheet('Instructions');
    instructionsSheet.columns = [{ header: 'Instructions', key: 'text', width: 100 }];
    
    const instructions = [
      'BULK USER UPLOAD TEMPLATE',
      '',
      'Instructions:',
      '1. Fill in all required fields (Name, Email, Password, Staff Number, Charge Code)',
      '2. Primary Location ID: Enter a valid location UUID from your system',
      '3. Manager Email: Optional - Enter email of existing user who will be the manager',
      '4. Status: Must be "active" or "suspended"',
      '5. Password: Must be at least 8 characters',
      '6. Email: Must be unique and valid email format',
      '7. Staff Number: Must be unique',
      '8. Charge Code: Optional but recommended',
      '',
      'Notes:',
      '- All emails must be unique',
      '- All staff numbers must be unique',
      '- Manager email must belong to an existing active user',
      '- Primary Location ID must exist in the system',
      '- Passwords will be hashed automatically',
      '',
      'After filling the template, save it and upload using POST /api/users/bulk-upload',
    ];

    instructions.forEach((text, index) => {
      instructionsSheet.addRow({ text });
      if (index === 0) {
        instructionsSheet.getRow(index + 1).font = { bold: true, size: 14 };
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="user-bulk-upload-template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Template generation error:', error);
    return errorResponse(error.message || 'Failed to generate template', 500);
  }
}
