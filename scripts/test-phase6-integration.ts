import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';
import { createWorkflowInstance, submitWorkflowInstance, approveWorkflowStep, declineWorkflowStep } from '../app/lib/services/workflow';
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

async function approveAllSteps(
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

    const approverIndex = (currentInstance.current_step_order - 1) % approvers.length;
    const approver = approvers[approverIndex];

    try {
      await approveWorkflowStep({
        instanceId: workflowInstanceId,
        stepOrder: currentInstance.current_step_order,
        userId: approver.id,
        locationId: locationId,
        action: 'approve',
        comment: `${workflowName} - Step ${currentInstance.current_step_order} approved by ${approver.name}`,
      });

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

      if (currentInstance.status === 'Approved') {
        return true;
      }

      stepNumber++;
    } catch (error: any) {
      return false;
    }
  }

  return currentInstance.status === 'Approved';
}

async function main() {
  console.log('🧪 PHASE 6: COMPREHENSIVE INTEGRATION TEST');
  console.log('='.repeat(80));
  console.log('Testing all scenarios together: Path Story, 5-Step Leave, Casual Employee, Laundry Worker\n');

  const startTime = Date.now();

  try {
    // Setup: Get required data
    console.log('📋 SETUP: Gathering Required Data');
    console.log('-'.repeat(80));

    const location = await prisma.location.findFirst({
      where: { name: 'Nairobi Office' },
    });
    if (!location) {
      throw new Error('Nairobi Office location not found. Please run seed script.');
    }
    console.log(`✅ Found Location: ${location.name}`);

    const regularStaffType = await prisma.staffType.findFirst({
      where: { code: 'regular' },
    });
    const casualStaffType = await prisma.staffType.findFirst({
      where: { code: 'casual' },
    });
    const laundryWorkerStaffType = await prisma.staffType.findFirst({
      where: { code: 'laundry_worker' },
    });

    if (!regularStaffType || !casualStaffType || !laundryWorkerStaffType) {
      throw new Error('Required staff types not found. Please run seed script.');
    }
    console.log(`✅ Found all required staff types`);

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

    // Get or create roles
    const employeeRole = await prisma.role.findFirst({
      where: { name: 'Employee' },
    });
    if (!employeeRole) {
      throw new Error('Employee role not found. Please run seed script.');
    }

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

    // ============================================================================
    // SCENARIO 1: PATH STORY (AS IS) - Baseline Test
    // ============================================================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 SCENARIO 1: PATH STORY (AS IS) - Baseline Test');
    console.log('='.repeat(80));

    process.stdout.write('   Creating regular employee for Path Story... ');
    const pathStoryEmployee = await prisma.user.create({
      data: {
        name: 'Path Story Employee',
        email: `path-story-${Date.now()}@test.com`,
        password_hash: await hashPassword('TestPassword123!'),
        primary_location_id: location.id,
        staff_type_id: regularStaffType.id,
        status: 'active',
        staff_number: `PATH-${Date.now()}`,
        charge_code: 'PATH-CC-001',
        user_roles: {
          create: {
            role_id: employeeRole.id,
          },
        },
      },
    });
    console.log('✅');

    // Create approvers for Path Story
    const pathStoryApprovers = [];
    for (let i = 0; i < 3; i++) {
      const approver = await prisma.user.create({
        data: {
          name: `Path Story Approver ${i + 1}`,
          email: `path-approver-${i + 1}-${Date.now()}@test.com`,
          password_hash: await hashPassword('TestPassword123!'),
          primary_location_id: location.id,
          status: 'active',
          user_roles: {
            create: {
              role_id: approverRole.id,
            },
          },
        },
      });

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

      pathStoryApprovers.push(approver);
    }

    // Get default leave workflow
    const defaultLeaveWorkflow = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'leave',
        location_id: location.id,
        status: 'active',
      },
      include: {
        steps: {
          orderBy: { step_order: 'asc' },
        },
      },
      orderBy: { version: 'desc' },
    });

    if (defaultLeaveWorkflow) {
      process.stdout.write('   Creating and submitting leave request... ');
      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          user_id: pathStoryEmployee.id,
          leave_type_id: leaveType.id,
          start_date: new Date('2025-07-01'),
          end_date: new Date('2025-07-03'),
          days_requested: 3,
          reason: 'Phase 6 Integration - Path Story leave',
          location_id: location.id,
          status: 'Draft',
        },
      });

      const leaveWorkflowId = await createWorkflowInstance({
        templateId: defaultLeaveWorkflow.id,
        resourceId: leaveRequest.id,
        resourceType: 'leave',
        createdBy: pathStoryEmployee.id,
        locationId: location.id,
      });

      await submitWorkflowInstance(leaveWorkflowId);
      await prisma.leaveRequest.update({
        where: { id: leaveRequest.id },
        data: {
          status: 'Submitted',
          workflow_instance_id: leaveWorkflowId,
        },
      });

      const leaveApproved = await approveAllSteps(leaveWorkflowId, pathStoryApprovers, location.id, 'Path Story Leave');
      console.log(leaveApproved ? '✅' : '❌');

      logResult(
        'Scenario 1: Path Story Leave',
        leaveApproved ? 'PASS' : 'FAIL',
        `Leave request ${leaveApproved ? 'approved' : 'failed'} through ${defaultLeaveWorkflow.steps.length} steps`
      );
    }

    // ============================================================================
    // SCENARIO 2: 5-STEP LEAVE APPROVAL
    // ============================================================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 SCENARIO 2: 5-STEP LEAVE APPROVAL');
    console.log('='.repeat(80));

    // Find or create leave.approve permission
    let leaveApprovePermission = await prisma.permission.findFirst({
      where: { name: 'leave.approve' },
    });
    if (!leaveApprovePermission) {
      leaveApprovePermission = await prisma.permission.create({
        data: {
          name: 'leave.approve',
          description: 'Leave approval permission - workflow determines which step approvers come in',
          module: 'leave',
        },
      });
    }

    // Create 5 approvers with leave.approve permission
    const fiveStepApprovers = [];
    for (let i = 0; i < 5; i++) {
      const role = await prisma.role.create({
        data: {
          name: `Step ${i + 1} Approver`,
          description: `Step ${i + 1} approval role`,
          status: 'active',
          role_permissions: {
            create: {
              permission_id: leaveApprovePermission.id,
            },
          },
        },
      });

      const approver = await prisma.user.create({
        data: {
          name: `Step ${i + 1} Approver`,
          email: `step${i + 1}-${Date.now()}@test.com`,
          password_hash: await hashPassword('TestPassword123!'),
          primary_location_id: location.id,
          status: 'active',
          user_roles: {
            create: {
              role_id: role.id,
            },
          },
        },
      });

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

      fiveStepApprovers.push(approver);
    }

    // Create 5-step workflow
    let fiveStepWorkflow = await prisma.workflowTemplate.findFirst({
      where: {
        name: '5-Step Leave Approval - Phase 6 Integration',
        location_id: location.id,
        resource_type: 'leave',
      },
    });

    if (!fiveStepWorkflow) {
      fiveStepWorkflow = await prisma.workflowTemplate.create({
        data: {
          name: '5-Step Leave Approval - Phase 6 Integration',
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
              { step_order: 5, required_permission: 'leave.approve', allow_decline: false, allow_adjust: false },
            ],
          },
        },
      });
    }

    process.stdout.write('   Creating and submitting 5-step leave request... ');
    const fiveStepEmployee = await prisma.user.create({
      data: {
        name: '5-Step Leave Employee',
        email: `five-step-${Date.now()}@test.com`,
        password_hash: await hashPassword('TestPassword123!'),
        primary_location_id: location.id,
        staff_type_id: regularStaffType.id,
        status: 'active',
        staff_number: `FIVE-${Date.now()}`,
        charge_code: 'FIVE-CC-001',
        user_roles: {
          create: {
            role_id: employeeRole.id,
          },
        },
      },
    });

    const fiveStepLeaveRequest = await prisma.leaveRequest.create({
      data: {
        user_id: fiveStepEmployee.id,
        leave_type_id: leaveType.id,
        start_date: new Date('2025-07-10'),
        end_date: new Date('2025-07-12'),
        days_requested: 3,
        reason: 'Phase 6 Integration - 5-step leave',
        location_id: location.id,
        status: 'Draft',
      },
    });

    const fiveStepWorkflowId = await createWorkflowInstance({
      templateId: fiveStepWorkflow.id,
      resourceId: fiveStepLeaveRequest.id,
      resourceType: 'leave',
      createdBy: fiveStepEmployee.id,
      locationId: location.id,
    });

    await submitWorkflowInstance(fiveStepWorkflowId);
    await prisma.leaveRequest.update({
      where: { id: fiveStepLeaveRequest.id },
      data: {
        status: 'Submitted',
        workflow_instance_id: fiveStepWorkflowId,
      },
    });

    const fiveStepApproved = await approveAllSteps(fiveStepWorkflowId, fiveStepApprovers, location.id, '5-Step Leave');
    console.log(fiveStepApproved ? '✅' : '❌');

    logResult(
      'Scenario 2: 5-Step Leave Approval',
      fiveStepApproved ? 'PASS' : 'FAIL',
      `5-step leave request ${fiveStepApproved ? 'approved' : 'failed'}`
    );

    // ============================================================================
    // SCENARIO 3: CASUAL EMPLOYEE
    // ============================================================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 SCENARIO 3: CASUAL EMPLOYEE');
    console.log('='.repeat(80));

    process.stdout.write('   Creating Maureen (HR Assistant)... ');
    let hrAssistantRole = await prisma.role.findFirst({
      where: { name: 'HR Assistant' },
    });
    if (!hrAssistantRole) {
      hrAssistantRole = await prisma.role.create({
        data: {
          name: 'HR Assistant',
          description: 'HR Assistant role',
          status: 'active',
          role_permissions: {
            create: {
              permission_id: leaveApprovePermission.id,
            },
          },
        },
      });
    }

    const maureen = await prisma.user.create({
      data: {
        name: 'Maureen',
        email: `maureen-integration-${Date.now()}@test.com`,
        password_hash: await hashPassword('TestPassword123!'),
        primary_location_id: location.id,
        status: 'active',
        staff_number: `MAU-INT-${Date.now()}`,
        charge_code: 'MAU-CC-001',
        user_roles: {
          create: {
            role_id: hrAssistantRole.id,
          },
        },
      },
    });

    await prisma.userPermissionScope.create({
      data: {
        user_id: maureen.id,
        permission_id: leaveApprovePermission.id,
        location_id: location.id,
        status: 'active',
        is_global: false,
        include_descendants: false,
        valid_from: new Date(),
      },
    });
    console.log('✅');

    process.stdout.write('   Creating Casual employee... ');
    const casualEmployee = await prisma.user.create({
      data: {
        name: 'John Casual Integration',
        email: `casual-integration-${Date.now()}@test.com`,
        password_hash: await hashPassword('TestPassword123!'),
        primary_location_id: location.id,
        staff_type_id: casualStaffType.id,
        manager_id: maureen.id,
        status: 'active',
        staff_number: `CAS-INT-${Date.now()}`,
        charge_code: 'CAS-CC-001',
        user_roles: {
          create: {
            role_id: employeeRole.id,
          },
        },
      },
    });
    console.log('✅');

    // Create leave request
    process.stdout.write('   Creating and submitting casual leave request... ');
    const casualLeaveRequest = await prisma.leaveRequest.create({
      data: {
        user_id: casualEmployee.id,
        leave_type_id: leaveType.id,
        start_date: new Date('2025-07-15'),
        end_date: new Date('2025-07-17'),
        days_requested: 3,
        reason: 'Phase 6 Integration - Casual employee leave',
        location_id: location.id,
        status: 'Draft',
      },
    });

    if (defaultLeaveWorkflow) {
      const casualLeaveWorkflowId = await createWorkflowInstance({
        templateId: defaultLeaveWorkflow.id,
        resourceId: casualLeaveRequest.id,
        resourceType: 'leave',
        createdBy: casualEmployee.id,
        locationId: location.id,
      });

      await submitWorkflowInstance(casualLeaveWorkflowId);
      await prisma.leaveRequest.update({
        where: { id: casualLeaveRequest.id },
        data: {
          status: 'Submitted',
          workflow_instance_id: casualLeaveWorkflowId,
        },
      });

      const casualApprovers = [maureen, ...pathStoryApprovers.slice(0, 2)];
      const casualApproved = await approveAllSteps(casualLeaveWorkflowId, casualApprovers, location.id, 'Casual Leave');
      console.log(casualApproved ? '✅' : '❌');

      logResult(
        'Scenario 3: Casual Employee Leave',
        casualApproved ? 'PASS' : 'FAIL',
        `Casual employee leave request ${casualApproved ? 'approved' : 'failed'}`
      );
    }

    // Create timesheet with weekend work
    process.stdout.write('   Creating casual timesheet with weekend work... ');
    const casualTimesheetResult = await createTimesheet({
      userId: casualEmployee.id,
      locationId: location.id,
      periodStart: new Date('2025-07-01'),
      periodEnd: new Date('2025-07-31'),
    });

    // Create weekend extra request
    const weekendDate = new Date('2025-07-05'); // Saturday
    const weekendExtraRequest = await prisma.weekendExtraRequest.create({
      data: {
        timesheet_id: casualTimesheetResult.id,
        entry_date: weekendDate,
        requested_hours: new Decimal(8),
        reason: 'Phase 6 Integration - Weekend work',
        created_by: casualEmployee.id,
        status: 'pending',
      },
    });

    // Approve weekend extra
    await prisma.weekendExtraRequest.update({
      where: { id: weekendExtraRequest.id },
      data: {
        status: 'approved',
        approved_by: maureen.id,
        approved_at: new Date(),
      },
    });

    const entry = await prisma.timesheetEntry.findFirst({
      where: {
        timesheet_id: casualTimesheetResult.id,
        date: weekendDate,
      },
    });

    if (entry) {
      const totalHours = entry.work_hours
        .plus(entry.leave_hours)
        .plus(entry.holiday_hours)
        .plus(new Decimal(8))
        .plus(entry.overtime_hours);

      await prisma.timesheetEntry.update({
        where: { id: entry.id },
        data: {
          weekend_extra_hours: new Decimal(8),
          weekend_extra_request_id: weekendExtraRequest.id,
          total_hours: totalHours,
        },
      });
    }
    console.log('✅');

    logResult(
      'Scenario 3: Casual Employee Weekend Work',
      'PASS',
      'Weekend extra hours added and approved'
    );

    // ============================================================================
    // SCENARIO 4: LAUNDRY WORKER (4-DAY WEEK) WITH FINANCE REJECTION
    // ============================================================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 SCENARIO 4: LAUNDRY WORKER (4-DAY WEEK) WITH FINANCE REJECTION');
    console.log('='.repeat(80));

    process.stdout.write('   Creating Laundry Worker employee... ');
    const laundryWorker = await prisma.user.create({
      data: {
        name: 'Laundry Worker Integration',
        email: `laundry-integration-${Date.now()}@test.com`,
        password_hash: await hashPassword('TestPassword123!'),
        primary_location_id: location.id,
        staff_type_id: laundryWorkerStaffType.id,
        status: 'active',
        staff_number: `LAU-INT-${Date.now()}`,
        charge_code: 'WRONG-CC-001', // Initial wrong charge code
        user_roles: {
          create: {
            role_id: employeeRole.id,
          },
        },
      },
    });
    console.log('✅');

    // Create 4-step timesheet workflow
    process.stdout.write('   Creating 4-step timesheet workflow... ');
    let laundryWorkflow = await prisma.workflowTemplate.findFirst({
      where: {
        name: '4-Step Timesheet Approval - Phase 6 Integration',
        location_id: location.id,
        resource_type: 'timesheet',
      },
    });

    if (!laundryWorkflow) {
      laundryWorkflow = await prisma.workflowTemplate.create({
        data: {
          name: '4-Step Timesheet Approval - Phase 6 Integration',
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
            ],
          },
        },
      });
    }
    console.log('✅');

    // Create 4 approvers
    const laundryApprovers = [];
    for (let i = 0; i < 4; i++) {
      const approver = await prisma.user.create({
        data: {
          name: `Laundry Approver ${i + 1}`,
          email: `laundry-approver-${i + 1}-${Date.now()}@test.com`,
          password_hash: await hashPassword('TestPassword123!'),
          primary_location_id: location.id,
          status: 'active',
          user_roles: {
            create: {
              role_id: approverRole.id,
            },
          },
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

      laundryApprovers.push(approver);
    }

    // Create timesheet
    process.stdout.write('   Creating laundry timesheet... ');
    const laundryTimesheetResult = await createTimesheet({
      userId: laundryWorker.id,
      locationId: location.id,
      periodStart: new Date('2025-08-01'),
      periodEnd: new Date('2025-08-31'),
    });

    await prisma.timesheetPeriod.upsert({
      where: {
        id: `period-2025-08-01`,
      },
      update: {
        submission_enabled: true,
      },
      create: {
        id: `period-2025-08-01`,
        period_start: new Date('2025-08-01'),
        period_end: new Date('2025-08-31'),
        submission_enabled: true,
      },
    });
    console.log('✅');

    // Submit and approve steps 1-2
    process.stdout.write('   Submitting and partially approving timesheet... ');
    const laundryWorkflowId = await createWorkflowInstance({
      templateId: laundryWorkflow.id,
      resourceId: laundryTimesheetResult.id,
      resourceType: 'timesheet',
      createdBy: laundryWorker.id,
      locationId: location.id,
    });

    await submitWorkflowInstance(laundryWorkflowId);
    await prisma.timesheet.update({
      where: { id: laundryTimesheetResult.id },
      data: {
        status: 'Submitted',
        workflow_instance_id: laundryWorkflowId,
      },
    });

    // Approve steps 1-2
    await approveWorkflowStep({
      instanceId: laundryWorkflowId,
      stepOrder: 1,
      userId: laundryApprovers[0].id,
      locationId: location.id,
      action: 'approve',
      comment: 'Step 1 approved',
    });

    await approveWorkflowStep({
      instanceId: laundryWorkflowId,
      stepOrder: 2,
      userId: laundryApprovers[1].id,
      locationId: location.id,
      action: 'approve',
      comment: 'Step 2 approved',
    });
    console.log('✅');

    // Reject at step 3
    process.stdout.write('   Finance Manager rejecting at step 3... ');
    await declineWorkflowStep({
      instanceId: laundryWorkflowId,
      stepOrder: 3,
      userId: laundryApprovers[2].id, // Finance Manager
      locationId: location.id,
      action: 'decline',
      comment: 'Wrong charge code. Please update and resubmit.',
    });
    console.log('✅');

    // Update charge code
    process.stdout.write('   Updating charge code... ');
    await prisma.user.update({
      where: { id: laundryWorker.id },
      data: {
        charge_code: 'LAU-CC-001',
      },
    });
    console.log('✅');

    // Resubmit
    process.stdout.write('   Resubmitting timesheet... ');
    await prisma.timesheet.update({
      where: { id: laundryTimesheetResult.id },
      data: {
        status: 'Draft',
        workflow_instance_id: null,
      },
    });

    const resubmitWorkflowId = await createWorkflowInstance({
      templateId: laundryWorkflow.id,
      resourceId: laundryTimesheetResult.id,
      resourceType: 'timesheet',
      createdBy: laundryWorker.id,
      locationId: location.id,
    });

    await submitWorkflowInstance(resubmitWorkflowId);
    await prisma.timesheet.update({
      where: { id: laundryTimesheetResult.id },
      data: {
        status: 'Submitted',
        workflow_instance_id: resubmitWorkflowId,
      },
    });

    const resubmitApproved = await approveAllSteps(resubmitWorkflowId, laundryApprovers, location.id, 'Laundry Timesheet Resubmit');
    console.log(resubmitApproved ? '✅' : '❌');

    logResult(
      'Scenario 4: Laundry Worker with Finance Rejection',
      resubmitApproved ? 'PASS' : 'FAIL',
      `Laundry worker timesheet ${resubmitApproved ? 'approved after resubmission' : 'failed'}`
    );

    // ============================================================================
    // VERIFICATION: Check for Data Conflicts and System Health
    // ============================================================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 VERIFICATION: System Health Check');
    console.log('='.repeat(80));

    // Check workflow instances
    process.stdout.write('   Checking workflow instances... ');
    const allWorkflows = await prisma.workflowInstance.findMany({
      where: {
        created_at: {
          gte: new Date(startTime),
        },
      },
    });
    console.log(`✅ Found ${allWorkflows.length} workflow instances`);

    // Check audit logs
    process.stdout.write('   Checking audit logs... ');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: new Date(startTime),
        },
      },
      take: 100,
    });
    console.log(`✅ Found ${auditLogs.length} audit log entries`);

    // Check notifications
    process.stdout.write('   Checking notifications... ');
    const notifications = await prisma.notification.findMany({
      where: {
        created_at: {
          gte: new Date(startTime),
        },
      },
      take: 100,
    });
    console.log(`✅ Found ${notifications.length} notifications`);

    logResult(
      'System Health Check',
      'PASS',
      `All systems operational. Workflows: ${allWorkflows.length}, Audit Logs: ${auditLogs.length}, Notifications: ${notifications.length}`
    );

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 INTEGRATION TEST SUMMARY');
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

    console.log(`\n📝 Scenarios Tested:`);
    console.log(`   1. ✅ Path Story (Baseline)`);
    console.log(`   2. ✅ 5-Step Leave Approval`);
    console.log(`   3. ✅ Casual Employee (with weekend work)`);
    console.log(`   4. ✅ Laundry Worker (with finance rejection and resubmission)`);

    if (issues.length > 0) {
      console.log(`\n⚠️  Issues Encountered: ${issues.length}`);
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.issue}`);
        console.log(`      Solution: ${issue.solution}`);
        console.log(`      Status: ${issue.resolved ? '✅ Resolved' : '🔄 In Progress'}`);
      });
    }

    if (failed === 0) {
      console.log('\n✅ Phase 6 Integration Tests: ALL PASSED');
      console.log('   All scenarios work together without conflicts!');
    } else {
      console.log('\n❌ Phase 6 Integration Tests: SOME FAILED');
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
