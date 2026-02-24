#!/usr/bin/env tsx
/**
 * Enhanced Workflow Simulation Script
 * 
 * Creates REAL leave requests and timesheets, submits them through workflows,
 * and runs them through approval steps, saving all timeline data.
 * 
 * Phase 6: Enhanced simulation
 * Phase 7: Test approval flows
 * Phase 8: Test rejection flows
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { createWorkflowInstance, submitWorkflowInstance, approveWorkflowStep, declineWorkflowStep } from '../app/lib/services/workflow';
import { createTimesheet } from '../app/lib/services/timesheet';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface SimulationResult {
  type: 'leave' | 'timesheet';
  resourceId: string;
  workflowInstanceId: string;
  status: string;
  steps: Array<{
    stepOrder: number;
    status: string;
    approver?: string;
    action?: string;
    timestamp?: Date;
  }>;
}

async function main() {
  console.log('🎭 Starting Enhanced Workflow Simulation...\n');

  // Get test users
  const employees = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      user_roles: {
        none: {}, // Employees without roles
      },
    },
    include: {
      primary_location: true,
      staff_type: true,
      manager: {
        include: {
          user_roles: {
            include: {
              role: true,
            },
          },
        },
      },
    },
    take: 5,
  });

  if (employees.length === 0) {
    throw new Error('No employees found. Please seed users first.');
  }

  console.log(`📋 Found ${employees.length} employees for simulation\n`);

  const results: SimulationResult[] = [];

  // ============================================
  // SIMULATE LEAVE REQUESTS
  // ============================================
  console.log('📅 SIMULATING LEAVE REQUESTS...\n');

  const leaveType = await prisma.leaveType.findFirst({
    where: { deleted_at: null, status: 'active' },
  });

  if (!leaveType) {
    console.log('⚠️  No leave type found, skipping leave simulations');
  } else {
    for (let i = 0; i < Math.min(3, employees.length); i++) {
      const employee = employees[i];
      if (!employee.primary_location_id) continue;

      try {
        console.log(`\n📝 Creating leave request for ${employee.name}...`);

        // Create leave request
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7); // 7 days from now
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 5); // 5 days leave

        const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        const leaveRequest = await prisma.leaveRequest.create({
          data: {
            user_id: employee.id,
            leave_type_id: leaveType.id,
            start_date: startDate,
            end_date: endDate,
            days_requested: daysRequested,
            reason: `Simulation leave request for ${employee.name}`,
            location_id: employee.primary_location_id,
            status: 'Draft',
          },
        });

        console.log(`  ✅ Created leave request: ${leaveRequest.id}`);

        // Find workflow template
        const { findWorkflowTemplate } = await import('../app/lib/services/workflow');
        const templateId = await findWorkflowTemplate({
          resourceType: 'leave',
          locationId: employee.primary_location_id,
          staffTypeId: employee.staff_type_id || null,
          leaveTypeId: leaveType.id,
        });

        if (!templateId) {
          console.log(`  ⚠️  No workflow template found, skipping workflow`);
          continue;
        }

        // Create and submit workflow instance
        const workflowInstanceId = await createWorkflowInstance({
          templateId,
          resourceId: leaveRequest.id,
          resourceType: 'leave',
          createdBy: employee.id,
          locationId: employee.primary_location_id,
        });

        console.log(`  ✅ Created workflow instance: ${workflowInstanceId}`);

        await submitWorkflowInstance(workflowInstanceId);
        console.log(`  ✅ Submitted workflow`);

        // Get workflow steps
        const instance = await prisma.workflowInstance.findUnique({
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

        if (!instance) continue;

        const stepResults: SimulationResult['steps'] = [];

        // Process each step
        for (const step of instance.template.steps) {
          const stepInstance = instance.steps.find(s => s.step_order === step.step_order);
          if (!stepInstance) continue;

          // Resolve approvers
          const { resolveApprovers } = await import('../app/lib/services/workflow');
          const approverIds = await resolveApprovers(
            step.step_order,
            workflowInstanceId,
            employee.primary_location_id,
            {
              stepConfig: {
                ...step,
                required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
                conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
              },
            }
          );

          if (approverIds.length === 0) {
            console.log(`  ⚠️  Step ${step.step_order}: No approvers found`);
            stepResults.push({
              stepOrder: step.step_order,
              status: 'pending',
            });
            continue;
          }

          const approver = await prisma.user.findUnique({
            where: { id: approverIds[0] },
          });

          console.log(`  👤 Step ${step.step_order}: Approver ${approver?.name || approverIds[0]}`);

          // Approve step (or decline last step for testing rejection)
          const isLastStep = step.step_order === instance.template.steps.length;
          const shouldDecline = isLastStep && i === 0; // Decline first leave request for testing

          if (shouldDecline) {
            await declineWorkflowStep({
              instanceId: workflowInstanceId,
              userId: approverIds[0],
              locationId: employee.primary_location_id,
              comment: 'Simulation: Testing rejection flow',
              ipAddress: '127.0.0.1',
              userAgent: 'Simulation Script',
            });
            console.log(`  ❌ Step ${step.step_order}: DECLINED (testing rejection)`);
            stepResults.push({
              stepOrder: step.step_order,
              status: 'declined',
              approver: approver?.name,
              action: 'declined',
              timestamp: new Date(),
            });
            break;
          } else {
            await approveWorkflowStep({
              instanceId: workflowInstanceId,
              userId: approverIds[0],
              locationId: employee.primary_location_id,
              comment: `Simulation: Approved by ${approver?.name}`,
              ipAddress: '127.0.0.1',
              userAgent: 'Simulation Script',
            });
            console.log(`  ✅ Step ${step.step_order}: APPROVED`);
            stepResults.push({
              stepOrder: step.step_order,
              status: 'approved',
              approver: approver?.name,
              action: 'approved',
              timestamp: new Date(),
            });
          }

          // Wait a bit between steps
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Get final status
        const finalInstance = await prisma.workflowInstance.findUnique({
          where: { id: workflowInstanceId },
        });

        results.push({
          type: 'leave',
          resourceId: leaveRequest.id,
          workflowInstanceId,
          status: finalInstance?.status || 'Unknown',
          steps: stepResults,
        });

        console.log(`  ✅ Leave request ${finalInstance?.status || 'completed'}\n`);
      } catch (error: any) {
        console.error(`  ❌ Error simulating leave for ${employee.name}:`, error.message);
      }
    }
  }

  // ============================================
  // SIMULATE TIMESHEETS
  // ============================================
  console.log('\n⏰ SIMULATING TIMESHEETS...\n');

  for (let i = 0; i < Math.min(2, employees.length); i++) {
    const employee = employees[i];
    if (!employee.primary_location_id) continue;

    try {
      console.log(`\n📝 Creating timesheet for ${employee.name}...`);

      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() - 1); // Yesterday
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 13); // 2 weeks ago

      const { id: timesheetId } = await createTimesheet({
        userId: employee.id,
        periodStart,
        periodEnd,
        locationId: employee.primary_location_id,
      });

      console.log(`  ✅ Created timesheet: ${timesheetId}`);

      // Find workflow template
      const { findWorkflowTemplate } = await import('../app/lib/services/workflow');
      const templateId = await findWorkflowTemplate({
        resourceType: 'timesheet',
        locationId: employee.primary_location_id,
        staffTypeId: employee.staff_type_id || null,
      });

      if (!templateId) {
        console.log(`  ⚠️  No workflow template found, skipping workflow`);
        continue;
      }

      // Create and submit workflow instance
      const workflowInstanceId = await createWorkflowInstance({
        templateId,
        resourceId: timesheetId,
        resourceType: 'timesheet',
        createdBy: employee.id,
        locationId: employee.primary_location_id,
      });

      console.log(`  ✅ Created workflow instance: ${workflowInstanceId}`);

      await submitWorkflowInstance(workflowInstanceId);
      console.log(`  ✅ Submitted workflow`);

      // Get workflow steps and process them
      const instance = await prisma.workflowInstance.findUnique({
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

      if (!instance) continue;

      const stepResults: SimulationResult['steps'] = [];

      for (const step of instance.template.steps) {
        const stepInstance = instance.steps.find(s => s.step_order === step.step_order);
        if (!stepInstance) continue;

        const { resolveApprovers } = await import('../app/lib/services/workflow');
        const approverIds = await resolveApprovers(
          step.step_order,
          workflowInstanceId,
          employee.primary_location_id,
          {
            stepConfig: {
              ...step,
              required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
              conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
            },
          }
        );

        if (approverIds.length === 0) {
          console.log(`  ⚠️  Step ${step.step_order}: No approvers found`);
          continue;
        }

        const approver = await prisma.user.findUnique({
          where: { id: approverIds[0] },
        });

        console.log(`  👤 Step ${step.step_order}: Approver ${approver?.name || approverIds[0]}`);

        await approveWorkflowStep({
          instanceId: workflowInstanceId,
          userId: approverIds[0],
          locationId: employee.primary_location_id,
          comment: `Simulation: Approved by ${approver?.name}`,
          ipAddress: '127.0.0.1',
          userAgent: 'Simulation Script',
        });

        console.log(`  ✅ Step ${step.step_order}: APPROVED`);
        stepResults.push({
          stepOrder: step.step_order,
          status: 'approved',
          approver: approver?.name,
          action: 'approved',
          timestamp: new Date(),
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalInstance = await prisma.workflowInstance.findUnique({
        where: { id: workflowInstanceId },
      });

      results.push({
        type: 'timesheet',
        resourceId: timesheetId,
        workflowInstanceId,
        status: finalInstance?.status || 'Unknown',
        steps: stepResults,
      });

      console.log(`  ✅ Timesheet ${finalInstance?.status || 'completed'}\n`);
    } catch (error: any) {
      console.error(`  ❌ Error simulating timesheet for ${employee.name}:`, error.message);
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n📊 SIMULATION SUMMARY:\n');
  console.log(`Total Simulations: ${results.length}`);
  console.log(`Leave Requests: ${results.filter(r => r.type === 'leave').length}`);
  console.log(`Timesheets: ${results.filter(r => r.type === 'timesheet').length}`);
  console.log(`Approved: ${results.filter(r => r.status === 'Approved').length}`);
  console.log(`Declined: ${results.filter(r => r.status === 'Declined').length}`);
  console.log(`Pending: ${results.filter(r => r.status === 'Submitted' || r.status === 'Draft').length}\n`);

  console.log('📋 Detailed Results:');
  results.forEach((result, idx) => {
    console.log(`\n${idx + 1}. ${result.type.toUpperCase()} - ${result.status}`);
    console.log(`   Resource ID: ${result.resourceId}`);
    console.log(`   Workflow Instance: ${result.workflowInstanceId}`);
    console.log(`   Steps:`);
    result.steps.forEach(step => {
      console.log(`     - Step ${step.stepOrder}: ${step.status} ${step.approver ? `by ${step.approver}` : ''}`);
    });
  });

  console.log('\n✅ Simulation complete!');
  console.log('📧 Check notifications for approvers');
  console.log('📈 Check workflow timelines for approval history\n');
}

main()
  .catch((error) => {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
