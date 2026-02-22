import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';
import { Workbook } from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function makeRequest(method: string, endpoint: string, body?: any, token?: string, isFormData?: boolean) {
  const headers: any = {};
  
  if (method !== 'GET' && method !== 'HEAD' && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: any = {
    method,
    headers,
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    if (isFormData) {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else if (contentType?.includes('spreadsheetml')) {
      data = { buffer: await response.arrayBuffer() };
    } else {
      data = await response.text();
    }
    return { status: response.status, data };
  } catch (error: any) {
    return { status: 0, data: { error: error.message } };
  }
}

async function main() {
  console.log('🧪 Testing Excel Bulk Upload Functionality\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Login as admin
    console.log('\n📋 Step 1: Login as admin...');
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@path.org' },
    });

    if (!adminUser) {
      console.error('❌ Admin user not found. Please run seed script.');
      return;
    }

    const { status: loginStatus, data: loginData } = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@path.org',
      password: 'oneeyedragon',
    });

    if (loginStatus !== 200 || !loginData.data?.accessToken) {
      console.error('❌ Login failed:', loginData);
      return;
    }

    const adminToken = loginData.data.accessToken;
    console.log('✅ Login successful');

    // Step 2: Download template
    console.log('\n📋 Step 2: Download Excel template...');
    const templateResponse = await fetch(`${BASE_URL}/api/users/bulk-upload/template`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    if (templateResponse.status !== 200) {
      console.error('❌ Failed to download template:', templateResponse.status);
      return;
    }

    const templateBuffer = await templateResponse.arrayBuffer();
    console.log(`✅ Template downloaded (${templateBuffer.byteLength} bytes)`);

    // Step 3: Create test Excel file with sample data
    console.log('\n📋 Step 3: Creating test Excel file...');
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(templateBuffer));

    const worksheet = workbook.getWorksheet('Users') || workbook.worksheets[0];
    
    // Get location ID
    const location = await prisma.location.findFirst();
    if (!location) {
      console.error('❌ No location found');
      return;
    }

    // Add test users (keep example row, add 3 more)
    const testUsers = [
      {
        name: 'John Doe',
        email: `john.doe.${Date.now()}@test.com`,
        password: 'Test123!',
        staff_number: `EMP-${Date.now()}`,
        charge_code: 'CC001',
        primary_location_id: location.id,
        manager_email: adminUser.email,
        status: 'active',
      },
      {
        name: 'Jane Smith',
        email: `jane.smith.${Date.now()}@test.com`,
        password: 'Test123!',
        staff_number: `EMP-${Date.now() + 1}`,
        charge_code: 'CC002',
        primary_location_id: location.id,
        manager_email: '',
        status: 'active',
      },
      {
        name: 'Bob Johnson',
        email: `bob.johnson.${Date.now()}@test.com`,
        password: 'Test123!',
        staff_number: `EMP-${Date.now() + 2}`,
        charge_code: 'CC003',
        primary_location_id: location.id,
        manager_email: adminUser.email,
        status: 'active',
      },
    ];

    // Clear existing data rows (keep header)
    for (let i = worksheet.rowCount; i > 1; i--) {
      worksheet.spliceRows(i, 1);
    }

    // Add test users
    testUsers.forEach(user => {
      worksheet.addRow([
        user.name,
        user.email,
        user.password,
        user.staff_number,
        user.charge_code,
        user.primary_location_id,
        user.manager_email,
        user.status,
      ]);
    });

    // Save test file
    const testFilePath = path.join(__dirname, 'test-bulk-upload.xlsx');
    await workbook.xlsx.writeFile(testFilePath);
    console.log(`✅ Test Excel file created: ${testFilePath}`);

    // Step 4: Upload Excel file
    console.log('\n📋 Step 4: Uploading Excel file...');
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(testFilePath);
    const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'test-bulk-upload.xlsx');

    const uploadResponse = await fetch(`${BASE_URL}/api/users/bulk-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
      body: formData as any,
    });

    const uploadData = await uploadResponse.json();
    
    if (uploadResponse.status === 200 && uploadData.data) {
      const result = uploadData.data;
      console.log('✅ Upload successful!');
      console.log(`   Total rows: ${result.total}`);
      console.log(`   Successful: ${result.successful}`);
      console.log(`   Failed: ${result.failed}`);
      
      if (result.success && result.success.length > 0) {
        console.log('\n   Created users:');
        result.success.forEach((item: any, index: number) => {
          console.log(`   ${index + 1}. ${item.user.name} (${item.user.email})`);
        });
      }
      
      if (result.errors && result.errors.length > 0) {
        console.log('\n   Errors:');
        result.errors.forEach((error: any, index: number) => {
          console.log(`   ${index + 1}. Row ${error.row}: ${error.errors.join(', ')}`);
        });
      }
    } else {
      console.error('❌ Upload failed:', uploadData);
    }

    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log('\n✅ Test file cleaned up');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Excel Bulk Upload Test Complete!');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
