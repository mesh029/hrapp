#!/usr/bin/env tsx
/**
 * Script to sync leave request and timesheet statuses with their workflow instances
 * 
 * This ensures that:
 * - Resources with completed workflows are marked as 'Approved'
 * - Resources with in-progress workflows are marked as 'UnderReview' or 'Submitted'
 * - Resources with draft workflows remain as 'Draft'
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Syncing leave request and timesheet statuses with workflow instances...\n');

  // Get all leave requests with workflow instances
  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      workflow_instance_id: { not: null },
      deleted_at: null,
    },
    select: {
      id: true,
      status: true,
      workflow_instance_id: true,
    },
  });

  // Get workflow instances for leave requests
  const leaveWorkflowIds = leaveRequests
    .map(l => l.workflow_instance_id)
    .filter((id): id is string => id !== null);

  const leaveWorkflows = await prisma.workflowInstance.findMany({
    where: {
      id: { in: leaveWorkflowIds },
    },
    select: {
      id: true,
      status: true,
      current_step_order: true,
    },
  });

  const leaveWorkflowMap = new Map(leaveWorkflows.map(w => [w.id, w]));

  console.log(`Found ${leaveRequests.length} leave requests with workflow instances\n`);

  let leaveUpdated = 0;
  let leaveSkipped = 0;

  for (const leave of leaveRequests) {
    if (!leave.workflow_instance_id) continue;

    const workflow = leaveWorkflowMap.get(leave.workflow_instance_id);
    if (!workflow) continue;

    const workflowStatus = workflow.status;
    let targetStatus: string;

    // Map workflow status to leave request status
    if (workflowStatus === 'Approved') {
      targetStatus = 'Approved';
    } else if (workflowStatus === 'Declined') {
      targetStatus = 'Declined';
    } else if (workflowStatus === 'UnderReview' || workflowStatus === 'Submitted') {
      targetStatus = 'UnderReview';
    } else if (workflowStatus === 'Draft') {
      targetStatus = 'Draft';
    } else {
      targetStatus = leave.status; // Keep current status if unknown
    }

    if (leave.status === targetStatus) {
      leaveSkipped++;
      continue;
    }

    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { status: targetStatus as any },
    });

    console.log(`  ✅ Leave ${leave.id}: ${leave.status} → ${targetStatus} (workflow: ${workflowStatus})`);
    leaveUpdated++;
  }

  // Get all timesheets with workflow instances
  const timesheets = await prisma.timesheet.findMany({
    where: {
      workflow_instance_id: { not: null },
      deleted_at: null,
    },
    select: {
      id: true,
      status: true,
      workflow_instance_id: true,
    },
  });

  // Get workflow instances for timesheets
  const timesheetWorkflowIds = timesheets
    .map(t => t.workflow_instance_id)
    .filter((id): id is string => id !== null);

  const timesheetWorkflows = await prisma.workflowInstance.findMany({
    where: {
      id: { in: timesheetWorkflowIds },
    },
    select: {
      id: true,
      status: true,
      current_step_order: true,
    },
  });

  const timesheetWorkflowMap = new Map(timesheetWorkflows.map(w => [w.id, w]));

  console.log(`\nFound ${timesheets.length} timesheets with workflow instances\n`);

  let timesheetUpdated = 0;
  let timesheetSkipped = 0;

  for (const timesheet of timesheets) {
    if (!timesheet.workflow_instance_id) continue;

    const workflow = timesheetWorkflowMap.get(timesheet.workflow_instance_id);
    if (!workflow) continue;

    const workflowStatus = workflow.status;
    let targetStatus: string;

    // Map workflow status to timesheet status
    if (workflowStatus === 'Approved') {
      targetStatus = 'Approved';
    } else if (workflowStatus === 'Declined') {
      targetStatus = 'Declined';
    } else if (workflowStatus === 'UnderReview' || workflowStatus === 'Submitted') {
      targetStatus = 'UnderReview';
    } else if (workflowStatus === 'Draft') {
      targetStatus = 'Draft';
    } else {
      targetStatus = timesheet.status; // Keep current status if unknown
    }

    if (timesheet.status === targetStatus) {
      timesheetSkipped++;
      continue;
    }

    await prisma.timesheet.update({
      where: { id: timesheet.id },
      data: { status: targetStatus as any },
    });

    console.log(`  ✅ Timesheet ${timesheet.id}: ${timesheet.status} → ${targetStatus} (workflow: ${workflowStatus})`);
    timesheetUpdated++;
  }

  // Also check for resources that should have workflows but don't
  const leavesWithoutWorkflow = await prisma.leaveRequest.findMany({
    where: {
      workflow_instance_id: null,
      status: { not: 'Draft' },
      deleted_at: null,
    },
    select: { id: true, status: true },
  });

  const timesheetsWithoutWorkflow = await prisma.timesheet.findMany({
    where: {
      workflow_instance_id: null,
      status: { not: 'Draft' },
      deleted_at: null,
    },
    select: { id: true, status: true },
  });

  console.log('\n📊 SUMMARY:');
  console.log(`  Leave Requests:`);
  console.log(`    ✅ Updated: ${leaveUpdated}`);
  console.log(`    ⏭️  Skipped (already correct): ${leaveSkipped}`);
  console.log(`    ⚠️  Without workflow (status not Draft): ${leavesWithoutWorkflow.length}`);
  console.log(`  Timesheets:`);
  console.log(`    ✅ Updated: ${timesheetUpdated}`);
  console.log(`    ⏭️  Skipped (already correct): ${timesheetSkipped}`);
  console.log(`    ⚠️  Without workflow (status not Draft): ${timesheetsWithoutWorkflow.length}`);

  if (leavesWithoutWorkflow.length > 0) {
    console.log(`\n⚠️  Found ${leavesWithoutWorkflow.length} leave request(s) with non-Draft status but no workflow instance.`);
    console.log(`   These may need to be resubmitted or manually reviewed.`);
  }

  if (timesheetsWithoutWorkflow.length > 0) {
    console.log(`\n⚠️  Found ${timesheetsWithoutWorkflow.length} timesheet(s) with non-Draft status but no workflow instance.`);
    console.log(`   These may need to be resubmitted or manually reviewed.`);
  }

  console.log('\n✅ Sync complete! All resource statuses are now aligned with their workflow instances.');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
