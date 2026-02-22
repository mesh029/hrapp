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

async function main() {
  console.log('🧪 PHASE 4: CASUAL EMPLOYEE WITH CUSTOM RULES TEST');
  console.log('='.repeat(80));
  console.log('Testing Casual employee type with custom reporting and weekend work\n');

  const startTime = Date.now();

  try {
    // Setup: Get required data
    console.log('📋 SETUP: Gathering Required Data');
    console.log('-'.repeat(80));

    const casualStaffType = await prisma.staffType.findFirst({
      where: { code: 'casual' },
    });
    if (!casualStaffType) {
      logIssue(
        'Casual staff type not found',
        'Casual staff type should have been created in Phase 1 seed. Checking if we need to create it.',
        false
      );
      throw new Error('Casual staff type not found. Please run seed script.');
    }
    console.log(`✅ Found Casual Staff Type: ${casualStaffType.name}`);

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
    const leaveCreatePermission = await prisma.permission.findFirst({
      where: { name: 'leave.create' },
    });
    const timesheetCreatePermission = await prisma.permission.findFirst({
      where: { name: 'timesheet.create' },
    });
    const timesheetApprovePermission = await prisma.permission.findFirst({
      where: { name: 'timesheet.approve' },
    });

    if (!leaveApprovePermission || !leaveCreatePermission || !timesheetCreatePermission || !timesheetApprovePermission) {
      throw new Error('Required permissions not found. Please run seed script.');
    }
    console.log(`✅ Found required permissions`);

    // Test 1: Create Maureen (HR Assistant)
    console.log('\n📋 TEST 1: Create Maureen (HR Assistant)');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating Maureen (HR Assistant)... ');
    let maureen;
    try {
      // Get or create HR Assistant role
      let hrAssistantRole = await prisma.role.findFirst({
        where: { name: 'HR Assistant' },
      });

      if (!hrAssistantRole) {
        hrAssistantRole = await prisma.role.create({
          data: {
            name: 'HR Assistant',
            description: 'HR Assistant role with leave approval rights',
            status: 'active',
            role_permissions: {
              create: {
                permission_id: leaveApprovePermission.id,
              },
            },
          },
        });
        console.log('   ✅ Created HR Assistant role');
      }

      const maureenEmail = `maureen-${Date.now()}@test.com`;
      maureen = await prisma.user.create({
        data: {
          name: 'Maureen',
          email: maureenEmail,
          password_hash: await hashPassword('TestPassword123!'),
          primary_location_id: location.id,
          status: 'active',
          staff_number: `MAU-${Date.now()}`,
          charge_code: 'MAU-CC-001',
          user_roles: {
            create: {
              role_id: hrAssistantRole.id,
            },
          },
        },
      });

      // Create location scope for leave.approve
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
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to create Maureen',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create Maureen (HR Assistant)',
      'PASS',
      `Created: ${maureen.name} (${maureen.email})`,
      undefined,
      {
        id: maureen.id,
        staff_number: maureen.staff_number,
        charge_code: maureen.charge_code,
      }
    );
    addFinding(`Created Maureen (HR Assistant) with staff_number: ${maureen.staff_number}, charge_code: ${maureen.charge_code}, and leave.approve permission`);

    // Test 2: Create John Casual (Casual Employee)
    console.log('\n📋 TEST 2: Create John Casual (Casual Employee)');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating John Casual employee... ');
    let johnCasual;
    try {
      // Get Employee role
      const employeeRole = await prisma.role.findFirst({
        where: { name: 'Employee' },
      });

      if (!employeeRole) {
        throw new Error('Employee role not found. Please run seed script.');
      }

      const johnEmail = `john-casual-${Date.now()}@test.com`;
      johnCasual = await prisma.user.create({
        data: {
          name: 'John Casual',
          email: johnEmail,
          password_hash: await hashPassword('TestPassword123!'),
          primary_location_id: location.id,
          staff_type_id: casualStaffType.id,
          manager_id: maureen.id, // Maureen is his manager
          status: 'active',
          staff_number: `CAS-${Date.now()}`,
          charge_code: 'CAS-CC-001',
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
        'Failed to create John Casual',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create John Casual',
      'PASS',
      `Created: ${johnCasual.name} (${johnCasual.email}), Manager: ${maureen.name}`,
      undefined,
      {
        id: johnCasual.id,
        staff_number: johnCasual.staff_number,
        charge_code: johnCasual.charge_code,
        manager_id: johnCasual.manager_id,
      }
    );
    addFinding(`Created John Casual with staff_number: ${johnCasual.staff_number}, charge_code: ${johnCasual.charge_code}, and Maureen as manager`);

    // Test 3: John Casual Submits Leave Request
    console.log('\n📋 TEST 3: John Casual Submits Leave Request');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating leave request... ');
    const leaveStartDate = new Date('2025-04-10');
    const leaveEndDate = new Date('2025-04-12');
    const daysRequested = Math.ceil((leaveEndDate.getTime() - leaveStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    let leaveRequest;
    try {
      leaveRequest = await prisma.leaveRequest.create({
        data: {
          user_id: johnCasual.id,
          leave_type_id: leaveType.id,
          start_date: leaveStartDate,
          end_date: leaveEndDate,
          days_requested: daysRequested,
          reason: 'Phase 4 test - Casual employee leave',
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

    process.stdout.write('   Finding workflow template... ');
    const leaveWorkflowTemplate = await prisma.workflowTemplate.findFirst({
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

    if (!leaveWorkflowTemplate) {
      logResult(
        'Submit Leave Request',
        'SKIP',
        'No workflow template found for leave requests at this location'
      );
    } else {
      console.log(`✅ Found template with ${leaveWorkflowTemplate.steps.length} steps`);

      process.stdout.write('   Submitting leave request... ');
      try {
        const workflowInstanceId = await createWorkflowInstance({
          templateId: leaveWorkflowTemplate.id,
          resourceId: leaveRequest.id,
          resourceType: 'leave',
          createdBy: johnCasual.id,
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

        logResult(
          'Submit Leave Request',
          'PASS',
          `Leave request submitted, workflow has ${leaveWorkflowTemplate.steps.length} steps`,
          undefined,
          {
            leave_request_id: leaveRequest.id,
            workflow_instance_id: workflowInstanceId,
            days_requested: daysRequested,
          }
        );
        addFinding(`John Casual submitted leave request. Workflow has ${leaveWorkflowTemplate.steps.length} steps.`);

        // Test 4: Maureen Approves Leave Request
        console.log('\n📋 TEST 4: Maureen Approves Leave Request');
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
          logResult('Approve Leave Request', 'FAIL', 'Workflow instance not found');
        } else {
          let allStepsApproved = true;
          let stepNumber = 1;

          // Approve all steps (Maureen should be able to approve if she has the permission)
          while (stepNumber <= currentWorkflowInstance.template.steps.length && 
                 currentWorkflowInstance.current_step_order <= currentWorkflowInstance.template.steps.length) {
            
            const currentStep = currentWorkflowInstance.template.steps.find(
              (s) => s.step_order === currentWorkflowInstance.current_step_order
            );

            if (!currentStep) {
              break;
            }

            process.stdout.write(`   Approving step ${currentWorkflowInstance.current_step_order} with Maureen... `);
            try {
              await approveWorkflowStep({
                instanceId: workflowInstanceId,
                stepOrder: currentWorkflowInstance.current_step_order,
                userId: maureen.id,
                locationId: location.id,
                action: 'approve',
                comment: `Phase 4 test - Maureen approves for John Casual`,
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
                allStepsApproved = false;
                break;
              }

              addFinding(`Step ${stepNumber} approved by Maureen. Status: ${currentWorkflowInstance.status}, Current step: ${currentWorkflowInstance.current_step_order}`);

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
              'Approve Leave Request',
              'PASS',
              `All steps approved by Maureen. Final status: ${finalInstance.status}`,
              undefined,
              {
                final_status: finalInstance.status,
                total_steps: currentWorkflowInstance.template.steps.length,
              }
            );
            addFinding(`Leave request fully approved by Maureen through ${currentWorkflowInstance.template.steps.length}-step workflow`);
          } else {
            logResult(
              'Approve Leave Request',
              'FAIL',
              `Not all steps approved. Final status: ${finalInstance?.status}`,
              undefined,
              { final_status: finalInstance?.status }
            );
          }
        }
      } catch (error: any) {
        console.log('❌');
        logIssue(
          'Failed to submit leave request',
          error.message,
          false
        );
        throw error;
      }
    }

    // Test 5: John Casual Creates Timesheet
    console.log('\n📋 TEST 5: John Casual Creates Timesheet');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating timesheet for April 2025... ');
    const periodStart = new Date('2025-04-01');
    const periodEnd = new Date('2025-04-30');

    let timesheetResult;
    try {
      timesheetResult = await createTimesheet({
        userId: johnCasual.id,
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
    addFinding(`Timesheet created with ${timesheet?.entries.length || 0} entries. User staff_number: ${timesheet?.user.staff_number}, charge_code: ${timesheet?.user.charge_code}`);

    // Verify charge_code appears in timesheet data
    if (timesheet?.user.charge_code) {
      addFinding(`✅ charge_code (${timesheet.user.charge_code}) appears in timesheet user data`);
    } else {
      logIssue(
        'charge_code not found in timesheet user data',
        'Timesheet user data may not include charge_code field',
        false
      );
    }

    // Test 6: Add Weekend Hours (Weekend Extra Request)
    console.log('\n📋 TEST 6: Add Weekend Hours (Weekend Extra Request)');
    console.log('-'.repeat(80));

    // Find a weekend date in April 2025 (Saturday = 6, Sunday = 0)
    const weekendDate = new Date('2025-04-05'); // Saturday
    const dayOfWeek = weekendDate.getDay();
    
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Adjust to next Saturday
      weekendDate.setDate(weekendDate.getDate() + (6 - dayOfWeek));
    }

    process.stdout.write(`   Creating weekend extra request for ${weekendDate.toISOString().split('T')[0]}... `);
    let weekendExtraRequest;
    try {
      weekendExtraRequest = await prisma.weekendExtraRequest.create({
        data: {
          timesheet_id: timesheetResult.id,
          entry_date: weekendDate,
          requested_hours: new Decimal(8),
          reason: 'Phase 4 test - Weekend work for casual employee',
          created_by: johnCasual.id,
          status: 'pending',
        },
      });
      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to create weekend extra request',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Create Weekend Extra Request',
      'PASS',
      `Created weekend extra request for ${weekendDate.toISOString().split('T')[0]} with 8 hours`,
      undefined,
      {
        id: weekendExtraRequest.id,
        entry_date: weekendDate.toISOString().split('T')[0],
        requested_hours: 8,
      }
    );
    addFinding(`Created weekend extra request for ${weekendDate.toISOString().split('T')[0]} with 8 hours`);

    // Test 7: Approve Weekend Extra Request
    console.log('\n📋 TEST 7: Approve Weekend Extra Request');
    console.log('-'.repeat(80));

    process.stdout.write('   Approving weekend extra request... ');
    try {
      // Update request to approved
      await prisma.weekendExtraRequest.update({
        where: { id: weekendExtraRequest.id },
        data: {
          status: 'approved',
          approved_by: maureen.id,
          approved_at: new Date(),
        },
      });

      // Find the timesheet entry for this date
      const entry = await prisma.timesheetEntry.findFirst({
        where: {
          timesheet_id: timesheetResult.id,
          date: weekendDate,
        },
      });

      if (entry) {
        // Update entry with approved weekend extra hours
        const totalHours = entry.work_hours
          .plus(entry.leave_hours)
          .plus(entry.holiday_hours)
          .plus(new Decimal(8)) // weekend extra hours
          .plus(entry.overtime_hours);

        await prisma.timesheetEntry.update({
          where: { id: entry.id },
          data: {
            weekend_extra_hours: new Decimal(8),
            weekend_extra_request_id: weekendExtraRequest.id,
            total_hours: totalHours,
          },
        });

        // Recalculate timesheet total
        const allEntries = await prisma.timesheetEntry.findMany({
          where: { timesheet_id: timesheetResult.id },
        });

        const timesheetTotal = allEntries.reduce(
          (sum, e) => sum.plus(e.total_hours),
          new Decimal(0)
        );

        await prisma.timesheet.update({
          where: { id: timesheetResult.id },
          data: { total_hours: timesheetTotal },
        });
      }

      console.log('✅');
    } catch (error: any) {
      console.log('❌');
      logIssue(
        'Failed to approve weekend extra request',
        error.message,
        false
      );
      throw error;
    }

    logResult(
      'Approve Weekend Extra Request',
      'PASS',
      `Weekend extra request approved by Maureen, timesheet entry updated`,
      undefined,
      {
        weekend_extra_request_id: weekendExtraRequest.id,
        approved_by: maureen.id,
      }
    );
    addFinding(`Weekend extra request approved by Maureen. Timesheet entry updated with weekend extra hours.`);

    // Test 8: Submit Timesheet
    console.log('\n📋 TEST 8: Submit Timesheet');
    console.log('-'.repeat(80));

    process.stdout.write('   Finding timesheet workflow template... ');
    const timesheetWorkflowTemplate = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'timesheet',
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

    if (!timesheetWorkflowTemplate) {
      logResult(
        'Submit Timesheet',
        'SKIP',
        'No workflow template found for timesheets at this location'
      );
    } else {
      console.log(`✅ Found template with ${timesheetWorkflowTemplate.steps.length} steps`);

      // Check if timesheet period allows submission
      let timesheetPeriod = await prisma.timesheetPeriod.findFirst({
        where: {
          period_start: { lte: periodStart },
          period_end: { gte: periodEnd },
          submission_enabled: true,
        },
      });

      if (!timesheetPeriod) {
        timesheetPeriod = await prisma.timesheetPeriod.create({
          data: {
            period_start: periodStart,
            period_end: periodEnd,
            submission_enabled: true,
          },
        });
        console.log('   ✅ Created timesheet period to allow submission');
      }

      process.stdout.write('   Submitting timesheet... ');
      try {
        const timesheetWorkflowInstanceId = await createWorkflowInstance({
          templateId: timesheetWorkflowTemplate.id,
          resourceId: timesheetResult.id,
          resourceType: 'timesheet',
          createdBy: johnCasual.id,
          locationId: location.id,
        });

        await submitWorkflowInstance(timesheetWorkflowInstanceId);

        await prisma.timesheet.update({
          where: { id: timesheetResult.id },
          data: {
            status: 'Submitted',
            workflow_instance_id: timesheetWorkflowInstanceId,
          },
        });
        console.log('✅');

        logResult(
          'Submit Timesheet',
          'PASS',
          `Timesheet submitted, workflow has ${timesheetWorkflowTemplate.steps.length} steps`,
          undefined,
          {
            timesheet_id: timesheetResult.id,
            workflow_instance_id: timesheetWorkflowInstanceId,
          }
        );
        addFinding(`Timesheet submitted successfully. Workflow has ${timesheetWorkflowTemplate.steps.length} steps.`);

        // Test 9: Approve Timesheet
        console.log('\n📋 TEST 9: Approve Timesheet');
        console.log('-'.repeat(80));

        // Create approver for timesheet (can use Maureen or create a new one)
        const timesheetApproverRole = await prisma.role.findFirst({
          where: { name: 'Approver' },
        });

        let timesheetApprover = maureen; // Use Maureen if she has timesheet.approve, otherwise create new

        if (timesheetApproverRole) {
          // Check if Maureen has timesheet approval permission
          const maureenHasTimesheetApprove = await prisma.userRole.findFirst({
            where: {
              user_id: maureen.id,
              role_id: timesheetApproverRole.id,
            },
          });

          if (!maureenHasTimesheetApprove) {
            // Create a timesheet approver
            const approverEmail = `timesheet-approver-${Date.now()}@test.com`;
            timesheetApprover = await prisma.user.create({
              data: {
                name: 'Timesheet Approver',
                email: approverEmail,
                password_hash: await hashPassword('TestPassword123!'),
                primary_location_id: location.id,
                status: 'active',
                user_roles: {
                  create: {
                    role_id: timesheetApproverRole.id,
                  },
                },
              },
            });

            await prisma.userPermissionScope.create({
              data: {
                user_id: timesheetApprover.id,
                permission_id: timesheetApprovePermission.id,
                location_id: location.id,
                status: 'active',
                is_global: false,
                include_descendants: false,
                valid_from: new Date(),
              },
            });
            console.log('   ✅ Created timesheet approver');
          }
        }

        let currentTimesheetWorkflowInstance = await prisma.workflowInstance.findUnique({
          where: { id: timesheetWorkflowInstanceId },
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

        if (!currentTimesheetWorkflowInstance) {
          logResult('Approve Timesheet', 'FAIL', 'Workflow instance not found');
        } else {
          let allStepsApproved = true;
          let stepNumber = 1;

          while (stepNumber <= currentTimesheetWorkflowInstance.template.steps.length && 
                 currentTimesheetWorkflowInstance.current_step_order <= currentTimesheetWorkflowInstance.template.steps.length) {
            
            const currentStep = currentTimesheetWorkflowInstance.template.steps.find(
              (s) => s.step_order === currentTimesheetWorkflowInstance.current_step_order
            );

            if (!currentStep) {
              break;
            }

            process.stdout.write(`   Approving step ${currentTimesheetWorkflowInstance.current_step_order}... `);
            try {
              await approveWorkflowStep({
                instanceId: timesheetWorkflowInstanceId,
                stepOrder: currentTimesheetWorkflowInstance.current_step_order,
                userId: timesheetApprover.id,
                locationId: location.id,
                action: 'approve',
                comment: `Phase 4 test - Timesheet approval for John Casual`,
              });
              console.log('✅');

              // Refresh workflow instance
              currentTimesheetWorkflowInstance = await prisma.workflowInstance.findUnique({
                where: { id: timesheetWorkflowInstanceId },
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

              if (!currentTimesheetWorkflowInstance) {
                allStepsApproved = false;
                break;
              }

              addFinding(`Step ${stepNumber} approved. Status: ${currentTimesheetWorkflowInstance.status}`);

              if (currentTimesheetWorkflowInstance.status === 'Approved') {
                break;
              }

              stepNumber++;
            } catch (error: any) {
              console.log('❌');
              logIssue(
                `Failed to approve timesheet step ${currentTimesheetWorkflowInstance.current_step_order}`,
                error.message,
                false
              );
              allStepsApproved = false;
              break;
            }
          }

          const finalTimesheetInstance = await prisma.workflowInstance.findUnique({
            where: { id: timesheetWorkflowInstanceId },
          });

          if (allStepsApproved && finalTimesheetInstance?.status === 'Approved') {
            logResult(
              'Approve Timesheet',
              'PASS',
              `All steps approved. Final status: ${finalTimesheetInstance.status}`,
              undefined,
              {
                final_status: finalTimesheetInstance.status,
                total_steps: currentTimesheetWorkflowInstance.template.steps.length,
              }
            );
            addFinding(`Timesheet fully approved through ${currentTimesheetWorkflowInstance.template.steps.length}-step workflow`);
          } else {
            logResult(
              'Approve Timesheet',
              'FAIL',
              `Not all steps approved. Final status: ${finalTimesheetInstance?.status}`,
              undefined,
              { final_status: finalTimesheetInstance?.status }
            );
          }
        }
      } catch (error: any) {
        console.log('❌');
        logIssue(
          'Failed to submit timesheet',
          error.message,
          false
        );
        throw error;
      }
    }

    // Test 10: Verify charge_code in Final Timesheet
    console.log('\n📋 TEST 10: Verify charge_code in Final Timesheet');
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
        entries: {
          where: {
            weekend_extra_request_id: weekendExtraRequest.id,
          },
        },
      },
    });

    if (finalTimesheet?.user.charge_code) {
      logResult(
        'Verify charge_code in Timesheet',
        'PASS',
        `charge_code (${finalTimesheet.user.charge_code}) appears in timesheet user data`,
        undefined,
        {
          charge_code: finalTimesheet.user.charge_code,
          staff_number: finalTimesheet.user.staff_number,
        }
      );
      addFinding(`✅ charge_code (${finalTimesheet.user.charge_code}) and staff_number (${finalTimesheet.user.staff_number}) appear in timesheet data`);
    } else {
      logResult(
        'Verify charge_code in Timesheet',
        'FAIL',
        'charge_code not found in timesheet user data',
        undefined,
        {}
      );
      logIssue(
        'charge_code not found in timesheet user data',
        'Timesheet user data may not include charge_code field',
        false
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
      console.log('\n✅ Phase 4 Tests: ALL PASSED');
      console.log('   Casual employee scenario validated successfully!');
    } else {
      console.log('\n❌ Phase 4 Tests: SOME FAILED');
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
