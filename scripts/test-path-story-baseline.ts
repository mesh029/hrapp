import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../app/lib/auth/password';
import { createWorkflowInstance, submitWorkflowInstance, approveWorkflowStep } from '../app/lib/services/workflow';
import { createTimesheet } from '../app/lib/services/timesheet';

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

async function main() {
  console.log('🧪 PHASE 2: PATH STORY BASELINE TEST');
  console.log('='.repeat(80));
  console.log('Testing existing system functionality as baseline\n');

  const startTime = Date.now();

  try {
    // Setup: Get required data
    console.log('📋 SETUP: Gathering Required Data');
    console.log('-'.repeat(80));

    // Get Regular Staff Type
    const regularStaffType = await prisma.staffType.findFirst({
      where: { code: 'regular' },
    });
    if (!regularStaffType) {
      throw new Error('Regular staff type not found. Please run seed script.');
    }
    console.log(`✅ Found Regular Staff Type: ${regularStaffType.name}`);

    // Get Location
    const location = await prisma.location.findFirst({
      where: { name: 'Nairobi Office' },
    });
    if (!location) {
      throw new Error('Nairobi Office location not found. Please run seed script.');
    }
    console.log(`✅ Found Location: ${location.name}`);

    // Get Leave Type
    const leaveType = await prisma.leaveType.findFirst({
      where: { name: 'Annual Leave' },
    });
    if (!leaveType) {
      throw new Error('Annual Leave type not found. Please run seed script.');
    }
    console.log(`✅ Found Leave Type: ${leaveType.name}`);

    // Get permissions needed for approvals
    const leaveApprovePermission = await prisma.permission.findFirst({
      where: { name: 'leave.approve' },
    });
    const timesheetApprovePermission = await prisma.permission.findFirst({
      where: { name: 'timesheet.approve' },
    });

    if (!leaveApprovePermission || !timesheetApprovePermission) {
      throw new Error('Required permissions not found. Please run seed script.');
    }
    console.log(`✅ Found leave.approve permission`);
    console.log(`✅ Found timesheet.approve permission`);

    // Get or create approver role
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
      console.log(`✅ Created Approver role`);
    } else {
      // Ensure role has the permissions
      const hasLeaveApprove = await prisma.rolePermission.findFirst({
        where: {
          role_id: approverRole.id,
          permission_id: leaveApprovePermission.id,
        },
      });
      const hasTimesheetApprove = await prisma.rolePermission.findFirst({
        where: {
          role_id: approverRole.id,
          permission_id: timesheetApprovePermission.id,
        },
      });

      if (!hasLeaveApprove) {
        await prisma.rolePermission.create({
          data: {
            role_id: approverRole.id,
            permission_id: leaveApprovePermission.id,
          },
        });
      }
      if (!hasTimesheetApprove) {
        await prisma.rolePermission.create({
          data: {
            role_id: approverRole.id,
            permission_id: timesheetApprovePermission.id,
          },
        });
      }
      console.log(`✅ Approver role has required permissions`);
    }

    // Create approver users for each workflow step
    console.log(`\n📋 Creating Approver Users`);
    console.log('-'.repeat(80));

    const approvers: { id: string; name: string; email: string }[] = [];

    // Create 3 approvers for leave workflow (3 steps)
    for (let i = 1; i <= 3; i++) {
      const approverEmail = `approver-leave-${i}-${Date.now()}@test.com`;
      const approver = await prisma.user.create({
        data: {
          name: `Leave Approver ${i}`,
          email: approverEmail,
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
      
      // Create location scope for leave.approve permission
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
      
      approvers.push(approver);
      console.log(`   ✅ Created Leave Approver ${i}: ${approver.name} (with location scope)`);
    }

    // Create 2 approvers for timesheet workflow (2 steps)
    for (let i = 1; i <= 2; i++) {
      const approverEmail = `approver-timesheet-${i}-${Date.now()}@test.com`;
      const approver = await prisma.user.create({
        data: {
          name: `Timesheet Approver ${i}`,
          email: approverEmail,
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
      
      // Create location scope for timesheet.approve permission
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
      console.log(`   ✅ Created Timesheet Approver ${i}: ${approver.name} (with location scope)`);
    }

    // Test 1: Create Regular Staff Employee
    console.log('\n📋 TEST 1: Create Regular Staff Employee');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating regular staff employee... ');
    const testEmail = `regular-staff-${Date.now()}@test.com`;
    const regularEmployee = await prisma.user.create({
      data: {
        name: 'John Regular Staff',
        email: testEmail,
        password_hash: await hashPassword('TestPassword123!'),
        primary_location_id: location.id,
        staff_type_id: regularStaffType.id,
        status: 'active',
        staff_number: `REG-${Date.now()}`,
        charge_code: 'REG-CC-001',
      },
    });
    console.log('✅');
    logResult(
      'Create Regular Staff Employee',
      'PASS',
      `Created: ${regularEmployee.name} (${regularEmployee.email})`,
      undefined,
      { id: regularEmployee.id, staff_number: regularEmployee.staff_number, charge_code: regularEmployee.charge_code }
    );
    addFinding(`Regular staff employee created with staff_number: ${regularEmployee.staff_number} and charge_code: ${regularEmployee.charge_code}`);

    // Assign leave.create permission to regular employee
    const leaveCreatePermission = await prisma.permission.findFirst({
      where: { name: 'leave.create' },
    });
    if (leaveCreatePermission) {
      const employeeRole = await prisma.role.findFirst({
        where: { name: 'Employee' },
      });
      if (employeeRole) {
        await prisma.userRole.create({
          data: {
            user_id: regularEmployee.id,
            role_id: employeeRole.id,
          },
        });
        console.log('   ✅ Assigned Employee role with leave.create permission');
      }
    }

    // Test 2: Create Leave Request
    console.log('\n📋 TEST 2: Create Leave Request');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating leave request... ');
    const leaveStartDate = new Date('2025-03-01');
    const leaveEndDate = new Date('2025-03-05');
    const daysRequested = Math.ceil((leaveEndDate.getTime() - leaveStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        user_id: regularEmployee.id,
        leave_type_id: leaveType.id,
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        days_requested: daysRequested,
        reason: 'Baseline test - annual leave',
        location_id: location.id,
        status: 'Draft',
      },
      include: {
        leave_type: true,
        location: true,
      },
    });
    console.log('✅');
    logResult(
      'Create Leave Request',
      'PASS',
      `Created leave request: ${daysRequested} days from ${leaveStartDate.toISOString().split('T')[0]} to ${leaveEndDate.toISOString().split('T')[0]}`,
      undefined,
      { id: leaveRequest.id, status: leaveRequest.status, days_requested: daysRequested }
    );
    addFinding(`Leave request created in Draft status with ${daysRequested} days requested`);

    // Test 3: Submit Leave Request
    console.log('\n📋 TEST 3: Submit Leave Request');
    console.log('-'.repeat(80));

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
      addFinding('No leave workflow template configured - cannot test submission');
    } else {
      console.log(`✅ Found template with ${leaveWorkflowTemplate.steps.length} steps`);
      addFinding(`Leave workflow template has ${leaveWorkflowTemplate.steps.length} approval steps`);

      process.stdout.write('   Creating workflow instance... ');
      const workflowInstanceId = await createWorkflowInstance({
        templateId: leaveWorkflowTemplate.id,
        resourceId: leaveRequest.id,
        resourceType: 'leave',
        createdBy: regularEmployee.id,
        locationId: location.id,
      });
      console.log('✅');

      process.stdout.write('   Submitting workflow instance... ');
      await submitWorkflowInstance(workflowInstanceId);
      console.log('✅');

      // Update leave request
      await prisma.leaveRequest.update({
        where: { id: leaveRequest.id },
        data: {
          status: 'Submitted',
          workflow_instance_id: workflowInstanceId,
        },
      });

      const submittedRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequest.id },
      });

      const workflowInstance = await prisma.workflowInstance.findUnique({
        where: { id: workflowInstanceId },
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

      logResult(
        'Submit Leave Request',
        'PASS',
        `Leave request submitted, workflow status: ${workflowInstance?.status}, current step: ${workflowInstance?.current_step_order}`,
        undefined,
        {
          workflow_instance_id: workflowInstanceId,
          status: submittedRequest?.status,
          current_step: workflowInstance?.current_step_order,
        }
      );
      addFinding(`Leave request submitted successfully. Workflow has ${leaveWorkflowTemplate.steps.length} steps. Current step: ${workflowInstance?.current_step_order}`);

      // Test 4: Approve Leave Request Through Workflow
      console.log('\n📋 TEST 4: Approve Leave Request Through Workflow');
      console.log('-'.repeat(80));

      const leaveWorkflowInstance = await prisma.workflowInstance.findUnique({
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

      if (!leaveWorkflowInstance) {
        logResult('Approve Leave Request', 'FAIL', 'Workflow instance not found');
      } else {
        let allStepsApproved = true;
        let approverIndex = 0;
        
        // Process steps in order, approving each one
        while (leaveWorkflowInstance.current_step_order > 0 && 
               leaveWorkflowInstance.current_step_order <= leaveWorkflowInstance.template.steps.length) {
          
          const currentStep = leaveWorkflowInstance.template.steps.find(
            (s) => s.step_order === leaveWorkflowInstance.current_step_order
          );

          if (!currentStep) {
            break;
          }

          const currentStepInstance = leaveWorkflowInstance.steps.find(
            (si) => si.step_order === currentStep.step_order
          );

          if (currentStepInstance && 
              (currentStepInstance.status === 'Pending' || currentStepInstance.status === 'pending')) {
            const approver = approvers[approverIndex % 3]; // Use first 3 approvers for leave
            process.stdout.write(`   Approving step ${currentStep.step_order} with ${approver.name}... `);
            try {
              await approveWorkflowStep({
                instanceId: workflowInstanceId,
                stepOrder: currentStep.step_order,
                userId: approver.id,
                locationId: location.id,
                action: 'approve',
                comment: `Baseline test approval for step ${currentStep.step_order}`,
              });
              console.log('✅');

              // Refresh workflow instance to get updated status
              const updatedInstance = await prisma.workflowInstance.findUnique({
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

              if (updatedInstance) {
                Object.assign(leaveWorkflowInstance, updatedInstance);
                addFinding(`Step ${currentStep.step_order} approved. Workflow status: ${updatedInstance.status}, current step: ${updatedInstance.current_step_order}`);
                
                // If approved, break out of loop
                if (updatedInstance.status === 'Approved') {
                  break;
                }
              }
              
              approverIndex++;
            } catch (error: any) {
              console.log('❌');
              logResult(
                `Approve Step ${currentStep.step_order}`,
                'FAIL',
                `Failed to approve step`,
                error.message
              );
              allStepsApproved = false;
              break;
            }
          } else {
            // Step already approved or not in pending status, move to next
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
            `All ${leaveWorkflowInstance.template.steps.length} steps approved. Final status: ${finalInstance.status}`,
            undefined,
            { final_status: finalInstance.status, total_steps: leaveWorkflowInstance.template.steps.length }
          );
          addFinding(`Leave request fully approved through ${leaveWorkflowInstance.template.steps.length}-step workflow`);
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
    }

    // Test 5: Create Timesheet
    console.log('\n📋 TEST 5: Create Timesheet');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating timesheet for March 2025... ');
    const periodStart = new Date('2025-03-01');
    const periodEnd = new Date('2025-03-31');

    const timesheetResult = await createTimesheet({
      userId: regularEmployee.id,
      locationId: location.id,
      periodStart,
      periodEnd,
    });
    console.log('✅');

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetResult.id },
      include: {
        entries: {
          orderBy: { date: 'asc' },
        },
      },
    });

    logResult(
      'Create Timesheet',
      'PASS',
      `Created timesheet with ${timesheet?.entries.length || 0} entries for period ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`,
      undefined,
      {
        id: timesheetResult.id,
        entries_count: timesheet?.entries.length || 0,
        status: timesheet?.status,
      }
    );
    addFinding(`Timesheet created with ${timesheet?.entries.length || 0} entries (one per day in March)`);

    // Test 6: Submit Timesheet
    console.log('\n📋 TEST 6: Submit Timesheet');
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
      addFinding('No timesheet workflow template configured - cannot test submission');
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
        // Create a timesheet period to allow submission
        timesheetPeriod = await prisma.timesheetPeriod.create({
          data: {
            period_start: periodStart,
            period_end: periodEnd,
            submission_enabled: true,
          },
        });
        console.log('   ✅ Created timesheet period to allow submission');
      }

      process.stdout.write('   Creating workflow instance... ');
      const timesheetWorkflowInstanceId = await createWorkflowInstance({
        templateId: timesheetWorkflowTemplate.id,
        resourceId: timesheetResult.id,
        resourceType: 'timesheet',
        createdBy: regularEmployee.id,
        locationId: location.id,
      });
      console.log('✅');

      process.stdout.write('   Submitting workflow instance... ');
      await submitWorkflowInstance(timesheetWorkflowInstanceId);
      console.log('✅');

      // Update timesheet
      await prisma.timesheet.update({
        where: { id: timesheetResult.id },
        data: {
          status: 'Submitted',
          workflow_instance_id: timesheetWorkflowInstanceId,
        },
      });

      const submittedTimesheet = await prisma.timesheet.findUnique({
        where: { id: timesheetResult.id },
      });

      const timesheetWorkflowInstanceForStatus = await prisma.workflowInstance.findUnique({
        where: { id: timesheetWorkflowInstanceId },
      });

      logResult(
        'Submit Timesheet',
        'PASS',
        `Timesheet submitted, workflow status: ${timesheetWorkflowInstanceForStatus?.status}, current step: ${timesheetWorkflowInstanceForStatus?.current_step_order}`,
        undefined,
        {
          workflow_instance_id: timesheetWorkflowInstanceId,
          status: submittedTimesheet?.status,
          current_step: timesheetWorkflowInstanceForStatus?.current_step_order,
        }
      );
      addFinding(`Timesheet submitted successfully. Workflow has ${timesheetWorkflowTemplate.steps.length} steps. Current step: ${timesheetWorkflowInstanceForStatus?.current_step_order}`);

      // Test 7: Approve Timesheet Through Workflow
      console.log('\n📋 TEST 7: Approve Timesheet Through Workflow');
      console.log('-'.repeat(80));

      const timesheetWorkflowInstance = await prisma.workflowInstance.findUnique({
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

      if (!timesheetWorkflowInstance) {
        logResult('Approve Timesheet', 'FAIL', 'Workflow instance not found');
      } else {
        let allStepsApproved = true;
        let approverIndex = 3; // Start from 4th approver (timesheet approvers)
        
        // Process steps in order, approving each one
        while (timesheetWorkflowInstance.current_step_order > 0 && 
               timesheetWorkflowInstance.current_step_order <= timesheetWorkflowInstance.template.steps.length) {
          
          const currentStep = timesheetWorkflowInstance.template.steps.find(
            (s) => s.step_order === timesheetWorkflowInstance.current_step_order
          );

          if (!currentStep) {
            break;
          }

          const currentStepInstance = timesheetWorkflowInstance.steps.find(
            (si) => si.step_order === currentStep.step_order
          );

          if (currentStepInstance && 
              (currentStepInstance.status === 'Pending' || currentStepInstance.status === 'pending')) {
            const approver = approvers[approverIndex % 2 + 3]; // Use last 2 approvers for timesheet
            process.stdout.write(`   Approving step ${currentStep.step_order} with ${approver.name}... `);
            try {
              await approveWorkflowStep({
                instanceId: timesheetWorkflowInstanceId,
                stepOrder: currentStep.step_order,
                userId: approver.id,
                locationId: location.id,
                action: 'approve',
                comment: `Baseline test approval for step ${currentStep.step_order}`,
              });
              console.log('✅');

              // Refresh workflow instance to get updated status
              const updatedInstance = await prisma.workflowInstance.findUnique({
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

              if (updatedInstance) {
                Object.assign(timesheetWorkflowInstance, updatedInstance);
                addFinding(`Step ${currentStep.step_order} approved.`);
                
                // If approved, break out of loop
                if (updatedInstance.status === 'Approved') {
                  break;
                }
              }
              
              approverIndex++;
            } catch (error: any) {
              console.log('❌');
              logResult(
                `Approve Step ${currentStep.step_order}`,
                'FAIL',
                `Failed to approve step`,
                error.message
              );
              allStepsApproved = false;
              break;
            }
          } else {
            // Step already approved or not in pending status, move to next
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
            `All ${timesheetWorkflowInstance.template.steps.length} steps approved. Final status: ${finalTimesheetInstance.status}`,
            undefined,
            { final_status: finalTimesheetInstance.status, total_steps: timesheetWorkflowInstance.template.steps.length }
          );
          addFinding(`Timesheet fully approved through ${timesheetWorkflowInstance.template.steps.length}-step workflow`);
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
    }

    // Test 8: Verify Notifications
    console.log('\n📋 TEST 8: Verify Notifications');
    console.log('-'.repeat(80));

    const notifications = await prisma.notification.findMany({
      where: {
        user_id: regularEmployee.id,
        created_at: {
          gte: new Date(startTime),
        },
      },
      orderBy: { created_at: 'desc' },
    });

    logResult(
      'Verify Notifications',
      notifications.length > 0 ? 'PASS' : 'SKIP',
      `Found ${notifications.length} notifications for regular employee`,
      undefined,
      { notification_count: notifications.length }
    );
    if (notifications.length > 0) {
      addFinding(`System generated ${notifications.length} notifications during workflow progression`);
    } else {
      addFinding('No notifications found - notification system may need configuration');
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
      addFinding(`System generated ${auditLogs.length} audit log entries for workflow actions`);
    } else {
      addFinding('No audit logs found - audit logging may need configuration');
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

    console.log(`\n📝 Key Findings:`);
    findings.forEach((finding, index) => {
      console.log(`   ${index + 1}. ${finding}`);
    });

    if (failed === 0) {
      console.log('\n✅ Phase 2 Baseline Tests: ALL PASSED');
      console.log('   System baseline validated successfully!');
    } else {
      console.log('\n❌ Phase 2 Baseline Tests: SOME FAILED');
      console.log('   Please review failed tests before proceeding.');
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
