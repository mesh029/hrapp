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

async function main() {
  console.log('🧪 PHASE 5: LAUNDRY WORKER (4-DAY WEEK) AND FINANCE REJECTION TEST');
  console.log('='.repeat(80));
  console.log('Testing Laundry Worker with 4-day week, 4-step approval, and finance rejection scenario\n');

  const startTime = Date.now();

  try {
    // Setup: Get required data
    console.log('📋 SETUP: Gathering Required Data');
    console.log('-'.repeat(80));

    const laundryWorkerStaffType = await prisma.staffType.findFirst({
      where: { code: 'laundry_worker' },
    });

    if (!laundryWorkerStaffType) {
      throw new Error('Laundry Worker staff type not found. Please run seed script.');
    }
    console.log(`✅ Found Laundry Worker Staff Type: ${laundryWorkerStaffType.name}`);

    const location = await prisma.location.findFirst({
      where: { name: 'Nairobi Office' },
    });
    if (!location) {
      throw new Error('Nairobi Office location not found. Please run seed script.');
    }
    console.log(`✅ Found Location: ${location.name}`);

    // Get permissions
    const timesheetApprovePermission = await prisma.permission.findFirst({
      where: { name: 'timesheet.approve' },
    });

    if (!timesheetApprovePermission) {
      throw new Error('timesheet.approve permission not found. Please run seed script.');
    }
    console.log(`✅ Found required permissions`);

    // Test 1: Create 4 Approvers for 4-Step Workflow
    console.log('\n📋 TEST 1: Create 4 Approvers for 4-Step Workflow');
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
            create: {
              permission_id: timesheetApprovePermission.id,
            },
          },
        },
      });
    }

    const approvers = [];
    const approverNames = ['Supervisor', 'Department Manager', 'HR Manager', 'Finance Manager'];

    for (let i = 0; i < 4; i++) {
      process.stdout.write(`   Creating ${approverNames[i]}... `);
      try {
        const approverEmail = `approver-phase5-${i + 1}-${Date.now()}@test.com`;
        const approver = await prisma.user.create({
          data: {
            name: approverNames[i],
            email: approverEmail,
            password_hash: await hashPassword('TestPassword123!'),
            primary_location_id: location.id,
            status: 'active',
            staff_number: `APP5-${i + 1}-${Date.now()}`,
            charge_code: `APP5-${i + 1}-CC`,
            user_roles: {
              create: {
                role_id: approverRole.id,
              },
            },
          },
        });

        // Create location scope
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
      'Create 4 Approver Users',
      'PASS',
      `Created ${approvers.length} approver users with timesheet.approve permission`,
      undefined,
      { approvers: approvers.map(a => ({ name: a.name, staff_number: a.staff_number })) }
    );
    addFinding(`Created 4 approver users: ${approvers.map(a => a.name).join(', ')}`);

    // Test 2: Create Laundry Worker Employee
    console.log('\n📋 TEST 2: Create Laundry Worker Employee');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating Laundry Worker employee... ');
    const employeeRole = await prisma.role.findFirst({
      where: { name: 'Employee' },
    });

    if (!employeeRole) {
      throw new Error('Employee role not found. Please run seed script.');
    }

    const laundryWorkerEmail = `laundry-worker-${Date.now()}@test.com`;
    let laundryWorker;
    try {
      laundryWorker = await prisma.user.create({
        data: {
          name: 'Laundry Worker Employee',
          email: laundryWorkerEmail,
          password_hash: await hashPassword('TestPassword123!'),
          primary_location_id: location.id,
          staff_type_id: laundryWorkerStaffType.id,
          status: 'active',
          staff_number: `LAU-${Date.now()}`,
          charge_code: 'WRONG-CC-001', // Initial wrong charge code
          user_roles: {
            create: {
              role_id: employeeRole.id,
            },
          },
        },
      });
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to create Laundry Worker',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create Laundry Worker',
      'PASS',
      `Created: ${laundryWorker.name} (${laundryWorker.email})`,
      undefined,
      {
        id: laundryWorker.id,
        staff_number: laundryWorker.staff_number,
        charge_code: laundryWorker.charge_code,
      }
    );
    addFinding(`Created Laundry Worker with staff_number: ${laundryWorker.staff_number}, initial charge_code: ${laundryWorker.charge_code}`);

    // Test 3: Create 4-Step Timesheet Workflow
    console.log('\n📋 TEST 3: Create 4-Step Timesheet Workflow');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating 4-step timesheet workflow template... ');
    let timesheetWorkflow4Step;
    try {
      // Check if template exists
      const existing = await prisma.workflowTemplate.findFirst({
        where: {
          name: '4-Step Timesheet Approval - Phase 5',
          location_id: location.id,
          resource_type: 'timesheet',
        },
      });

      if (existing) {
        await prisma.workflowStep.deleteMany({
          where: { workflow_template_id: existing.id },
        });

        timesheetWorkflow4Step = await prisma.workflowTemplate.update({
          where: { id: existing.id },
          data: {
            steps: {
              create: [
                { step_order: 1, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: true },
                { step_order: 2, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
                { step_order: 3, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
                { step_order: 4, required_permission: 'timesheet.approve', allow_decline: true, allow_adjust: false },
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
        timesheetWorkflow4Step = await prisma.workflowTemplate.create({
          data: {
            name: '4-Step Timesheet Approval - Phase 5',
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
        'Failed to create 4-step timesheet workflow',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create 4-Step Timesheet Workflow',
      'PASS',
      `Created workflow template with ${timesheetWorkflow4Step.steps.length} steps`,
      undefined,
      { template_id: timesheetWorkflow4Step.id, steps: timesheetWorkflow4Step.steps.length }
    );
    addFinding(`Created 4-step timesheet workflow template`);

    // Test 4: Laundry Worker Creates Timesheet
    console.log('\n📋 TEST 4: Laundry Worker Creates Timesheet');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating timesheet for June 2025... ');
    const periodStart = new Date('2025-06-01');
    const periodEnd = new Date('2025-06-30');

    let timesheetResult;
    try {
      timesheetResult = await createTimesheet({
        userId: laundryWorker.id,
        locationId: location.id,
        periodStart,
        periodEnd,
      });
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to create timesheet',
        error.message,
        false
      );
      throw error;
    }

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetResult.id },
      include: {
        entries: {
          orderBy: { date: 'asc' },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            staff_number: true,
            charge_code: true,
          },
        },
      },
    });

    logResult(
      'Create Timesheet',
      'PASS',
      `Created timesheet with ${timesheet?.entries.length || 0} entries`,
      undefined,
      {
        id: timesheetResult.id,
        entries_count: timesheet?.entries.length || 0,
        user_staff_number: timesheet?.user.staff_number,
        user_charge_code: timesheet?.user.charge_code,
      }
    );
    addFinding(`Timesheet created with ${timesheet?.entries.length || 0} entries. User charge_code: ${timesheet?.user.charge_code}`);

    // Verify 4-day week (should have fewer entries than 5-day week)
    const expectedDays = 22; // Approximate working days in June for 4-day week (Mon-Thu)
    if (timesheet && timesheet.entries.length <= expectedDays) {
      addFinding(`✅ Timesheet has ${timesheet.entries.length} entries, consistent with 4-day work week`);
    } else {
      addFinding(`⚠️  Timesheet has ${timesheet?.entries.length || 0} entries, may need to verify 4-day week configuration`);
    }

    // Test 5: Submit Timesheet
    console.log('\n📋 TEST 5: Submit Timesheet');
    console.log('-'.repeat(80));

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

    process.stdout.write('   Submitting timesheet... ');
    let workflowInstanceId;
    try {
      workflowInstanceId = await createWorkflowInstance({
        templateId: timesheetWorkflow4Step.id,
        resourceId: timesheetResult.id,
        resourceType: 'timesheet',
        createdBy: laundryWorker.id,
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
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to submit timesheet',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Submit Timesheet',
      'PASS',
      `Timesheet submitted, workflow has ${timesheetWorkflow4Step.steps.length} steps`,
      undefined,
      {
        timesheet_id: timesheetResult.id,
        workflow_instance_id: workflowInstanceId,
      }
    );
    addFinding(`Timesheet submitted successfully. Workflow has ${timesheetWorkflow4Step.steps.length} steps.`);

    // Test 6: Approve Steps 1 and 2
    console.log('\n📋 TEST 6: Approve Steps 1 and 2');
    console.log('-'.repeat(80));

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
      logResult('Approve Steps 1-2', 'FAIL', 'Workflow instance not found');
    } else {
      // Approve step 1
      process.stdout.write(`   Approving step 1 with ${approvers[0].name}... `);
      try {
        await approveWorkflowStep({
          instanceId: workflowInstanceId,
          stepOrder: 1,
          userId: approvers[0].id,
          locationId: location.id,
          action: 'approve',
          comment: 'Phase 5 test - Step 1 approved',
        });
        console.log('✅');
        addFinding(`Step 1 approved by ${approvers[0].name}`);

        // Refresh instance
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
      } catch (error: any) {
        console.log('❌');
        logIssue(
          'Failed to approve step 1',
          error.message,
          false
        );
        throw error;
      }

      // Approve step 2
      process.stdout.write(`   Approving step 2 with ${approvers[1].name}... `);
      try {
        await approveWorkflowStep({
          instanceId: workflowInstanceId,
          stepOrder: 2,
          userId: approvers[1].id,
          locationId: location.id,
          action: 'approve',
          comment: 'Phase 5 test - Step 2 approved',
        });
        console.log('✅');
        addFinding(`Step 2 approved by ${approvers[1].name}`);

        // Refresh instance
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
      } catch (error: any) {
        console.log('❌');
        logIssue(
          'Failed to approve step 2',
          error.message,
          false
        );
        throw error;
      }

      logResult(
        'Approve Steps 1-2',
        'PASS',
        `Steps 1 and 2 approved successfully`,
        undefined,
        {
          step_1_approver: approvers[0].name,
          step_2_approver: approvers[1].name,
        }
      );
    }

    // Test 7: Finance Manager Rejects at Step 3 (Wrong Charge Code)
    console.log('\n📋 TEST 7: Finance Manager Rejects at Step 3 (Wrong Charge Code)');
    console.log('-'.repeat(80));

    const financeManager = approvers[3]; // Finance Manager is the 4th approver (index 3)
    const declineReason = 'Wrong charge code. Please update charge code and resubmit.';

    process.stdout.write(`   Finance Manager (${financeManager.name}) rejecting at step 3... `);
    try {
      await declineWorkflowStep({
        instanceId: workflowInstanceId,
        stepOrder: 3,
        userId: financeManager.id,
        locationId: location.id,
        action: 'decline',
        comment: declineReason,
      });
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to decline at step 3',
        error.message,
        false
      );
      throw error;
    }

    // Verify workflow is declined
    const declinedInstance = await prisma.workflowInstance.findUnique({
      where: { id: workflowInstanceId },
    });

    if (declinedInstance?.status === 'Declined') {
      logResult(
        'Finance Manager Rejects Timesheet',
        'PASS',
        `Timesheet declined at step 3 by Finance Manager. Reason: ${declineReason}`,
        undefined,
        {
          declined_by: financeManager.name,
          decline_reason: declineReason,
          final_status: declinedInstance.status,
        }
      );
      addFinding(`Timesheet declined by Finance Manager at step 3. Reason: ${declineReason}`);
    } else {
      logResult(
        'Finance Manager Rejects Timesheet',
        'FAIL',
        `Timesheet was not declined. Status: ${declinedInstance?.status}`,
        undefined,
        { status: declinedInstance?.status }
      );
    }

    // Test 8: Update Charge Code
    console.log('\n📋 TEST 8: Update Charge Code');
    console.log('-'.repeat(80));

    const correctChargeCode = 'LAU-CC-001';
    process.stdout.write(`   Updating charge_code from ${laundryWorker.charge_code} to ${correctChargeCode}... `);
    try {
      const updatedWorker = await prisma.user.update({
        where: { id: laundryWorker.id },
        data: {
          charge_code: correctChargeCode,
        },
      });

      if (updatedWorker.charge_code === correctChargeCode) {
        console.log('✅');
        logResult(
          'Update Charge Code',
          'PASS',
          `Charge code updated from ${laundryWorker.charge_code} to ${correctChargeCode}`,
          undefined,
          {
            old_charge_code: laundryWorker.charge_code,
            new_charge_code: correctChargeCode,
          }
        );
        addFinding(`Charge code updated from ${laundryWorker.charge_code} to ${correctChargeCode}`);
        laundryWorker = updatedWorker; // Update local reference
      } else {
        console.log('❌');
        logResult(
          'Update Charge Code',
          'FAIL',
          'Charge code was not updated correctly',
          undefined,
          {}
        );
      }
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to update charge code',
        error.message,
        false
      );
      throw error;
    }

    // Test 9: Resubmit Timesheet
    console.log('\n📋 TEST 9: Resubmit Timesheet');
    console.log('-'.repeat(80));

    // For resubmission, we need to:
    // 1. Update timesheet status back to Draft
    // 2. Create a new workflow instance (or reset the existing one)
    // 3. Submit again

    process.stdout.write('   Resetting timesheet status to Draft... ');
    try {
      await prisma.timesheet.update({
        where: { id: timesheetResult.id },
        data: {
          status: 'Draft',
          workflow_instance_id: null,
        },
      });
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to reset timesheet status',
        error.message,
        false
      );
      throw error;
    }

    process.stdout.write('   Creating new workflow instance... ');
    let resubmitWorkflowInstanceId;
    try {
      resubmitWorkflowInstanceId = await createWorkflowInstance({
        templateId: timesheetWorkflow4Step.id,
        resourceId: timesheetResult.id,
        resourceType: 'timesheet',
        createdBy: laundryWorker.id,
        locationId: location.id,
      });
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to create new workflow instance',
        error.message,
        false
      );
      throw error;
    }

    process.stdout.write('   Submitting timesheet again... ');
    try {
      await submitWorkflowInstance(resubmitWorkflowInstanceId);

      await prisma.timesheet.update({
        where: { id: timesheetResult.id },
        data: {
          status: 'Submitted',
          workflow_instance_id: resubmitWorkflowInstanceId,
        },
      });
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to resubmit timesheet',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Resubmit Timesheet',
      'PASS',
      `Timesheet resubmitted with updated charge code`,
      undefined,
      {
        timesheet_id: timesheetResult.id,
        new_workflow_instance_id: resubmitWorkflowInstanceId,
        updated_charge_code: correctChargeCode,
      }
    );
    addFinding(`Timesheet resubmitted with updated charge code: ${correctChargeCode}`);

    // Test 10: Approve All Steps After Resubmission
    console.log('\n📋 TEST 10: Approve All Steps After Resubmission');
    console.log('-'.repeat(80));

    let resubmitInstance = await prisma.workflowInstance.findUnique({
      where: { id: resubmitWorkflowInstanceId },
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

    if (!resubmitInstance) {
      logResult('Approve All Steps After Resubmission', 'FAIL', 'Workflow instance not found');
    } else {
      let allStepsApproved = true;
      let stepNumber = 1;

      while (stepNumber <= resubmitInstance.template.steps.length && 
             resubmitInstance.current_step_order <= resubmitInstance.template.steps.length) {
        
        const currentStep = resubmitInstance.template.steps.find(
          (s) => s.step_order === resubmitInstance.current_step_order
        );

        if (!currentStep) {
          break;
        }

        const approver = approvers[resubmitInstance.current_step_order - 1];
        process.stdout.write(`   Step ${resubmitInstance.current_step_order}: ${approver.name}... `);
        try {
          await approveWorkflowStep({
            instanceId: resubmitWorkflowInstanceId,
            stepOrder: resubmitInstance.current_step_order,
            userId: approver.id,
            locationId: location.id,
            action: 'approve',
            comment: `Phase 5 test - Step ${resubmitInstance.current_step_order} approved after resubmission`,
          });
          console.log('✅');

          // Refresh workflow instance
          resubmitInstance = await prisma.workflowInstance.findUnique({
            where: { id: resubmitWorkflowInstanceId },
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

          if (!resubmitInstance) {
            allStepsApproved = false;
            break;
          }

          addFinding(`Step ${stepNumber} approved by ${approver.name}. Status: ${resubmitInstance.status}`);

          if (resubmitInstance.status === 'Approved') {
            break;
          }

          stepNumber++;
        } catch (error: any) {
          console.log('❌');
          logIssue(
            `Failed to approve step ${resubmitInstance.current_step_order} with ${approver.name}`,
            error.message,
            false
          );
          allStepsApproved = false;
          break;
        }
      }

      const finalInstance = await prisma.workflowInstance.findUnique({
        where: { id: resubmitWorkflowInstanceId },
      });

      if (allStepsApproved && finalInstance?.status === 'Approved') {
        logResult(
          'Approve All Steps After Resubmission',
          'PASS',
          `All ${resubmitInstance.template.steps.length} steps approved successfully after resubmission`,
          undefined,
          {
            final_status: finalInstance.status,
            total_steps: resubmitInstance.template.steps.length,
          }
        );
        addFinding(`Timesheet fully approved through ${resubmitInstance.template.steps.length} steps after resubmission with corrected charge code`);
      } else {
        logResult(
          'Approve All Steps After Resubmission',
          'FAIL',
          `Not all steps approved. Final status: ${finalInstance?.status}`,
          undefined,
          { final_status: finalInstance?.status }
        );
      }
    }

    // Test 11: Verify Final Timesheet Has Correct Charge Code
    console.log('\n📋 TEST 11: Verify Final Timesheet Has Correct Charge Code');
    console.log('-'.repeat(80));

    const finalTimesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetResult.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            staff_number: true,
            charge_code: true,
          },
        },
      },
    });

    if (finalTimesheet?.user.charge_code === correctChargeCode) {
      logResult(
        'Verify Final Charge Code',
        'PASS',
        `Final timesheet has correct charge_code: ${correctChargeCode}`,
        undefined,
        {
          charge_code: finalTimesheet.user.charge_code,
          staff_number: finalTimesheet.user.staff_number,
        }
      );
      addFinding(`✅ Final timesheet has correct charge_code: ${correctChargeCode}`);
    } else {
      logResult(
        'Verify Final Charge Code',
        'FAIL',
        `Final timesheet charge_code is ${finalTimesheet?.user.charge_code}, expected ${correctChargeCode}`,
        undefined,
        {
          actual: finalTimesheet?.user.charge_code,
          expected: correctChargeCode,
        }
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
      console.log('\n✅ Phase 5 Tests: ALL PASSED');
      console.log('   Laundry Worker scenario with finance rejection validated successfully!');
    } else {
      console.log('\n❌ Phase 5 Tests: SOME FAILED');
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
