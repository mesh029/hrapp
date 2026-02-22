import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';
import { createWorkflowInstance, submitWorkflowInstance, approveWorkflowStep } from '../app/lib/services/workflow';
import { createTimesheet } from '../app/lib/services/timesheet';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let adminToken: string | null = null;
let adminUser: any = null;
let testLocation: any = null;
let testUsers: any[] = [];
let testWorkflows: any[] = [];

function logResult(testName: string, status: 'PASS' | 'FAIL' | 'SKIP', details: string, error?: string, data?: any) {
  results.push({ testName, status, details, error, data });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`\n${icon} ${testName}`);
  console.log(`   ${details}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (data && status === 'PASS') {
    console.log(`   Data: ${JSON.stringify(data, null, 2).substring(0, 200)}`);
  }
}

async function makeRequest(method: string, endpoint: string, body?: any, token?: string, isFormData?: boolean) {
  const headers: any = {};
  
  // Only set Content-Type for non-GET requests with body
  if (method !== 'GET' && method !== 'HEAD') {
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: any = {
    method,
    headers,
  };

  // Only add body for non-GET/HEAD requests
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

async function setupAdminUser() {
  // Find or create admin user
  adminUser = await prisma.user.findFirst({
    where: { email: 'admin@test.com' },
  });

  if (!adminUser) {
    const passwordHash = await hashPassword('Admin123!');
    testLocation = await prisma.location.findFirst();
    if (!testLocation) {
      throw new Error('No location found in database');
    }

    adminUser = await prisma.user.create({
      data: {
        name: 'Test Admin',
        email: 'admin@test.com',
        password_hash: passwordHash,
        status: 'active',
        primary_location_id: testLocation.id,
      },
    });

    // Assign system.admin permission
    const adminPermission = await prisma.permission.findUnique({
      where: { name: 'system.admin' },
    });

    if (adminPermission) {
      const adminRole = await prisma.role.findFirst({
        where: { name: 'System Administrator' },
      });

      if (adminRole) {
        await prisma.rolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: adminRole.id,
              permission_id: adminPermission.id,
            },
          },
          update: {},
          create: {
            role_id: adminRole.id,
            permission_id: adminPermission.id,
          },
        });

        await prisma.userRole.create({
          data: {
            user_id: adminUser.id,
            role_id: adminRole.id,
          },
        });
      }
    }
  } else {
    testLocation = await prisma.location.findUnique({
      where: { id: adminUser.primary_location_id || '' },
    }) || await prisma.location.findFirst();
  }

  // Login to get token
  const { status, data } = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@test.com',
    password: 'Admin123!',
  });

  if (status === 200 && data.data?.accessToken) {
    adminToken = data.data.accessToken;
    return true;
  }
  return false;
}

async function main() {
  console.log('🧪 Starting Comprehensive Phase Testing\n');
  console.log('='.repeat(60));

  try {
    // Setup
    console.log('\n📋 Setting up test environment...');
    if (!(await setupAdminUser())) {
      logResult('Setup Admin User', 'FAIL', 'Failed to setup admin user');
      return;
    }
    logResult('Setup Admin User', 'PASS', 'Admin user ready', undefined, { userId: adminUser.id });

    // ========== PHASE 1: Authentication & User Management ==========
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 1: Authentication & User Management');
    console.log('='.repeat(60));

    // Test 1.1: Health Check
    try {
      const { status, data } = await makeRequest('GET', '/api/health');
      if (status === 200 && data.status === 'healthy') {
        logResult('1.1 Health Check', 'PASS', 'API is healthy');
      } else {
        logResult('1.1 Health Check', 'FAIL', `Unexpected response: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      logResult('1.1 Health Check', 'FAIL', 'Failed to connect', error.message);
      return;
    }

    // Test 1.2: Login
    try {
      const { status, data } = await makeRequest('POST', '/api/auth/login', {
        email: 'admin@test.com',
        password: 'Admin123!',
      });
      if (status === 200 && data.data?.accessToken) {
        logResult('1.2 Login', 'PASS', 'Login successful');
      } else {
        logResult('1.2 Login', 'FAIL', `Login failed: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      logResult('1.2 Login', 'FAIL', 'Login error', error.message);
    }

    // Test 1.3: Create Single User
    try {
      if (!testLocation) {
        logResult('1.3 Create Single User', 'SKIP', 'No location available');
      } else {
        const { status, data } = await makeRequest('POST', '/api/users', {
          name: 'Test Employee',
          email: `test.employee.${Date.now()}@test.com`,
          password: 'Test123!',
          primary_location_id: testLocation.id,
          status: 'active',
          staff_number: `EMP-${Date.now()}`,
        }, adminToken);

        if (status === 201 && data.data?.id) {
          testUsers.push(data.data);
          logResult('1.3 Create Single User', 'PASS', 'User created', undefined, { userId: data.data.id });
        } else {
          logResult('1.3 Create Single User', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      }
    } catch (error: any) {
      logResult('1.3 Create Single User', 'FAIL', 'Error creating user', error.message);
    }

    // Test 1.4: Download Excel Template
    try {
      const response = await fetch(`${BASE_URL}/api/users/bulk-upload/template`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.status === 200 && response.headers.get('content-type')?.includes('spreadsheetml')) {
        const buffer = await response.arrayBuffer();
        logResult('1.4 Download Excel Template', 'PASS', `Template downloaded (${buffer.byteLength} bytes)`);
      } else {
        logResult('1.4 Download Excel Template', 'FAIL', `Unexpected response: ${response.status}`);
      }
    } catch (error: any) {
      logResult('1.4 Download Excel Template', 'FAIL', 'Failed to download', error.message);
    }

    // ========== PHASE 2: Locations & Staff Types ==========
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 2: Locations & Staff Types');
    console.log('='.repeat(60));

    // Test 2.1: List Locations
    try {
      const { status, data } = await makeRequest('GET', '/api/locations', undefined, adminToken);
      const locations = data.data?.locations || data.data || [];
      if (status === 200 && Array.isArray(locations)) {
        logResult('2.1 List Locations', 'PASS', `Found ${locations.length} locations`);
      } else {
        logResult('2.1 List Locations', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } catch (error: any) {
      logResult('2.1 List Locations', 'FAIL', 'Error listing locations', error.message);
    }

    // Test 2.2: List Staff Types
    try {
      const { status, data } = await makeRequest('GET', '/api/staff-types', undefined, adminToken);
      const staffTypes = data.data?.staffTypes || data.data || [];
      if (status === 200 && Array.isArray(staffTypes)) {
        logResult('2.2 List Staff Types', 'PASS', `Found ${staffTypes.length} staff types`);
      } else {
        logResult('2.2 List Staff Types', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } catch (error: any) {
      logResult('2.2 List Staff Types', 'FAIL', 'Error listing staff types', error.message);
    }

    // ========== PHASE 3: Leave Management ==========
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 3: Leave Management');
    console.log('='.repeat(60));

    let leaveRequestId: string | null = null;
    let leaveType: any = null;

    // Test 3.1: List Leave Types
    try {
      const { status, data } = await makeRequest('GET', '/api/leave/types', undefined, adminToken);
      const leaveTypes = data.data?.leaveTypes || data.data || [];
      if (status === 200 && Array.isArray(leaveTypes)) {
        leaveType = leaveTypes[0];
        logResult('3.1 List Leave Types', 'PASS', `Found ${leaveTypes.length} leave types`);
      } else {
        logResult('3.1 List Leave Types', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } catch (error: any) {
      logResult('3.1 List Leave Types', 'FAIL', 'Error listing leave types', error.message);
    }

    // Test 3.2: Create Leave Request
    try {
      const employee = testUsers[0] || await prisma.user.findFirst({
        where: { email: { not: 'admin@test.com' }, deleted_at: null },
      });

      if (!employee || !leaveType) {
        logResult('3.2 Create Leave Request', 'SKIP', 'No employee or leave type available');
      } else {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 5);

        const { status, data } = await makeRequest('POST', '/api/leave/requests', {
          leave_type_id: leaveType.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          reason: 'Test leave request for comprehensive testing',
          location_id: employee.primary_location_id || testLocation.id,
        }, adminToken);

        if (status === 201 && data.data?.id) {
          leaveRequestId = data.data.id;
          logResult('3.2 Create Leave Request', 'PASS', 'Leave request created', undefined, { requestId: data.data.id });
        } else {
          logResult('3.2 Create Leave Request', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      }
    } catch (error: any) {
      logResult('3.2 Create Leave Request', 'FAIL', 'Error creating leave request', error.message);
    }

    // Test 3.3: Submit Leave Request
    if (leaveRequestId) {
      try {
        const { status, data } = await makeRequest('POST', `/api/leave/requests/${leaveRequestId}/submit`, {}, adminToken);
        if (status === 200) {
          logResult('3.3 Submit Leave Request', 'PASS', 'Leave request submitted for approval');
        } else {
          logResult('3.3 Submit Leave Request', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      } catch (error: any) {
        logResult('3.3 Submit Leave Request', 'FAIL', 'Error submitting', error.message);
      }
    }

    // ========== PHASE 4: Workflow Approvals ==========
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 4: Workflow Approvals');
    console.log('='.repeat(60));

    // Test 4.1: List Workflow Templates
    try {
      const { status, data } = await makeRequest('GET', '/api/workflows/templates', undefined, adminToken);
      const templates = data.data?.templates || data.data || [];
      if (status === 200 && Array.isArray(templates)) {
        testWorkflows = templates;
        logResult('4.1 List Workflow Templates', 'PASS', `Found ${templates.length} templates`);
      } else {
        logResult('4.1 List Workflow Templates', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } catch (error: any) {
      logResult('4.1 List Workflow Templates', 'FAIL', 'Error listing templates', error.message);
    }

    // Test 4.2: Approve Workflow Step
    try {
      const workflowInstance = await prisma.workflowInstance.findFirst({
        where: { status: { in: ['Submitted', 'UnderReview'] } },
        include: {
          template: {
            include: { steps: { orderBy: { step_order: 'asc' } } },
          },
        },
      });

      if (workflowInstance) {
        const { status, data } = await makeRequest('POST', `/api/workflows/instances/${workflowInstance.id}/approve`, {
          comment: 'Test approval from comprehensive test suite',
        }, adminToken);

        if (status === 200) {
          logResult('4.2 Approve Workflow Step', 'PASS', 'Workflow step approved');
        } else {
          logResult('4.2 Approve Workflow Step', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      } else {
        logResult('4.2 Approve Workflow Step', 'SKIP', 'No pending workflow instance');
      }
    } catch (error: any) {
      logResult('4.2 Approve Workflow Step', 'FAIL', 'Error approving', error.message);
    }

    // ========== PHASE 5: Timesheet Management ==========
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 5: Timesheet Management');
    console.log('='.repeat(60));

    let timesheetId: string | null = null;

    // Test 5.1: Create Timesheet
    try {
      const employee = testUsers[0] || await prisma.user.findFirst({
        where: { email: { not: 'admin@test.com' }, deleted_at: null, primary_location_id: { not: null } },
      });

      if (!employee || !employee.primary_location_id) {
        logResult('5.1 Create Timesheet', 'SKIP', 'No employee with location available');
      } else {
        const periodStart = new Date();
        periodStart.setDate(1);
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(0);

        const { status, data } = await makeRequest('POST', '/api/timesheets', {
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          user_id: employee.id,
        }, adminToken);

        if (status === 201 && data.data?.id) {
          timesheetId = data.data.id;
          logResult('5.1 Create Timesheet', 'PASS', 'Timesheet created', undefined, {
            timesheetId: data.data.id,
            entriesCount: data.data.entriesCount,
          });
        } else {
          logResult('5.1 Create Timesheet', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      }
    } catch (error: any) {
      logResult('5.1 Create Timesheet', 'FAIL', 'Error creating timesheet', error.message);
    }

    // Test 5.2: Submit Timesheet
    if (timesheetId) {
      try {
        const { status, data } = await makeRequest('POST', `/api/timesheets/${timesheetId}/submit`, {}, adminToken);
        if (status === 200) {
          logResult('5.2 Submit Timesheet', 'PASS', 'Timesheet submitted for approval');
        } else {
          logResult('5.2 Submit Timesheet', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      } catch (error: any) {
        logResult('5.2 Submit Timesheet', 'FAIL', 'Error submitting', error.message);
      }
    }

    // Test 5.3: Validate Timesheet
    if (timesheetId) {
      try {
        const { status, data } = await makeRequest('GET', `/api/timesheets/${timesheetId}/validate`, {}, adminToken);
        if (status === 200) {
          logResult('5.3 Validate Timesheet', 'PASS', 'Timesheet validation completed');
        } else {
          logResult('5.3 Validate Timesheet', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      } catch (error: any) {
        logResult('5.3 Validate Timesheet', 'FAIL', 'Error validating', error.message);
      }
    }

    // ========== PHASE 6: Reports & Analytics ==========
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 6: Reports & Analytics');
    console.log('='.repeat(60));

    // Test 6.1: Dashboard Data
    try {
      const { status, data } = await makeRequest('GET', '/api/reports/dashboard', undefined, adminToken);
      if (status === 200) {
        logResult('6.1 Dashboard Data', 'PASS', 'Dashboard data retrieved');
      } else {
        logResult('6.1 Dashboard Data', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } catch (error: any) {
      logResult('6.1 Dashboard Data', 'FAIL', 'Error getting dashboard', error.message);
    }

    // Test 6.2: Leave Balances
    try {
      const { status, data } = await makeRequest('GET', '/api/leave/balances', undefined, adminToken);
      if (status === 200) {
        logResult('6.2 Leave Balances', 'PASS', 'Leave balances retrieved');
      } else {
        logResult('6.2 Leave Balances', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } catch (error: any) {
      logResult('6.2 Leave Balances', 'FAIL', 'Error getting balances', error.message);
    }

    // ========== FINAL: Build Error Check ==========
    console.log('\n' + '='.repeat(60));
    console.log('FINAL: Build & Runtime Validation');
    console.log('='.repeat(60));

    // Test Final.1: Health Check (Verify no runtime errors)
    try {
      const { status, data } = await makeRequest('GET', '/api/health');
      if (status === 200 && data.status === 'healthy') {
        logResult('Final.1 Runtime Health Check', 'PASS', 'API running without errors');
      } else {
        logResult('Final.1 Runtime Health Check', 'FAIL', 'API health check failed');
      }
    } catch (error: any) {
      logResult('Final.1 Runtime Health Check', 'FAIL', 'API not accessible', error.message);
    }

    // Test Final.2: Permission API Check
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const { stdout } = await execAsync('cd /home/kenyaemr/my_projects/hrapp && npx tsx scripts/check-permission-api-usage.ts');
      if (stdout.includes('✅ All permission API calls')) {
        logResult('Final.2 Permission API Check', 'PASS', 'All permission calls are correct');
      } else {
        logResult('Final.2 Permission API Check', 'FAIL', 'Permission API issues found');
      }
    } catch (error: any) {
      logResult('Final.2 Permission API Check', 'FAIL', 'Error checking permissions', error.message);
    }

  } catch (error: any) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📝 Total: ${results.length}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! API is fully functional.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above.');
      console.log('\nFailed tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  - ${r.testName}: ${r.error || r.details}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

main().catch(console.error);
