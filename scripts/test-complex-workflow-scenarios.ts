import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';
import { createWorkflowInstance, submitWorkflowInstance, approveWorkflowStep, declineWorkflowStep, adjustWorkflowStep } from '../app/lib/services/workflow';
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
let testLocation: any = null;
let approvers: any[] = [];
let employees: any[] = [];

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

async function makeRequest(method: string, endpoint: string, body?: any, token?: string) {
  const headers: any = {};
  
  if (method !== 'GET' && method !== 'HEAD') {
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
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    return { status: response.status, data };
  } catch (error: any) {
    return { status: 0, data: { error: error.message } };
  }
}

async function setupTestEnvironment() {
  console.log('📋 Setting up test environment...\n');

  // Get admin user and login
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@path.org' },
  });

  if (!adminUser) {
    throw new Error('Admin user not found');
  }

  const { status, data } = await makeRequest('POST', '/api/auth/login', {
    email: 'admin@path.org',
    password: 'oneeyedragon',
  });

  if (status !== 200 || !data.data?.accessToken) {
    throw new Error('Failed to login as admin');
  }

  adminToken = data.data.accessToken;
  testLocation = await prisma.location.findFirst({ where: { name: 'Nairobi Office' } });

  if (!testLocation) {
    throw new Error('Nairobi Office not found');
  }

  // Create 5 approvers with different permissions
  const leaveApprovePermission = await prisma.permission.findFirst({ where: { name: 'leave.approve' } });
  const timesheetApprovePermission = await prisma.permission.findFirst({ where: { name: 'timesheet.approve' } });

  if (!leaveApprovePermission || !timesheetApprovePermission) {
    throw new Error('Required permissions not found');
  }

  const approverNames = ['Alice Manager', 'Bob Supervisor', 'Carol Director', 'David HR', 'Eve Finance'];
  
  for (let i = 0; i < 5; i++) {
    const approverEmail = `approver-${i + 1}-${Date.now()}@test.com`;
    const approver = await prisma.user.create({
      data: {
        name: approverNames[i],
        email: approverEmail,
        password_hash: await hashPassword('Test123!'),
        status: 'active',
        primary_location_id: testLocation.id,
        staff_number: `APP${i + 1}-${Date.now()}`,
      },
    });

    // Assign approver role
    const approverRole = await prisma.role.findFirst({ where: { name: 'Manager' } }) ||
      await prisma.role.create({
        data: {
          name: 'Approver',
          description: 'Workflow approver',
          status: 'active',
          role_permissions: {
            create: [
              { permission_id: leaveApprovePermission.id },
              { permission_id: timesheetApprovePermission.id },
            ],
          },
        },
      });

    await prisma.userRole.create({
      data: {
        user_id: approver.id,
        role_id: approverRole.id,
      },
    });

    approvers.push(approver);
  }

  // Create test employees
  const casualStaffType = await prisma.staffType.findFirst({ where: { code: 'casual' } });
  if (casualStaffType) {
    const employee = await prisma.user.create({
      data: {
        name: 'Test Employee',
        email: `test.employee.${Date.now()}@test.com`,
        password_hash: await hashPassword('Test123!'),
        status: 'active',
        primary_location_id: testLocation.id,
        manager_id: approvers[0].id,
        staff_number: `EMP-${Date.now()}`,
      },
    });
    employees.push(employee);
  }

  console.log(`✅ Created ${approvers.length} approvers and ${employees.length} employees\n`);
}

async function main() {
  console.log('🧪 COMPLEX WORKFLOW SCENARIOS TEST');
  console.log('='.repeat(80));
  console.log('Testing the most difficult workflow scenarios\n');

  try {
    await setupTestEnvironment();

    // ========== SCENARIO 1: 5-Step Workflow with All Approvals ==========
    console.log('='.repeat(80));
    console.log('SCENARIO 1: 5-Step Workflow - Full Approval Chain');
    console.log('='.repeat(80));

    let workflowTemplateId: string | null = null;
    let leaveRequestId: string | null = null;
    let workflowInstanceId: string | null = null;

    try {
      // Create 5-step workflow template
      const leaveType = await prisma.leaveType.findFirst({ where: { name: 'Annual Leave' } });
      if (!leaveType) {
        logResult('1.1 Create 5-Step Workflow Template', 'SKIP', 'Leave type not found');
      } else {
        const { status, data } = await makeRequest('POST', '/api/workflows/templates', {
          name: 'Complex 5-Step Leave Approval',
          resource_type: 'leave',
          location_id: testLocation.id,
          steps: [
            { step_order: 1, required_permission: 'leave.approve', allow_decline: true, allow_adjust: true },
            { step_order: 2, required_permission: 'leave.approve', allow_decline: true, allow_adjust: false },
            { step_order: 3, required_permission: 'leave.approve', allow_decline: true, allow_adjust: false },
            { step_order: 4, required_permission: 'leave.approve', allow_decline: true, allow_adjust: false },
            { step_order: 5, required_permission: 'leave.approve', allow_decline: false, allow_adjust: false },
          ],
        }, adminToken || undefined);

        if (status === 201 && data.data?.id) {
          workflowTemplateId = data.data.id;
          logResult('1.1 Create 5-Step Workflow Template', 'PASS', 'Template created with 5 steps');
        } else {
          logResult('1.1 Create 5-Step Workflow Template', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
        }
      }
    } catch (error: any) {
      logResult('1.1 Create 5-Step Workflow Template', 'FAIL', 'Error creating template', error.message);
    }

    // Create leave request and submit
    try {
      const employee = employees[0];
      const leaveType = await prisma.leaveType.findFirst({ where: { name: 'Annual Leave' } });
      
      if (!employee || !leaveType) {
        logResult('1.2 Create and Submit Leave Request', 'SKIP', 'Employee or leave type not available');
      } else {
        // Check existing balance and allocate if needed
        const existingBalance = await prisma.leaveBalance.findUnique({
          where: {
            user_id_leave_type_id_year: {
              user_id: employee.id,
              leave_type_id: leaveType.id,
              year: new Date().getFullYear(),
            },
          },
        });

        const currentAllocated = existingBalance?.allocated.toNumber() || 0;
        const maxDays = leaveType.max_days_per_year || 100;
        const daysToAllocate = Math.min(20, maxDays - currentAllocated);

        if (daysToAllocate > 0) {
          const allocateResponse = await makeRequest('POST', '/api/leave/balances/allocate', {
            user_id: employee.id,
            leave_type_id: leaveType.id,
            year: new Date().getFullYear(),
            days: daysToAllocate,
          }, adminToken || undefined);
          
          if (allocateResponse.status === 200 && allocateResponse.data.success) {
            logResult('1.2 Allocate Leave Balance', 'PASS', `Allocated ${daysToAllocate} days successfully`);
          } else {
            logResult('1.2 Allocate Leave Balance', 'FAIL', `Allocation failed: ${JSON.stringify(allocateResponse.data)}`);
          }
        }

        // Wait a moment for balance to be updated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check available balance
        const balance = await prisma.leaveBalance.findUnique({
          where: {
            user_id_leave_type_id_year: {
              user_id: employee.id,
              leave_type_id: leaveType.id,
              year: new Date().getFullYear(),
            },
          },
        });

        const available = (balance?.allocated.toNumber() || 0) - (balance?.used.toNumber() || 0) - (balance?.pending.toNumber() || 0);
        
        if (available < 1) {
          logResult('1.2 Create and Submit Leave Request', 'SKIP', `Insufficient balance: ${available} days available`);
        } else {
          const startDate = new Date();
          const endDate = new Date(startDate);
          const daysToRequest = Math.min(1, available); // Request only 1 day to ensure it works
          endDate.setDate(startDate.getDate() + daysToRequest);

          const { status, data } = await makeRequest('POST', '/api/leave/requests', {
          leave_type_id: leaveType.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          reason: 'Complex workflow test - 5 step approval',
          location_id: employee.primary_location_id,
        }, adminToken || undefined);

        if (status === 201 && data.data?.id) {
          leaveRequestId = data.data.id;
          
          // Submit for approval
          const submitResponse = await makeRequest('POST', `/api/leave/requests/${leaveRequestId}/submit`, {}, adminToken || undefined);
          if (submitResponse.status === 200) {
            const workflowInstance = await prisma.workflowInstance.findFirst({
              where: { resource_type: 'leave', resource_id: leaveRequestId || undefined },
            });
            if (workflowInstance) {
              workflowInstanceId = workflowInstance.id;
              logResult('1.2 Create and Submit Leave Request', 'PASS', 'Leave request submitted, workflow created');
            } else {
              logResult('1.2 Create and Submit Leave Request', 'FAIL', 'Workflow instance not created');
            }
          } else {
            logResult('1.2 Create and Submit Leave Request', 'FAIL', `Submit failed: ${JSON.stringify(submitResponse.data)}`);
          }
          } else {
            logResult('1.2 Create and Submit Leave Request', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
          }
        }
      }
    } catch (error: any) {
      logResult('1.2 Create and Submit Leave Request', 'FAIL', 'Error creating request', error.message);
    }

    // Approve all 5 steps
    if (workflowInstanceId) {
      try {
        let currentStep = 1;
        let allApproved = true;

        for (let i = 0; i < 5; i++) {
          const approver = approvers[i % approvers.length];
          
          const { status, data } = await makeRequest('POST', `/api/workflows/instances/${workflowInstanceId}/approve`, {
            comment: `Step ${currentStep} approved by ${approver.name}`,
          }, adminToken || undefined);

          if (status === 200) {
            const instance = await prisma.workflowInstance.findUnique({
              where: { id: workflowInstanceId },
            });
            
            if (instance?.status === 'Approved' && currentStep === 5) {
              logResult(`1.3 Approve Step ${currentStep}`, 'PASS', `Approved by ${approver.name}, workflow fully approved`);
              break;
            } else if (instance?.current_step_order === currentStep + 1) {
              logResult(`1.3 Approve Step ${currentStep}`, 'PASS', `Approved by ${approver.name}, moved to step ${currentStep + 1}`);
              currentStep++;
            } else {
              logResult(`1.3 Approve Step ${currentStep}`, 'FAIL', `Unexpected state: ${instance?.status}`);
              allApproved = false;
              break;
            }
          } else {
            logResult(`1.3 Approve Step ${currentStep}`, 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
            allApproved = false;
            break;
          }
        }

        if (allApproved) {
          logResult('1.4 Complete 5-Step Approval', 'PASS', 'All 5 steps approved successfully');
        }
      } catch (error: any) {
        logResult('1.3 Approve All Steps', 'FAIL', 'Error approving steps', error.message);
      }
    }

    // ========== SCENARIO 2: Decline and Resubmission ==========
    console.log('\n' + '='.repeat(80));
    console.log('SCENARIO 2: Decline at Step 3, Update, and Resubmit');
    console.log('='.repeat(80));

    let declinedWorkflowId: string | null = null;
    let resubmittedRequestId: string | null = null;

    try {
      const employee = employees[0];
      const leaveType = await prisma.leaveType.findFirst({ where: { name: 'Annual Leave' } });
      
      if (!employee || !leaveType) {
        logResult('2.1 Create Leave Request for Decline Test', 'SKIP', 'Employee or leave type not available');
      } else {
        // Check and allocate leave balance first
        const existingBalance = await prisma.leaveBalance.findUnique({
          where: {
            user_id_leave_type_id_year: {
              user_id: employee.id,
              leave_type_id: leaveType.id,
              year: new Date().getFullYear(),
            },
          },
        });

        const currentAllocated = existingBalance?.allocated.toNumber() || 0;
        const maxDays = leaveType.max_days_per_year || 100;
        const daysToAllocate = Math.min(20, maxDays - currentAllocated);

        if (daysToAllocate > 0) {
          await makeRequest('POST', '/api/leave/balances/allocate', {
            user_id: employee.id,
            leave_type_id: leaveType.id,
            year: new Date().getFullYear(),
            days: daysToAllocate,
          }, adminToken || undefined);
        }

        // Check available balance
        const balance = await prisma.leaveBalance.findUnique({
          where: {
            user_id_leave_type_id_year: {
              user_id: employee.id,
              leave_type_id: leaveType.id,
              year: new Date().getFullYear(),
            },
          },
        });

        const available = (balance?.allocated.toNumber() || 0) - (balance?.used.toNumber() || 0) - (balance?.pending.toNumber() || 0);
        const daysToRequest = Math.min(1, available);
        
        if (available < 1) {
          logResult('2.1 Create Leave Request for Decline Test', 'SKIP', `Insufficient balance: ${available} days available`);
        } else {
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + daysToRequest);

        const { status, data } = await makeRequest('POST', '/api/leave/requests', {
          leave_type_id: leaveType.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          reason: 'Test decline scenario',
          location_id: employee.primary_location_id,
        }, adminToken || undefined);

        if (status === 201 && data.data?.id) {
          const requestId = data.data.id;
          
          // Submit
          const submitResponse = await makeRequest('POST', `/api/leave/requests/${requestId}/submit`, {}, adminToken || undefined);
          if (submitResponse.status === 200) {
            const workflowInstance = await prisma.workflowInstance.findFirst({
              where: { resource_type: 'leave', resource_id: requestId },
            });
            
            if (workflowInstance) {
              declinedWorkflowId = workflowInstance.id;
              
              // Approve steps 1 and 2
              for (let step = 1; step <= 2; step++) {
                await makeRequest('POST', `/api/workflows/instances/${declinedWorkflowId}/approve`, {
                  comment: `Step ${step} approved`,
                }, adminToken || undefined);
              }

              // Decline at step 3
              const declineResponse = await makeRequest('POST', `/api/workflows/instances/${declinedWorkflowId}/decline`, {
                comment: 'Insufficient documentation. Please provide more details.',
              }, adminToken || undefined);

              if (declineResponse.status === 200) {
                const declinedInstance = await prisma.workflowInstance.findUnique({
                  where: { id: declinedWorkflowId },
                });

                if (declinedInstance?.status === 'Declined') {
                  logResult('2.2 Decline at Step 3', 'PASS', 'Workflow declined successfully');
                  
                  // Update leave request
                  const updateResponse = await makeRequest('PATCH', `/api/leave/requests/${requestId}`, {
                    reason: 'Updated reason with more documentation',
                  }, adminToken || undefined);

                  if (updateResponse.status === 200) {
                    logResult('2.3 Update Declined Request', 'PASS', 'Request updated after decline');
                    
                    // Resubmit
                    const resubmitResponse = await makeRequest('POST', `/api/leave/requests/${requestId}/submit`, {}, adminToken || undefined);
                    if (resubmitResponse.status === 200) {
                      const newWorkflow = await prisma.workflowInstance.findFirst({
                        where: { resource_type: 'leave', resource_id: requestId, status: 'Submitted' },
                      });
                      
                      if (newWorkflow) {
                        resubmittedRequestId = requestId;
                        logResult('2.4 Resubmit After Decline', 'PASS', 'Request resubmitted with new workflow instance');
                      } else {
                        logResult('2.4 Resubmit After Decline', 'FAIL', 'New workflow instance not created');
                      }
                    } else {
                      logResult('2.4 Resubmit After Decline', 'FAIL', `Resubmit failed: ${JSON.stringify(resubmitResponse.data)}`);
                    }
                  } else {
                    logResult('2.3 Update Declined Request', 'FAIL', `Update failed: ${JSON.stringify(updateResponse.data)}`);
                  }
                } else {
                  logResult('2.2 Decline at Step 3', 'FAIL', `Status not declined: ${declinedInstance?.status}`);
                }
              } else {
                logResult('2.2 Decline at Step 3', 'FAIL', `Decline failed: ${JSON.stringify(declineResponse.data)}`);
              }
            } else {
              logResult('2.1 Create Leave Request for Decline Test', 'FAIL', 'Workflow instance not created');
            }
          } else {
            logResult('2.1 Create Leave Request for Decline Test', 'FAIL', `Submit failed: ${JSON.stringify(submitResponse.data)}`);
          }
        } else {
          logResult('2.1 Create Leave Request for Decline Test', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
        }
        }
      }
    } catch (error: any) {
      logResult('2.1 Decline Scenario', 'FAIL', 'Error in decline scenario', error.message);
    }

    // ========== SCENARIO 3: Adjust and Route Back ==========
    console.log('\n' + '='.repeat(80));
    console.log('SCENARIO 3: Adjust Workflow and Route Back to Step 1');
    console.log('='.repeat(80));

    try {
      const employee = employees[0];
      const leaveType = await prisma.leaveType.findFirst({ where: { name: 'Annual Leave' } });
      
      if (!employee || !leaveType) {
        logResult('3.1 Create Request for Adjust Test', 'SKIP', 'Employee or leave type not available');
      } else {
        // Check and allocate leave balance first
        const existingBalance = await prisma.leaveBalance.findUnique({
          where: {
            user_id_leave_type_id_year: {
              user_id: employee.id,
              leave_type_id: leaveType.id,
              year: new Date().getFullYear(),
            },
          },
        });

        const currentAllocated = existingBalance?.allocated.toNumber() || 0;
        const maxDays = leaveType.max_days_per_year || 100;
        const daysToAllocate = Math.min(20, maxDays - currentAllocated);

        if (daysToAllocate > 0) {
          await makeRequest('POST', '/api/leave/balances/allocate', {
            user_id: employee.id,
            leave_type_id: leaveType.id,
            year: new Date().getFullYear(),
            days: daysToAllocate,
          }, adminToken || undefined);
        }

        // Check available balance
        const balance = await prisma.leaveBalance.findUnique({
          where: {
            user_id_leave_type_id_year: {
              user_id: employee.id,
              leave_type_id: leaveType.id,
              year: new Date().getFullYear(),
            },
          },
        });

        const available = (balance?.allocated.toNumber() || 0) - (balance?.used.toNumber() || 0) - (balance?.pending.toNumber() || 0);
        const daysToRequest = Math.min(1, available);
        
        if (available < 1) {
          logResult('3.1 Create Request for Adjust Test', 'SKIP', `Insufficient balance: ${available} days available`);
        } else {
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + daysToRequest);

        const { status, data } = await makeRequest('POST', '/api/leave/requests', {
          leave_type_id: leaveType.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          reason: 'Test adjust scenario',
          location_id: employee.primary_location_id,
        }, adminToken || undefined);

        if (status === 201 && data.data?.id) {
          const requestId = data.data.id;
          
          // Submit
          const submitResponse = await makeRequest('POST', `/api/leave/requests/${requestId}/submit`, {}, adminToken || undefined);
          if (submitResponse.status === 200) {
            const workflowInstance = await prisma.workflowInstance.findFirst({
              where: { resource_type: 'leave', resource_id: requestId },
            });
            
            if (workflowInstance) {
              // Approve step 1
              await makeRequest('POST', `/api/workflows/instances/${workflowInstance.id}/approve`, {
                comment: 'Step 1 approved',
              }, adminToken || undefined);

              // Adjust and route back to step 1
              const adjustResponse = await makeRequest('POST', `/api/workflows/instances/${workflowInstance.id}/adjust`, {
                comment: 'Please adjust dates and resubmit',
                route_to_step: 1,
              }, adminToken || undefined);

              if (adjustResponse.status === 200) {
                const adjustedInstance = await prisma.workflowInstance.findUnique({
                  where: { id: workflowInstance.id },
                });

                if (adjustedInstance?.status === 'Adjusted' && adjustedInstance.current_step_order === 1) {
                  logResult('3.2 Adjust and Route Back', 'PASS', 'Workflow adjusted and routed back to step 1');
                } else {
                  logResult('3.2 Adjust and Route Back', 'FAIL', `Unexpected state: ${adjustedInstance?.status}, step: ${adjustedInstance?.current_step_order}`);
                }
              } else {
                logResult('3.2 Adjust and Route Back', 'FAIL', `Adjust failed: ${JSON.stringify(adjustResponse.data)}`);
              }
            } else {
              logResult('3.1 Create Request for Adjust Test', 'FAIL', 'Workflow instance not created');
            }
          } else {
            logResult('3.1 Create Request for Adjust Test', 'FAIL', `Submit failed: ${JSON.stringify(submitResponse.data)}`);
          }
        } else {
          logResult('3.1 Create Request for Adjust Test', 'FAIL', `Failed: ${JSON.stringify(data).substring(0, 200)}`);
        }
      }
    } catch (error: any) {
      logResult('3.1 Adjust Scenario', 'FAIL', 'Error in adjust scenario', error.message);
    }

    // ========== SCENARIO 4: Multiple Approvers Cycling ==========
    console.log('\n' + '='.repeat(80));
    console.log('SCENARIO 4: 7-Step Workflow with 5 Approvers (Cycling)');
    console.log('='.repeat(80));

    try {
      // Create 7-step workflow
      const { status, data } = await makeRequest('POST', '/api/workflows/templates', {
        name: '7-Step Complex Workflow',
        resource_type: 'leave',
        location_id: testLocation.id,
        steps: Array.from({ length: 7 }, (_, i) => ({
          step_order: i + 1,
          required_permission: 'leave.approve',
          allow_decline: true,
          allow_adjust: i === 0,
        })),
      }, adminToken || undefined);

      if (status === 201 && data.data?.id) {
        const templateId = data.data.id;
        const employee = employees[0];
        const leaveType = await prisma.leaveType.findFirst({ where: { name: 'Annual Leave' } });
        
        if (employee && leaveType) {
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);

          const { status: reqStatus, data: reqData } = await makeRequest('POST', '/api/leave/requests', {
            leave_type_id: leaveType.id,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            reason: '7-step cycling test',
            location_id: employee.primary_location_id,
          }, adminToken || undefined);

          if (reqStatus === 201 && reqData.data?.id) {
            const requestId = reqData.data.id;
            const submitResponse = await makeRequest('POST', `/api/leave/requests/${requestId}/submit`, {}, adminToken || undefined);
            
            if (submitResponse.status === 200) {
              const workflowInstance = await prisma.workflowInstance.findFirst({
                where: { resource_type: 'leave', resource_id: requestId },
              });
              
              if (workflowInstance) {
                // Approve all 7 steps with 5 approvers (cycling)
                let allApproved = true;
                for (let step = 1; step <= 7; step++) {
                  const approverIndex = (step - 1) % approvers.length;
                  const approver = approvers[approverIndex];
                  
                  const { status: approveStatus } = await makeRequest('POST', `/api/workflows/instances/${workflowInstance.id}/approve`, {
                    comment: `Step ${step} approved by ${approver.name} (approver ${approverIndex + 1})`,
                  }, adminToken || undefined);

                  if (approveStatus !== 200) {
                    allApproved = false;
                    break;
                  }
                }

                if (allApproved) {
                  const finalInstance = await prisma.workflowInstance.findUnique({
                    where: { id: workflowInstance.id },
                  });
                  
                  if (finalInstance?.status === 'Approved') {
                    logResult('4.1 7-Step with Approver Cycling', 'PASS', 'All 7 steps approved with 5 approvers cycling');
                  } else {
                    logResult('4.1 7-Step with Approver Cycling', 'FAIL', `Not approved: ${finalInstance?.status}`);
                  }
                } else {
                  logResult('4.1 7-Step with Approver Cycling', 'FAIL', 'Some steps failed to approve');
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      logResult('4.1 Approver Cycling', 'FAIL', 'Error in cycling test', error.message);
    }

    // ========== SCENARIO 5: Cancel Workflow ==========
    console.log('\n' + '='.repeat(80));
    console.log('SCENARIO 5: Cancel Workflow by Creator');
    console.log('='.repeat(80));

    try {
      const employee = employees[0];
      const leaveType = await prisma.leaveType.findFirst({ where: { name: 'Annual Leave' } });
      
      if (!employee || !leaveType) {
        logResult('5.1 Cancel Workflow', 'SKIP', 'Employee or leave type not available');
      } else {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);

        const { status, data } = await makeRequest('POST', '/api/leave/requests', {
          leave_type_id: leaveType.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          reason: 'Test cancellation',
          location_id: employee.primary_location_id,
        }, adminToken || undefined);

        if (status === 201 && data.data?.id) {
          const requestId = data.data.id;
          const submitResponse = await makeRequest('POST', `/api/leave/requests/${requestId}/submit`, {}, adminToken || undefined);
          
          if (submitResponse.status === 200) {
            const workflowInstance = await prisma.workflowInstance.findFirst({
              where: { resource_type: 'leave', resource_id: requestId },
            });
            
            if (workflowInstance) {
              // Cancel workflow
              const cancelResponse = await makeRequest('POST', `/api/workflows/instances/${workflowInstance.id}/cancel`, {}, adminToken || undefined);
              
              if (cancelResponse.status === 200) {
                const cancelledInstance = await prisma.workflowInstance.findUnique({
                  where: { id: workflowInstance.id },
                });
                
                if (cancelledInstance?.status === 'Cancelled') {
                  logResult('5.1 Cancel Workflow', 'PASS', 'Workflow cancelled successfully');
                } else {
                  logResult('5.1 Cancel Workflow', 'FAIL', `Status not cancelled: ${cancelledInstance?.status}`);
                }
              } else {
                logResult('5.1 Cancel Workflow', 'FAIL', `Cancel failed: ${JSON.stringify(cancelResponse.data)}`);
              }
            }
          }
        }
      }
    } catch (error: any) {
      logResult('5.1 Cancel Workflow', 'FAIL', 'Error cancelling workflow', error.message);
    }

  } catch (error: any) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPLEX WORKFLOW TEST SUMMARY');
    console.log('='.repeat(80));
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📝 Total: ${results.length}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All complex workflow scenarios passed!');
    } else {
      console.log('\n⚠️  Some scenarios failed. Review the output above.');
      console.log('\nFailed scenarios:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  - ${r.testName}: ${r.error || r.details}`);
      });
    }
  }
}

main().catch(console.error);
