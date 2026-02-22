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

async function approveWorkflowSteps(
  workflowInstanceId: string,
  approvers: Array<{ id: string; name: string }>,
  locationId: string,
  workflowName: string
): Promise<boolean> {
  let currentInstance = await prisma.workflowInstance.findUnique({
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

  if (!currentInstance) {
    return false;
  }

  let stepNumber = 1;
  const maxSteps = currentInstance.template.steps.length;

  while (stepNumber <= maxSteps && currentInstance.current_step_order <= maxSteps) {
    const currentStep = currentInstance.template.steps.find(
      (s) => s.step_order === currentInstance.current_step_order
    );

    if (!currentStep) {
      break;
    }

    // Use approver based on step order (cycle through if needed)
    const approverIndex = (currentInstance.current_step_order - 1) % approvers.length;
    const approver = approvers[approverIndex];

    process.stdout.write(`   Step ${currentInstance.current_step_order}: ${approver.name}... `);
    try {
      await approveWorkflowStep({
        instanceId: workflowInstanceId,
        stepOrder: currentInstance.current_step_order,
        userId: approver.id,
        locationId: locationId,
        action: 'approve',
        comment: `${workflowName} - Step ${currentInstance.current_step_order} approved by ${approver.name}`,
      });
      console.log('✅');

      // Refresh workflow instance
      currentInstance = await prisma.workflowInstance.findUnique({
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

      if (!currentInstance) {
        return false;
      }

      addFinding(`${workflowName} - Step ${stepNumber} approved by ${approver.name}. Status: ${currentInstance.status}, Current step: ${currentInstance.current_step_order}`);

      if (currentInstance.status === 'Approved') {
        return true;
      }

      stepNumber++;
    } catch (error: any) {
      console.log('❌');
      logIssue(
        `${workflowName} - Failed to approve step ${currentInstance.current_step_order} with ${approver.name}`,
        error.message,
        false
      );
      return false;
    }
  }

  return currentInstance.status === 'Approved';
}

async function main() {
  console.log('🧪 PHASE 4: ROBUST WORKFLOW TESTING');
  console.log('='.repeat(80));
  console.log('Testing different employee types with multiple approvers and workflow configurations\n');

  const startTime = Date.now();

  try {
    // Setup: Get required data
    console.log('📋 SETUP: Gathering Required Data');
    console.log('-'.repeat(80));

    const casualStaffType = await prisma.staffType.findFirst({
      where: { code: 'casual' },
    });
    const regularStaffType = await prisma.staffType.findFirst({
      where: { code: 'regular' },
    });
    const laundryWorkerStaffType = await prisma.staffType.findFirst({
      where: { code: 'laundry_worker' },
    });

    if (!casualStaffType || !regularStaffType || !laundryWorkerStaffType) {
      throw new Error('Required staff types not found. Please run seed script.');
    }
    console.log(`✅ Found Casual Staff Type: ${casualStaffType.name}`);
    console.log(`✅ Found Regular Staff Type: ${regularStaffType.name}`);
    console.log(`✅ Found Laundry Worker Staff Type: ${laundryWorkerStaffType.name}`);

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

    // Get permissions
    const leaveApprovePermission = await prisma.permission.findFirst({
      where: { name: 'leave.approve' },
    });
    const timesheetApprovePermission = await prisma.permission.findFirst({
      where: { name: 'timesheet.approve' },
    });

    if (!leaveApprovePermission || !timesheetApprovePermission) {
      throw new Error('Required permissions not found. Please run seed script.');
    }
    console.log(`✅ Found required permissions`);

    // Test 1: Create 5 Different Approver Users
    console.log('\n📋 TEST 1: Create 5 Different Approver Users');
    console.log('-'.repeat(80));

    // Get or create Approver role
    let approverRole = await prisma.role.findFirst({
      where: { name: 'Approver' },
    });

    if (!approverRole) {
      approverRole = await prisma.role.create({
        data: {
          name: 'Approver',
          description: 'Role for workflow approvers',
          status: 'active',
          role_permissions: {
            create: [
              { permission_id: leaveApprovePermission.id },
              { permission_id: timesheetApprovePermission.id },
            ],
          },
        },
      });
    }

    const approvers = [];
    const approverNames = ['Alice Manager', 'Bob Supervisor', 'Carol Director', 'David HR', 'Eve Finance'];

    for (let i = 0; i < 5; i++) {
      process.stdout.write(`   Creating ${approverNames[i]}... `);
      try {
        const approverEmail = `approver-${i + 1}-${Date.now()}@test.com`;
        const approver = await prisma.user.create({
          data: {
            name: approverNames[i],
            email: approverEmail,
            password_hash: await hashPassword('TestPassword123!'),
            primary_location_id: location.id,
            status: 'active',
            staff_number: `APP${i + 1}-${Date.now()}`,
            charge_code: `APP${i + 1}-CC-001`,
            user_roles: {
              create: {
                role_id: approverRole.id,
              },
            },
          },
        });

        // Create location scopes for both permissions
        await prisma.userPermissionScope.create({
          data: {
            user_id: approver.id,
            permission_id: leaveApprovePermission.id,
            location_id: location.id,
            status: 'active',
            is_global: false,
            include_descendants: false,
            valid_from: new Date(),
          },
        });

        await prisma.userPermissionScope.create({
          data: {
            user_id: approver.id,
            permission_id: timesheetApprovePermission.id,
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
          `Failed to create ${approverNames[i]}`,
          error.message,
          false
        );
        throw error;
      }
    }

    logResult(
      'Create 5 Approver Users',
      'PASS',
      `Created ${approvers.length} approver users with leave.approve and timesheet.approve permissions`,
      undefined,
      { approvers: approvers.map(a => ({ name: a.name, staff_number: a.staff_number })) }
    );
    addFinding(`Created 5 approver users: ${approvers.map(a => a.name).join(', ')}`);

    // Test 2: Create Employees (Casual, Regular, Laundry Worker)
    console.log('\n📋 TEST 2: Create Employees (Casual, Regular, Laundry Worker)');
    console.log('-'.repeat(80));

    const employees = [];
    const employeeConfigs = [
      { name: 'John Casual', type: casualStaffType, code: 'CAS' },
      { name: 'Jane Regular', type: regularStaffType, code: 'REG' },
      { name: 'Jack Laundry', type: laundryWorkerStaffType, code: 'LAU' },
    ];

    const employeeRole = await prisma.role.findFirst({
      where: { name: 'Employee' },
    });

    for (const config of employeeConfigs) {
      process.stdout.write(`   Creating ${config.name}... `);
      try {
        const employeeEmail = `${config.name.toLowerCase().replace(' ', '-')}-${Date.now()}@test.com`;
        const employee = await prisma.user.create({
          data: {
            name: config.name,
            email: employeeEmail,
            password_hash: await hashPassword('TestPassword123!'),
            primary_location_id: location.id,
            staff_type_id: config.type.id,
            status: 'active',
            staff_number: `${config.code}-${Date.now()}`,
            charge_code: `${config.code}-CC-001`,
            user_roles: employeeRole ? {
              create: {
                role_id: employeeRole.id,
              },
            } : undefined,
          },
        });
        employees.push(employee);
        console.log('✅');
      } catch (error: any) {
        console.log('❌');
        logIssue(
          `Failed to create ${config.name}`,
          error.message,
          false
        );
        throw error;
      }
    }

    logResult(
      'Create Employees',
      'PASS',
      `Created ${employees.length} employees (Casual, Regular, Laundry Worker)`,
      undefined,
      { employees: employees.map(e => ({ name: e.name, staff_type: e.staff_type_id, staff_number: e.staff_number })) }
    );
    addFinding(`Created ${employees.length} employees: ${employees.map(e => e.name).join(', ')}`);

    // Test 3: Create 4-Step Leave Workflow with Different Approvers
    console.log('\n📋 TEST 3: Create 4-Step Leave Workflow');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating 4-step leave workflow template... ');
    let leaveWorkflow4Step;
    try {
      // Check if template exists
      const existing = await prisma.workflowTemplate.findFirst({
        where: {
          name: '4-Step Leave Approval - Phase 4',
          location_id: location.id,
          resource_type: 'leave',
        },
      });

      if (existing) {
        await prisma.workflowStep.deleteMany({
          where: { workflow_template_id: existing.id },
        });

        leaveWorkflow4Step = await prisma.workflowTemplate.update({
          where: { id: existing.id },
          data: {
            steps: {
              create: [
                { step_order: 1, required_permission: 'leave.approve', allow_decline: true, allow_adjust: true },
                { step_order: 2, required_permission: 'leave.approve', allow_decline: true, allow_adjust: false },
                { step_order: 3, required_permission: 'leave.approve', allow_decline: true, allow_adjust: false },
                { step_order: 4, required_permission: 'leave.approve', allow_decline: true, allow_adjust: false },
              ],
            },
          },
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        });
      } else {
        leaveWorkflow4Step = await prisma.workflowTemplate.create({
          data: {
            name: '4-Step Leave Approval - Phase 4',
            resource_type: 'leave',
            location_id: location.id,
            version: 1,
            status: 'active',
            steps: {
              create: [
                { step_order: 1, required_permission: 'leave.approve', allow_decline: true, allow_adjust: true },
                { step_order: 2, required_permission: 'leave.approve', allow_decline: true, allow_adjust: false },
                { step_order: 3, required_permission: 'leave.approve', allow_decline: true, allow_adjust: false },
                { step_order: 4, required_permission: 'leave.approve', allow_decline: true, allow_adjust: false },
              ],
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
        'Failed to create 4-step leave workflow',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create 4-Step Leave Workflow',
      'PASS',
      `Created workflow template with ${leaveWorkflow4Step.steps.length} steps`,
      undefined,
      { template_id: leaveWorkflow4Step.id, steps: leaveWorkflow4Step.steps.length }
    );
    addFinding(`Created 4-step leave workflow template`);

    // Test 4: Create 5-Step Timesheet Workflow
    console.log('\n📋 TEST 4: Create 5-Step Timesheet Workflow');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating 5-step timesheet workflow template... ');
    let timesheetWorkflow5Step;
    try {
      const existing = await prisma.workflowTemplate.findFirst({
        where: {
          name: '5-Step Timesheet Approval - Phase 4',
          location_id: location.id,
          resource_type: 'timesheet',
        },
      });

      if (existing) {
        await prisma.workflowStep.deleteMany({
          where: { workflow_template_id: existing.id },
        });

        timesheetWorkflow5Step = await prisma.workflowTemplate.update({
          where: { id: existing.id },
          data: {
            steps: {
              create: [
                { step_order: 1, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: true },
                { step_order: 2, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
                { step_order: 3, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
                { step_order: 4, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
                { step_order: 5, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
              ],
            },
          },
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        });
      } else {
        timesheetWorkflow5Step = await prisma.workflowTemplate.create({
          data: {
            name: '5-Step Timesheet Approval - Phase 4',
            resource_type: 'timesheet',
            location_id: location.id,
            version: 1,
            status: 'active',
            steps: {
              create: [
                { step_order: 1, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: true },
                { step_order: 2, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
                { step_order: 3, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
                { step_order: 4, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
                { step_order: 5, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
              ],
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
        'Failed to create 5-step timesheet workflow',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create 5-Step Timesheet Workflow',
      'PASS',
      `Created workflow template with ${timesheetWorkflow5Step.steps.length} steps`,
      undefined,
      { template_id: timesheetWorkflow5Step.id, steps: timesheetWorkflow5Step.steps.length }
    );
    addFinding(`Created 5-step timesheet workflow template`);

    // Test 5: Test Leave Requests with 4-Step Workflow (Different Employee Types)
    console.log('\n📋 TEST 5: Test Leave Requests with 4-Step Workflow');
    console.log('-'.repeat(80));

    const leaveResults = [];

    for (const employee of employees) {
      console.log(`\n   Testing ${employee.name} (${employee.staff_number})...`);
      
      process.stdout.write(`     Creating leave request... `);
      const leaveStartDate = new Date('2025-05-01');
      const leaveEndDate = new Date('2025-05-03');
      const daysRequested = 3;

      let leaveRequest;
      try {
        leaveRequest = await prisma.leaveRequest.create({
          data: {
            user_id: employee.id,
            leave_type_id: leaveType.id,
            start_date: leaveStartDate,
            end_date: leaveEndDate,
            days_requested: daysRequested,
            reason: `Phase 4 robust test - ${employee.name} leave`,
            location_id: location.id,
            status: 'Draft',
          },
        });
        console.log('✅');
      } catch (error: any) {
        console.log('❌');
        logIssue(
          `Failed to create leave request for ${employee.name}`,
          error.message,
          false
        );
        continue;
      }

      process.stdout.write(`     Submitting leave request... `);
      try {
        const workflowInstanceId = await createWorkflowInstance({
          templateId: leaveWorkflow4Step.id,
          resourceId: leaveRequest.id,
          resourceType: 'leave',
          createdBy: employee.id,
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

        process.stdout.write(`     Approving through 4 steps with different approvers... `);
        // Use first 4 approvers
        const approversForLeave = approvers.slice(0, 4);
        const approved = await approveWorkflowSteps(
          workflowInstanceId,
          approversForLeave,
          location.id,
          `${employee.name} Leave`
        );

        if (approved) {
          console.log('✅');
          leaveResults.push({ employee: employee.name, status: 'PASS' });
          addFinding(`${employee.name} leave request approved through 4 steps with approvers: ${approversForLeave.map(a => a.name).join(' → ')}`);
        } else {
          console.log('❌');
          leaveResults.push({ employee: employee.name, status: 'FAIL' });
        }
      } catch (error: any) {
        console.log('❌');
        logIssue(
          `Failed to process leave request for ${employee.name}`,
          error.message,
          false
        );
        leaveResults.push({ employee: employee.name, status: 'FAIL' });
      }
    }

    const leavePassed = leaveResults.filter(r => r.status === 'PASS').length;
    logResult(
      'Test Leave Requests with 4-Step Workflow',
      leavePassed === employees.length ? 'PASS' : 'FAIL',
      `${leavePassed}/${employees.length} employee leave requests approved successfully`,
      undefined,
      { results: leaveResults }
    );

    // Test 6: Test Timesheets with 5-Step Workflow (Different Employee Types)
    console.log('\n📋 TEST 6: Test Timesheets with 5-Step Workflow');
    console.log('-'.repeat(80));

    const timesheetResults = [];

    for (const employee of employees) {
      console.log(`\n   Testing ${employee.name} (${employee.staff_number})...`);
      
      process.stdout.write(`     Creating timesheet for May 2025... `);
      const periodStart = new Date('2025-05-01');
      const periodEnd = new Date('2025-05-31');

      let timesheetResult;
      try {
        timesheetResult = await createTimesheet({
          userId: employee.id,
          locationId: location.id,
          periodStart,
          periodEnd,
        });
        console.log('✅');
      } catch (error: any) {
        console.log('❌');
        logIssue(
          `Failed to create timesheet for ${employee.name}`,
          error.message,
          false
        );
        continue;
      }

      // Create timesheet period
      await prisma.timesheetPeriod.upsert({
        where: {
          id: `period-${periodStart.toISOString().split('T')[0]}`,
        },
        update: {
          submission_enabled: true,
        },
        create: {
          id: `period-${periodStart.toISOString().split('T')[0]}`,
          period_start: periodStart,
          period_end: periodEnd,
          submission_enabled: true,
        },
      });

      process.stdout.write(`     Submitting timesheet... `);
      try {
        const workflowInstanceId = await createWorkflowInstance({
          templateId: timesheetWorkflow5Step.id,
          resourceId: timesheetResult.id,
          resourceType: 'timesheet',
          createdBy: employee.id,
          locationId: location.id,
        });

        await submitWorkflowInstance(workflowInstanceId);

        await prisma.timesheet.update({
          where: { id: timesheetResult.id },
          data: {
            status: 'Submitted',
            workflow_instance_id: workflowInstanceId,
          },
        });
        console.log('✅');

        process.stdout.write(`     Approving through 5 steps with different approvers... `);
        // Use all 5 approvers
        const approved = await approveWorkflowSteps(
          workflowInstanceId,
          approvers,
          location.id,
          `${employee.name} Timesheet`
        );

        if (approved) {
          console.log('✅');
          timesheetResults.push({ employee: employee.name, status: 'PASS' });
          addFinding(`${employee.name} timesheet approved through 5 steps with approvers: ${approvers.map(a => a.name).join(' → ')}`);
        } else {
          console.log('❌');
          timesheetResults.push({ employee: employee.name, status: 'FAIL' });
        }
      } catch (error: any) {
        console.log('❌');
        logIssue(
          `Failed to process timesheet for ${employee.name}`,
          error.message,
          false
        );
        timesheetResults.push({ employee: employee.name, status: 'FAIL' });
      }
    }

    const timesheetPassed = timesheetResults.filter(r => r.status === 'PASS').length;
    logResult(
      'Test Timesheets with 5-Step Workflow',
      timesheetPassed === employees.length ? 'PASS' : 'FAIL',
      `${timesheetPassed}/${employees.length} employee timesheets approved successfully`,
      undefined,
      { results: timesheetResults }
    );

    // Test 7: Test with Reversed Approver Order
    console.log('\n📋 TEST 7: Test with Reversed Approver Order');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating test leave request... ');
    const testEmployee = employees[0]; // Use first employee
    const testLeaveRequest = await prisma.leaveRequest.create({
      data: {
        user_id: testEmployee.id,
        leave_type_id: leaveType.id,
        start_date: new Date('2025-05-10'),
        end_date: new Date('2025-05-12'),
        days_requested: 3,
        reason: 'Phase 4 test - Reversed approver order',
        location_id: location.id,
        status: 'Draft',
      },
    });
    console.log('✅');

    process.stdout.write('   Submitting leave request... ');
    const reversedWorkflowInstanceId = await createWorkflowInstance({
      templateId: leaveWorkflow4Step.id,
      resourceId: testLeaveRequest.id,
      resourceType: 'leave',
      createdBy: testEmployee.id,
      locationId: location.id,
    });

    await submitWorkflowInstance(reversedWorkflowInstanceId);

    await prisma.leaveRequest.update({
      where: { id: testLeaveRequest.id },
      data: {
        status: 'Submitted',
        workflow_instance_id: reversedWorkflowInstanceId,
      },
    });
    console.log('✅');

    process.stdout.write('   Approving with reversed approver order... ');
    // Reverse the approver order
    const reversedApprovers = [...approvers.slice(0, 4)].reverse();
    const reversedApproved = await approveWorkflowSteps(
      reversedWorkflowInstanceId,
      reversedApprovers,
      location.id,
      'Reversed Order Leave'
    );

    if (reversedApproved) {
      console.log('✅');
      logResult(
        'Test Reversed Approver Order',
        'PASS',
        `Leave request approved with reversed approver order: ${reversedApprovers.map(a => a.name).join(' → ')}`,
        undefined,
        { approver_order: reversedApprovers.map(a => a.name) }
      );
      addFinding(`Leave request approved with reversed approver order: ${reversedApprovers.map(a => a.name).join(' → ')}`);
    } else {
      console.log('❌');
      logResult(
        'Test Reversed Approver Order',
        'FAIL',
        'Failed to approve with reversed approver order',
        undefined,
        {}
      );
    }

    // Test 8: Test with Mixed Approver Order (Different Pattern)
    console.log('\n📋 TEST 8: Test with Mixed Approver Order');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating test timesheet... ');
    const testTimesheetResult = await createTimesheet({
      userId: testEmployee.id,
      locationId: location.id,
      periodStart: new Date('2025-06-01'),
      periodEnd: new Date('2025-06-30'),
    });
    console.log('✅');

    await prisma.timesheetPeriod.upsert({
      where: {
        id: `period-2025-06-01`,
      },
      update: {
        submission_enabled: true,
      },
      create: {
        id: `period-2025-06-01`,
        period_start: new Date('2025-06-01'),
        period_end: new Date('2025-06-30'),
        submission_enabled: true,
      },
    });

    process.stdout.write('   Submitting timesheet... ');
    const mixedWorkflowInstanceId = await createWorkflowInstance({
      templateId: timesheetWorkflow5Step.id,
      resourceId: testTimesheetResult.id,
      resourceType: 'timesheet',
      createdBy: testEmployee.id,
      locationId: location.id,
    });

    await submitWorkflowInstance(mixedWorkflowInstanceId);

    await prisma.timesheet.update({
      where: { id: testTimesheetResult.id },
      data: {
        status: 'Submitted',
        workflow_instance_id: mixedWorkflowInstanceId,
      },
    });
    console.log('✅');

    process.stdout.write('   Approving with mixed approver order... ');
    // Mixed order: approver 0, 2, 4, 1, 3
    const mixedApprovers = [
      approvers[0],
      approvers[2],
      approvers[4],
      approvers[1],
      approvers[3],
    ];
    const mixedApproved = await approveWorkflowSteps(
      mixedWorkflowInstanceId,
      mixedApprovers,
      location.id,
      'Mixed Order Timesheet'
    );

    if (mixedApproved) {
      console.log('✅');
      logResult(
        'Test Mixed Approver Order',
        'PASS',
        `Timesheet approved with mixed approver order: ${mixedApprovers.map(a => a.name).join(' → ')}`,
        undefined,
        { approver_order: mixedApprovers.map(a => a.name) }
      );
      addFinding(`Timesheet approved with mixed approver order: ${mixedApprovers.map(a => a.name).join(' → ')}`);
    } else {
      console.log('❌');
      logResult(
        'Test Mixed Approver Order',
        'FAIL',
        'Failed to approve with mixed approver order',
        undefined,
        {}
      );
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
      console.log('\n✅ Phase 4 Robust Tests: ALL PASSED');
      console.log('   Multiple approvers and workflow configurations validated successfully!');
    } else {
      console.log('\n❌ Phase 4 Robust Tests: SOME FAILED');
      console.log('   Please review failed tests and issues.');
    }

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error.stack);
    
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
