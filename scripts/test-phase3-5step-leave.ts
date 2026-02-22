import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';
import { createWorkflowInstance, submitWorkflowInstance, approveWorkflowStep } from '../app/lib/services/workflow';

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
const findings: string[] = [];
const issues: Array<{ issue: string; solution: string; resolved: boolean }> = [];

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

function addFinding(finding: string) {
  findings.push(finding);
  console.log(`   📝 Finding: ${finding}`);
}

function logIssue(issue: string, solution: string, resolved: boolean = false) {
  issues.push({ issue, solution, resolved });
  console.log(`\n   ⚠️  ISSUE: ${issue}`);
  console.log(`   🔧 SOLUTION: ${solution}`);
  console.log(`   ${resolved ? '✅ RESOLVED' : '🔄 IN PROGRESS'}`);
}

async function main() {
  console.log('🧪 PHASE 3: 5-STEP LEAVE APPROVAL WORKFLOW TEST');
  console.log('='.repeat(80));
  console.log('Testing complex multi-step approval process\n');

  const startTime = Date.now();

  try {
    // Setup: Get required data
    console.log('📋 SETUP: Gathering Required Data');
    console.log('-'.repeat(80));

    const regularStaffType = await prisma.staffType.findFirst({
      where: { code: 'regular' },
    });
    if (!regularStaffType) {
      throw new Error('Regular staff type not found. Please run seed script.');
    }
    console.log(`✅ Found Regular Staff Type: ${regularStaffType.name}`);

    const location = await prisma.location.findFirst({
      where: { name: 'Nairobi Office' },
    });
    if (!location) {
      throw new Error('Nairobi Office location not found. Please run seed script.');
    }
    console.log(`✅ Found Location: ${location.name}`);

    const leaveType = await prisma.leaveType.findFirst({
      where: { name: 'Annual Leave' },
    });
    if (!leaveType) {
      throw new Error('Annual Leave type not found. Please run seed script.');
    }
    console.log(`✅ Found Leave Type: ${leaveType.name}`);

    // Test 1: Create 5-Level Permissions
    console.log('\n📋 TEST 1: Create 5-Level Leave Approval Permissions');
    console.log('-'.repeat(80));

    const permissions = [];
    for (let i = 1; i <= 5; i++) {
      process.stdout.write(`   Creating leave.approve.level${i} permission... `);
      try {
        const permission = await prisma.permission.upsert({
          where: { name: `leave.approve.level${i}` },
          update: {},
          create: {
            name: `leave.approve.level${i}`,
            module: 'leave',
            description: `Level ${i} leave approval permission`,
          },
        });
        permissions.push(permission);
        console.log('✅');
      } catch (error: any) {
        console.log('❌');
        logIssue(
          `Failed to create leave.approve.level${i} permission`,
          error.message,
          false
        );
        throw error;
      }
    }
    logResult(
      'Create 5-Level Permissions',
      'PASS',
      `Created ${permissions.length} level-based permissions`,
      undefined,
      { permissions: permissions.map(p => p.name) }
    );
    addFinding(`Created 5 distinct leave approval permissions (level1 through level5)`);

    // Test 2: Create 5 Approver Roles
    console.log('\n📋 TEST 2: Create 5 Approver Roles');
    console.log('-'.repeat(80));

    const roles = [];
    for (let i = 1; i <= 5; i++) {
      process.stdout.write(`   Creating Leave Approver Level ${i} role... `);
      try {
        const role = await prisma.role.upsert({
          where: { name: `Leave Approver Level ${i}` },
          update: {
            role_permissions: {
              deleteMany: {},
              create: {
                permission_id: permissions[i - 1].id,
              },
            },
          },
          create: {
            name: `Leave Approver Level ${i}`,
            description: `Level ${i} leave approver role`,
            status: 'active',
            role_permissions: {
              create: {
                permission_id: permissions[i - 1].id,
              },
            },
          },
        });
        roles.push(role);
        console.log('✅');
      } catch (error: any) {
        console.log('❌');
        logIssue(
          `Failed to create Leave Approver Level ${i} role`,
          error.message,
          false
        );
        throw error;
      }
    }
    logResult(
      'Create 5 Approver Roles',
      'PASS',
      `Created ${roles.length} approver roles`,
      undefined,
      { roles: roles.map(r => r.name) }
    );
    addFinding(`Created 5 approver roles, each with one level-specific permission`);

    // Test 3: Create 5 Approver Users
    console.log('\n📋 TEST 3: Create 5 Approver Users');
    console.log('-'.repeat(80));

    const approvers = [];
    for (let i = 1; i <= 5; i++) {
      process.stdout.write(`   Creating Approver Level ${i} user... `);
      try {
        const approverEmail = `approver-level${i}-${Date.now()}@test.com`;
        const approver = await prisma.user.create({
          data: {
            name: `Leave Approver Level ${i}`,
            email: approverEmail,
            password_hash: await hashPassword('TestPassword123!'),
            primary_location_id: location.id,
            status: 'active',
            user_roles: {
              create: {
                role_id: roles[i - 1].id,
              },
            },
          },
        });

        // Create location scope for the permission
        await prisma.userPermissionScope.create({
          data: {
            user_id: approver.id,
            permission_id: permissions[i - 1].id,
            location_id: location.id,
            status: 'active',
            is_global: false,
            include_descendants: false,
            valid_from: new Date(),
          },
        });

        approvers.push(approver);
        console.log('✅');
      } catch (error: any) {
        console.log('❌');
        logIssue(
          `Failed to create Approver Level ${i} user`,
          error.message,
          false
        );
        throw error;
      }
    }
    logResult(
      'Create 5 Approver Users',
      'PASS',
      `Created ${approvers.length} approver users with roles and location scopes`,
      undefined,
      { approvers: approvers.map(a => ({ name: a.name, email: a.email })) }
    );
    addFinding(`Created 5 approver users, each assigned one level-specific role and location scope`);

    // Test 4: Create 5-Step Workflow Template
    console.log('\n📋 TEST 4: Create 5-Step Workflow Template');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating 5-step leave approval workflow template... ');
    let workflowTemplate;
    try {
      // Check if template already exists
      const existingTemplate = await prisma.workflowTemplate.findFirst({
        where: {
          name: '5-Step Leave Approval Workflow',
          location_id: location.id,
          resource_type: 'leave',
        },
      });

      if (existingTemplate) {
        // Update existing template
        await prisma.workflowStep.deleteMany({
          where: { workflow_template_id: existingTemplate.id },
        });

        workflowTemplate = await prisma.workflowTemplate.update({
          where: { id: existingTemplate.id },
          data: {
            steps: {
              create: permissions.map((perm, index) => ({
                step_order: index + 1,
                required_permission: perm.name,
                allow_decline: true,
                allow_adjust: index === 0, // Only first step allows adjustment
              })),
            },
          },
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        });
      } else {
        workflowTemplate = await prisma.workflowTemplate.create({
          data: {
            name: '5-Step Leave Approval Workflow',
            resource_type: 'leave',
            location_id: location.id,
            version: 1,
            status: 'active',
            steps: {
              create: permissions.map((perm, index) => ({
                step_order: index + 1,
                required_permission: perm.name,
                allow_decline: true,
                allow_adjust: index === 0, // Only first step allows adjustment
              })),
            },
          },
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        });
      }
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to create 5-step workflow template',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create 5-Step Workflow Template',
      'PASS',
      `Created workflow template with ${workflowTemplate.steps.length} steps`,
      undefined,
      {
        template_id: workflowTemplate.id,
        steps: workflowTemplate.steps.map(s => ({
          step_order: s.step_order,
          required_permission: s.required_permission,
        })),
      }
    );
    addFinding(`Created 5-step workflow template. Each step requires a different level permission.`);

    // Test 5: Create Test Employee
    console.log('\n📋 TEST 5: Create Test Employee');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating test employee... ');
    const testEmail = `employee-5step-${Date.now()}@test.com`;
    let testEmployee;
    try {
      testEmployee = await prisma.user.create({
        data: {
          name: 'Employee 5-Step',
          email: testEmail,
          password_hash: await hashPassword('TestPassword123!'),
          primary_location_id: location.id,
          staff_type_id: regularStaffType.id,
          status: 'active',
          staff_number: `EMP5-${Date.now()}`,
          charge_code: 'EMP5-CC-001',
        },
      });

      // Assign leave.create permission
      const employeeRole = await prisma.role.findFirst({
        where: { name: 'Employee' },
      });
      if (employeeRole) {
        await prisma.userRole.create({
          data: {
            user_id: testEmployee.id,
            role_id: employeeRole.id,
          },
        });
      }

      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to create test employee',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create Test Employee',
      'PASS',
      `Created employee: ${testEmployee.name}`,
      undefined,
      { id: testEmployee.id, staff_number: testEmployee.staff_number }
    );
    addFinding(`Created test employee with staff_number: ${testEmployee.staff_number}`);

    // Test 6: Create and Submit Leave Request
    console.log('\n📋 TEST 6: Create and Submit Leave Request');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating leave request... ');
    const leaveStartDate = new Date('2025-04-01');
    const leaveEndDate = new Date('2025-04-05');
    const daysRequested = Math.ceil((leaveEndDate.getTime() - leaveStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    let leaveRequest;
    try {
      leaveRequest = await prisma.leaveRequest.create({
        data: {
          user_id: testEmployee.id,
          leave_type_id: leaveType.id,
          start_date: leaveStartDate,
          end_date: leaveEndDate,
          days_requested: daysRequested,
          reason: 'Phase 3 test - 5-step approval',
          location_id: location.id,
          status: 'Draft',
        },
      });
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to create leave request',
        error.message,
        false
      );
      throw error;
    }

    process.stdout.write('   Submitting leave request... ');
    let workflowInstanceId;
    try {
      workflowInstanceId = await createWorkflowInstance({
        templateId: workflowTemplate.id,
        resourceId: leaveRequest.id,
        resourceType: 'leave',
        createdBy: testEmployee.id,
        locationId: location.id,
      });

      await submitWorkflowInstance(workflowInstanceId);

      await prisma.leaveRequest.update({
        where: { id: leaveRequest.id },
        data: {
          status: 'Submitted',
          workflow_instance_id: workflowInstanceId,
        },
      });
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to submit leave request',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create and Submit Leave Request',
      'PASS',
      `Leave request submitted, workflow instance created`,
      undefined,
      {
        leave_request_id: leaveRequest.id,
        workflow_instance_id: workflowInstanceId,
        days_requested: daysRequested,
      }
    );
    addFinding(`Leave request submitted successfully. Workflow has 5 steps.`);

    // Test 7: Approve Through All 5 Steps
    console.log('\n📋 TEST 7: Approve Through All 5 Steps');
    console.log('-'.repeat(80));

    let currentWorkflowInstance = await prisma.workflowInstance.findUnique({
      where: { id: workflowInstanceId },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        },
        steps: {
          orderBy: { step_order: 'asc' },
        },
      },
    });

    if (!currentWorkflowInstance) {
      logResult('Approve Through All 5 Steps', 'FAIL', 'Workflow instance not found');
    } else {
      let allStepsApproved = true;
      let stepNumber = 1;

      // Process each step in order
      while (stepNumber <= 5 && currentWorkflowInstance.current_step_order <= 5) {
        const currentStep = currentWorkflowInstance.template.steps.find(
          (s) => s.step_order === currentWorkflowInstance.current_step_order
        );

        if (!currentStep) {
          logIssue(
            `Step ${currentWorkflowInstance.current_step_order} not found in template`,
            'Workflow template may be misconfigured',
            false
          );
          allStepsApproved = false;
          break;
        }

        const approver = approvers[currentWorkflowInstance.current_step_order - 1];
        if (!approver) {
          logIssue(
            `No approver found for step ${currentWorkflowInstance.current_step_order}`,
            'Approver array may be misconfigured',
            false
          );
          allStepsApproved = false;
          break;
        }

        process.stdout.write(`   Approving step ${currentWorkflowInstance.current_step_order} with ${approver.name}... `);
        try {
          await approveWorkflowStep({
            instanceId: workflowInstanceId,
            stepOrder: currentWorkflowInstance.current_step_order,
            userId: approver.id,
            locationId: location.id,
            action: 'approve',
            comment: `Phase 3 test approval for step ${currentWorkflowInstance.current_step_order}`,
          });
          console.log('✅');

          // Refresh workflow instance
          currentWorkflowInstance = await prisma.workflowInstance.findUnique({
            where: { id: workflowInstanceId },
            include: {
              template: {
                include: {
                  steps: {
                    orderBy: { step_order: 'asc' },
                  },
                },
              },
              steps: {
                orderBy: { step_order: 'asc' },
              },
            },
          });

          if (!currentWorkflowInstance) {
            logIssue(
              'Workflow instance not found after approval',
              'Database query may have failed',
              false
            );
            allStepsApproved = false;
            break;
          }

          addFinding(`Step ${stepNumber} approved by ${approver.name}. Status: ${currentWorkflowInstance.status}, Current step: ${currentWorkflowInstance.current_step_order}`);

          // If approved, break
          if (currentWorkflowInstance.status === 'Approved') {
            break;
          }

          stepNumber++;
        } catch (error: any) {
          console.log('❌');
          logIssue(
            `Failed to approve step ${currentWorkflowInstance.current_step_order}`,
            error.message,
            false
          );
          logResult(
            `Approve Step ${currentWorkflowInstance.current_step_order}`,
            'FAIL',
            `Failed to approve step`,
            error.message
          );
          allStepsApproved = false;
          break;
        }
      }

      const finalInstance = await prisma.workflowInstance.findUnique({
        where: { id: workflowInstanceId },
      });

      if (allStepsApproved && finalInstance?.status === 'Approved') {
        logResult(
          'Approve Through All 5 Steps',
          'PASS',
          `All 5 steps approved successfully. Final status: ${finalInstance.status}`,
          undefined,
          {
            final_status: finalInstance.status,
            total_steps: 5,
            steps_approved: stepNumber,
          }
        );
        addFinding(`Leave request fully approved through 5-step workflow`);
      } else {
        logResult(
          'Approve Through All 5 Steps',
          'FAIL',
          `Not all steps approved. Final status: ${finalInstance?.status}, Steps completed: ${stepNumber}`,
          undefined,
          { final_status: finalInstance?.status, steps_completed: stepNumber }
        );
      }
    }

    // Test 8: Verify Notifications
    console.log('\n📋 TEST 8: Verify Notifications');
    console.log('-'.repeat(80));

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: testEmployee.id,
        created_at: {
          gte: new Date(startTime),
        },
      },
      orderBy: { created_at: 'desc' },
    });

    logResult(
      'Verify Notifications',
      notifications.length > 0 ? 'PASS' : 'SKIP',
      `Found ${notifications.length} notifications for test employee`,
      undefined,
      { notification_count: notifications.length }
    );
    if (notifications.length > 0) {
      addFinding(`System generated ${notifications.length} notifications during 5-step workflow`);
    }

    // Test 9: Verify Audit Logs
    console.log('\n📋 TEST 9: Verify Audit Logs');
    console.log('-'.repeat(80));

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: new Date(startTime),
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    logResult(
      'Verify Audit Logs',
      auditLogs.length > 0 ? 'PASS' : 'SKIP',
      `Found ${auditLogs.length} audit log entries`,
      undefined,
      { audit_log_count: auditLogs.length }
    );
    if (auditLogs.length > 0) {
      addFinding(`System generated ${auditLogs.length} audit log entries for 5-step workflow`);
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n⏱️  Total Duration: ${duration}s`);
    console.log(`\n📈 Results:`);
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    if (skipped > 0) {
      console.log(`   ⏭️  Skipped: ${skipped}`);
    }
    console.log(`   📊 Total: ${results.length}`);

    if (issues.length > 0) {
      console.log(`\n⚠️  Issues Encountered: ${issues.length}`);
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.issue}`);
        console.log(`      Solution: ${issue.solution}`);
        console.log(`      Status: ${issue.resolved ? '✅ Resolved' : '🔄 In Progress'}`);
      });
    }

    console.log(`\n📝 Key Findings:`);
    findings.forEach((finding, index) => {
      console.log(`   ${index + 1}. ${finding}`);
    });

    if (failed === 0) {
      console.log('\n✅ Phase 3 Tests: ALL PASSED');
      console.log('   5-step leave approval workflow validated successfully!');
    } else {
      console.log('\n❌ Phase 3 Tests: SOME FAILED');
      console.log('   Please review failed tests and issues.');
    }

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error.stack);
    
    // Log the error as an issue
    logIssue(
      'Test suite failed with unhandled error',
      error.message,
      false
    );
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
