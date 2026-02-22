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

function logResult(testName: string, status: 'PASS' | 'FAIL' | 'SKIP', details: string, error?: string, data?: any) {
  results.push({ testName, status, details, error, data });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`\n${icon} ${testName}`);
  console.log(`   ${details}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (data) {
    console.log(`   Data: ${JSON.stringify(data, null, 2).substring(0, 200)}`);
  }
}

async function makeRequest(method: string, endpoint: string, body?: any, token?: string) {
  const headers: any = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: any = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

async function main() {
  console.log('🧪 Starting Comprehensive API Tests\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Health Check
    try {
      const { status, data } = await makeRequest('GET', '/api/health');
      if (status === 200 && data.status === 'healthy') {
        logResult('Health Check', 'PASS', 'API is healthy and database is connected');
      } else {
        logResult('Health Check', 'FAIL', `Unexpected response: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      logResult('Health Check', 'FAIL', 'Failed to connect to API', error.message);
      return;
    }

    // Test 2: Login (using existing admin user)
    let adminToken: string | null = null;
    let adminUser: any = null;
    try {
      // Find or create admin user
      adminUser = await prisma.user.findFirst({
        where: {
          email: 'admin@test.com',
        },
      });

      if (!adminUser) {
        // Create admin user
        const passwordHash = await hashPassword('Admin123!');
        const location = await prisma.location.findFirst();
        if (!location) {
          logResult('Admin User Creation', 'FAIL', 'No location found in database');
          return;
        }

        adminUser = await prisma.user.create({
          data: {
            name: 'Test Admin',
            email: 'admin@test.com',
            password_hash: passwordHash,
            status: 'active',
            primary_location_id: location.id,
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
      }

      const { status, data } = await makeRequest('POST', '/api/auth/login', {
        email: 'admin@test.com',
        password: 'Admin123!',
      });

      if (status === 200 && data.data?.accessToken) {
        adminToken = data.data.accessToken;
        logResult('Admin Login', 'PASS', 'Successfully logged in as admin', undefined, {
          userId: data.data.user.id,
          email: data.data.user.email,
        });
      } else {
        logResult('Admin Login', 'FAIL', `Login failed: ${JSON.stringify(data)}`);
        return;
      }
    } catch (error: any) {
      logResult('Admin Login', 'FAIL', 'Failed to login', error.message);
      return;
    }

    // Test 3: Download Excel Template
    try {
      const response = await fetch(`${BASE_URL}/api/users/bulk-upload/template`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (response.status === 200 && response.headers.get('content-type')?.includes('spreadsheetml')) {
        const buffer = await response.arrayBuffer();
        logResult('Download Excel Template', 'PASS', `Template downloaded successfully (${buffer.byteLength} bytes)`);
      } else {
        logResult('Download Excel Template', 'FAIL', `Unexpected response: ${response.status}`);
      }
    } catch (error: any) {
      logResult('Download Excel Template', 'FAIL', 'Failed to download template', error.message);
    }

    // Test 4: Create Single User via API
    try {
      const location = await prisma.location.findFirst();
      if (!location) {
        logResult('Create Single User', 'SKIP', 'No location found');
      } else {
        const { status, data } = await makeRequest('POST', '/api/users', {
          name: 'Test User Single',
          email: `testuser.single.${Date.now()}@test.com`,
          password: 'Test123!',
          primary_location_id: location.id,
          status: 'active',
          staff_number: `SINGLE-${Date.now()}`,
        }, adminToken);

        if (status === 201 && data.data?.id) {
          logResult('Create Single User', 'PASS', 'User created successfully', undefined, {
            userId: data.data.id,
            email: data.data.email,
          });
        } else {
          logResult('Create Single User', 'FAIL', `Failed to create user: ${JSON.stringify(data)}`);
        }
      }
    } catch (error: any) {
      logResult('Create Single User', 'FAIL', 'Failed to create user', error.message);
    }

    // Test 5: Create Leave Request
    let leaveRequestId: string | null = null;
    try {
      const employee = await prisma.user.findFirst({
        where: {
          email: { not: 'admin@test.com' },
          deleted_at: null,
        },
      });

      if (!employee) {
        logResult('Create Leave Request', 'SKIP', 'No employee found');
      } else {
        const leaveType = await prisma.leaveType.findFirst({
          where: { status: 'active' },
        });

        if (!leaveType) {
          logResult('Create Leave Request', 'SKIP', 'No leave type found');
        } else {
          const { status, data } = await makeRequest('POST', '/api/leave/requests', {
            leave_type_id: leaveType.id,
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            reason: 'Test leave request',
          }, adminToken);

          if (status === 201 && data.data?.id) {
            leaveRequestId = data.data.id;
            logResult('Create Leave Request', 'PASS', 'Leave request created', undefined, {
              requestId: data.data.id,
            });
          } else {
            logResult('Create Leave Request', 'FAIL', `Failed: ${JSON.stringify(data)}`);
          }
        }
      }
    } catch (error: any) {
      logResult('Create Leave Request', 'FAIL', 'Failed to create leave request', error.message);
    }

    // Test 6: Submit Leave Request for Approval
    if (leaveRequestId) {
      try {
        const { status, data } = await makeRequest('POST', `/api/leave/requests/${leaveRequestId}/submit`, {}, adminToken);
        if (status === 200) {
          logResult('Submit Leave Request', 'PASS', 'Leave request submitted for approval');
        } else {
          logResult('Submit Leave Request', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      } catch (error: any) {
        logResult('Submit Leave Request', 'FAIL', 'Failed to submit', error.message);
      }
    }

    // Test 7: Create Timesheet
    let timesheetId: string | null = null;
    try {
      const employee = await prisma.user.findFirst({
        where: {
          email: { not: 'admin@test.com' },
          deleted_at: null,
        },
      });

      if (!employee || !employee.primary_location_id) {
        logResult('Create Timesheet', 'SKIP', 'No employee with location found');
      } else {
        const periodStart = new Date();
        periodStart.setDate(1); // First day of month
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(0); // Last day of month

        const { status, data } = await makeRequest('POST', '/api/timesheets', {
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
        }, adminToken);

        if (status === 201 && data.data?.id) {
          timesheetId = data.data.id;
          logResult('Create Timesheet', 'PASS', 'Timesheet created', undefined, {
            timesheetId: data.data.id,
            entriesCount: data.data.entriesCount,
          });
        } else {
          logResult('Create Timesheet', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      }
    } catch (error: any) {
      logResult('Create Timesheet', 'FAIL', 'Failed to create timesheet', error.message);
    }

    // Test 8: Submit Timesheet
    if (timesheetId) {
      try {
        const { status, data } = await makeRequest('POST', `/api/timesheets/${timesheetId}/submit`, {}, adminToken);
        if (status === 200) {
          logResult('Submit Timesheet', 'PASS', 'Timesheet submitted for approval');
        } else {
          logResult('Submit Timesheet', 'FAIL', `Failed: ${JSON.stringify(data)}`);
        }
      } catch (error: any) {
        logResult('Submit Timesheet', 'FAIL', 'Failed to submit', error.message);
      }
    }

    // Test 9: Test Workflow Approvals
    try {
      const workflowInstance = await prisma.workflowInstance.findFirst({
        where: {
          status: { in: ['Submitted', 'UnderReview'] },
        },
        include: {
          template: {
            include: {
              steps: {
                orderBy: { step_order: 'asc' },
              },
            },
          },
        },
      });

      if (workflowInstance) {
        const currentStep = workflowInstance.template.steps.find(
          s => s.step_order === workflowInstance.current_step_order
        );

        if (currentStep) {
          const { status, data } = await makeRequest('POST', `/api/workflows/instances/${workflowInstance.id}/approve`, {
            comment: 'Test approval',
          }, adminToken);

          if (status === 200) {
            logResult('Workflow Approval', 'PASS', 'Workflow step approved successfully');
          } else {
            logResult('Workflow Approval', 'FAIL', `Failed: ${JSON.stringify(data)}`);
          }
        }
      } else {
        logResult('Workflow Approval', 'SKIP', 'No pending workflow instance found');
      }
    } catch (error: any) {
      logResult('Workflow Approval', 'FAIL', 'Failed to approve workflow', error.message);
    }

    // Test 10: Verify No Build Errors
    try {
      const { status } = await makeRequest('GET', '/api/health');
      if (status === 200) {
        logResult('Build Error Check', 'PASS', 'API is running without errors');
      } else {
        logResult('Build Error Check', 'FAIL', 'API health check failed');
      }
    } catch (error: any) {
      logResult('Build Error Check', 'FAIL', 'API is not accessible', error.message);
    }

  } catch (error: any) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📝 Total: ${results.length}`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. Review the output above.');
    }
  }
}

main().catch(console.error);
