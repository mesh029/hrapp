import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';
import { generateAccessToken } from '../app/lib/auth/jwt';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL';
  details: string;
  error?: string;
}

const results: TestResult[] = [];

function logResult(testName: string, status: 'PASS' | 'FAIL', details: string, error?: string) {
  results.push({ testName, status, details, error });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`\n${icon} ${testName}`);
  console.log(`   ${details}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function makeRequest(method: string, endpoint: string, token?: string, body?: any) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

async function main() {
  console.log('🧪 PHASE 1 API ENDPOINT TESTS');
  console.log('='.repeat(80));
  console.log('Testing API endpoints with staff_number and charge_code fields\n');

  const startTime = Date.now();

  try {
    // Get admin user and generate token
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@path.org' },
    });

    if (!admin) {
      throw new Error('Admin user not found. Please run seed script first.');
    }

    const adminToken = generateAccessToken({
      userId: admin.id,
      email: admin.email,
    });

    // Get location for testing
    const location = await prisma.location.findFirst({
      where: { name: 'Nairobi Office' },
    });

    if (!location) {
      throw new Error('Nairobi location not found.');
    }

    // Test 1: Create user with staff_number and charge_code
    console.log('📋 TEST 1: Create User with New Fields');
    console.log('-'.repeat(80));

    process.stdout.write('   POST /api/users (with staff_number and charge_code)... ');
    try {
      const testEmail = `api-test-${Date.now()}@test.com`;
      const testStaffNumber = `API-${Date.now()}`;
      const testChargeCode = 'API-CC-001';

      const { status, data } = await makeRequest(
        'POST',
        '/users',
        adminToken,
        {
          name: 'API Test User',
          email: testEmail,
          password: 'TestPassword123!',
          staff_number: testStaffNumber,
          charge_code: testChargeCode,
        }
      );

      if (status === 201 && data.success && data.data.staff_number === testStaffNumber && data.data.charge_code === testChargeCode) {
        console.log('✅');
        logResult(
          'POST /api/users (with new fields)',
          'PASS',
          `Created user with staff_number: ${testStaffNumber}, charge_code: ${testChargeCode}`
        );

        // Cleanup
        await prisma.user.delete({ where: { id: data.data.id } });
      } else {
        console.log('❌');
        logResult(
          'POST /api/users (with new fields)',
          'FAIL',
          `Status: ${status}, Expected fields not in response`,
          JSON.stringify(data)
        );
      }
    } catch (error: any) {
      console.log('❌');
      logResult(
        'POST /api/users (with new fields)',
        'FAIL',
        'Request failed',
        error.message
      );
    }

    // Test 2: Create user without new fields
    console.log('\n📋 TEST 2: Create User Without New Fields');
    console.log('-'.repeat(80));

    process.stdout.write('   POST /api/users (without new fields)... ');
    try {
      const testEmail = `api-test-optional-${Date.now()}@test.com`;

      const { status, data } = await makeRequest(
        'POST',
        '/users',
        adminToken,
        {
          name: 'API Test User (Optional)',
          email: testEmail,
          password: 'TestPassword123!',
        }
      );

      if (status === 201 && data.success) {
        console.log('✅');
        logResult(
          'POST /api/users (without new fields)',
          'PASS',
          'User created successfully without optional fields'
        );

        // Cleanup
        await prisma.user.delete({ where: { id: data.data.id } });
      } else {
        console.log('❌');
        logResult(
          'POST /api/users (without new fields)',
          'FAIL',
          'Request failed',
          JSON.stringify(data)
        );
      }
    } catch (error: any) {
      console.log('❌');
      logResult(
        'POST /api/users (without new fields)',
        'FAIL',
        'Request failed',
        error.message
      );
    }

    // Test 3: Get user (verify fields included)
    console.log('\n📋 TEST 3: Get User (Verify Fields Included)');
    console.log('-'.repeat(80));

    process.stdout.write('   GET /api/users/[id] (verify fields)... ');
    try {
      // First create a test user with fields
      const testEmail = `api-test-get-${Date.now()}@test.com`;
      const testStaffNumber = `API-GET-${Date.now()}`;
      const testChargeCode = 'API-GET-CC-001';

      const testUser = await prisma.user.create({
        data: {
          name: 'API Get Test User',
          email: testEmail,
          password_hash: await hashPassword('TestPassword123!'),
          staff_number: testStaffNumber,
          charge_code: testChargeCode,
        },
      });

      const { status, data } = await makeRequest(
        'GET',
        `/users/${testUser.id}`,
        adminToken
      );

      if (status === 200 && data.success && data.data.staff_number === testStaffNumber && data.data.charge_code === testChargeCode) {
        console.log('✅');
        logResult(
          'GET /api/users/[id]',
          'PASS',
          'User retrieved with staff_number and charge_code fields'
        );
      } else {
        console.log('❌');
        logResult(
          'GET /api/users/[id]',
          'FAIL',
          'Fields not included in response',
          JSON.stringify(data)
        );
      }

      // Cleanup
      await prisma.user.delete({ where: { id: testUser.id } });
    } catch (error: any) {
      console.log('❌');
      logResult(
        'GET /api/users/[id]',
        'FAIL',
        'Request failed',
        error.message
      );
    }

    // Test 4: List users (verify fields included)
    console.log('\n📋 TEST 4: List Users (Verify Fields Included)');
    console.log('-'.repeat(80));

    process.stdout.write('   GET /api/users (verify fields in list)... ');
    try {
      const { status, data } = await makeRequest(
        'GET',
        '/users?limit=5',
        adminToken
      );

      if (status === 200 && data.success && Array.isArray(data.data.users)) {
        const firstUser = data.data.users[0];
        if (firstUser && ('staff_number' in firstUser || firstUser.staff_number === null) && ('charge_code' in firstUser || firstUser.charge_code === null)) {
          console.log('✅');
          logResult(
            'GET /api/users',
            'PASS',
            `List users includes staff_number and charge_code fields (${data.data.users.length} users)`
          );
        } else {
          console.log('❌');
          logResult(
            'GET /api/users',
            'FAIL',
            'Fields not included in user objects',
            JSON.stringify(firstUser)
          );
        }
      } else {
        console.log('❌');
        logResult(
          'GET /api/users',
          'FAIL',
          'Request failed',
          JSON.stringify(data)
        );
      }
    } catch (error: any) {
      console.log('❌');
      logResult(
        'GET /api/users',
        'FAIL',
        'Request failed',
        error.message
      );
    }

    // Test 5: Update user to add fields
    console.log('\n📋 TEST 5: Update User (Add New Fields)');
    console.log('-'.repeat(80));

    process.stdout.write('   PATCH /api/users/[id] (add staff_number and charge_code)... ');
    try {
      // Create test user
      const testEmail = `api-test-update-${Date.now()}@test.com`;
      const testUser = await prisma.user.create({
        data: {
          name: 'API Update Test User',
          email: testEmail,
          password_hash: await hashPassword('TestPassword123!'),
        },
      });

      const testStaffNumber = `API-UPDATE-${Date.now()}`;
      const testChargeCode = 'API-UPDATE-CC-001';

      const { status, data } = await makeRequest(
        'PATCH',
        `/users/${testUser.id}`,
        adminToken,
        {
          staff_number: testStaffNumber,
          charge_code: testChargeCode,
        }
      );

      if (status === 200 && data.success && data.data.staff_number === testStaffNumber && data.data.charge_code === testChargeCode) {
        console.log('✅');
        logResult(
          'PATCH /api/users/[id]',
          'PASS',
          `Updated user with staff_number: ${testStaffNumber}, charge_code: ${testChargeCode}`
        );
      } else {
        console.log('❌');
        logResult(
          'PATCH /api/users/[id]',
          'FAIL',
          'Update failed or fields not updated',
          JSON.stringify(data)
        );
      }

      // Cleanup
      await prisma.user.delete({ where: { id: testUser.id } });
    } catch (error: any) {
      console.log('❌');
      logResult(
        'PATCH /api/users/[id]',
        'FAIL',
        'Request failed',
        error.message
      );
    }

    // Test 6: Create leave request (verify user fields in response)
    console.log('\n📋 TEST 6: Create Leave Request (Verify User Fields)');
    console.log('-'.repeat(80));

    process.stdout.write('   POST /api/leave/requests (verify user fields)... ');
    try {
      // Create test user with fields
      const testEmail = `api-test-leave-${Date.now()}@test.com`;
      const testStaffNumber = `API-LEAVE-${Date.now()}`;
      const testChargeCode = 'API-LEAVE-CC-001';

      const testUser = await prisma.user.create({
        data: {
          name: 'API Leave Test User',
          email: testEmail,
          password_hash: await hashPassword('TestPassword123!'),
          primary_location_id: location.id,
          staff_number: testStaffNumber,
          charge_code: testChargeCode,
        },
      });

      // Get leave type
      const leaveType = await prisma.leaveType.findFirst({
        where: { name: 'Annual Leave' },
      });

      if (!leaveType) {
        throw new Error('Annual Leave type not found.');
      }

      const userToken = generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
      });

      const { status, data } = await makeRequest(
        'POST',
        '/leave/requests',
        userToken,
        {
          leave_type_id: leaveType.id,
          start_date: '2025-03-01',
          end_date: '2025-03-05',
          days_requested: 5,
          reason: 'API test',
        }
      );

      if (status === 201 && data.success && data.data.user && data.data.user.staff_number === testStaffNumber && data.data.user.charge_code === testChargeCode) {
        console.log('✅');
        logResult(
          'POST /api/leave/requests',
          'PASS',
          'Leave request created with user staff_number and charge_code in response'
        );

        // Cleanup
        await prisma.leaveRequest.delete({ where: { id: data.data.id } });
        await prisma.user.delete({ where: { id: testUser.id } });
      } else {
        console.log('❌');
        logResult(
          'POST /api/leave/requests',
          'FAIL',
          'User fields not included in response',
          JSON.stringify(data)
        );
      }
    } catch (error: any) {
      console.log('❌');
      logResult(
        'POST /api/leave/requests',
        'FAIL',
        'Request failed',
        error.message
      );
    }

    // Test 7: Create timesheet (verify user fields in response)
    console.log('\n📋 TEST 7: Get Timesheet (Verify User Fields)');
    console.log('-'.repeat(80));

    process.stdout.write('   GET /api/timesheets/[id] (verify user fields)... ');
    try {
      // Create test user with fields
      const testEmail = `api-test-timesheet-${Date.now()}@test.com`;
      const testStaffNumber = `API-TS-${Date.now()}`;
      const testChargeCode = 'API-TS-CC-001';

      const testUser = await prisma.user.create({
        data: {
          name: 'API Timesheet Test User',
          email: testEmail,
          password_hash: await hashPassword('TestPassword123!'),
          primary_location_id: location.id,
          staff_number: testStaffNumber,
          charge_code: testChargeCode,
        },
      });

      // Create timesheet
      const { createTimesheet } = await import('../app/lib/services/timesheet');
      const timesheetResult = await createTimesheet({
        userId: testUser.id,
        locationId: location.id,
        periodStart: new Date('2025-03-01'),
        periodEnd: new Date('2025-03-31'),
      });

      const userToken = generateAccessToken({
        userId: testUser.id,
        email: testUser.email,
      });

      const { status, data } = await makeRequest(
        'GET',
        `/timesheets/${timesheetResult.id}`,
        userToken
      );

      if (status === 200 && data.success && data.data.user && data.data.user.staff_number === testStaffNumber && data.data.user.charge_code === testChargeCode) {
        console.log('✅');
        logResult(
          'GET /api/timesheets/[id]',
          'PASS',
          'Timesheet retrieved with user staff_number and charge_code in response'
        );
      } else {
        console.log('❌');
        logResult(
          'GET /api/timesheets/[id]',
          'FAIL',
          'User fields not included in response',
          JSON.stringify(data.data?.user || data)
        );
      }

      // Cleanup
      await prisma.timesheet.delete({ where: { id: timesheetResult.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    } catch (error: any) {
      console.log('❌');
      logResult(
        'GET /api/timesheets/[id]',
        'FAIL',
        'Request failed',
        error.message
      );
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 API TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n⏱️  Total Duration: ${duration}s`);
    console.log(`\n📈 Results:`);
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📊 Total: ${results.length}`);

    if (failed === 0) {
      console.log('\n✅ Phase 1 API Tests: ALL PASSED');
      console.log('   All API endpoints correctly handle staff_number and charge_code!');
    } else {
      console.log('\n❌ Phase 1 API Tests: SOME FAILED');
      console.log('   Please review failed tests.');
    }

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
