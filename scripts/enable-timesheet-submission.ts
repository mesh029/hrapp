#!/usr/bin/env tsx
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    // Get Lucy's user and location
    const lucy = await prisma.user.findFirst({
      where: {
        email: 'lucy.nyawira@test.com',
      },
      include: {
        primary_location: true,
      },
    });

    if (!lucy) {
      console.error('Lucy not found');
      process.exit(1);
    }

    console.log('Found Lucy:', {
      id: lucy.id,
      email: lucy.email,
      location: lucy.primary_location?.name,
      locationId: lucy.primary_location_id,
    });

    // Get the specific timesheet by ID (Brian's timesheet)
    const timesheetId = '1312abc5-ce56-4f92-ab3b-2068add64995';
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
    });

    if (!timesheet) {
      console.error(`No timesheet found with ID: ${timesheetId}`);
      process.exit(1);
    }
    
    // Get the timesheet owner
    const timesheetOwner = await prisma.user.findUnique({
      where: { id: timesheet.user_id },
      include: { primary_location: true },
    });
    
    if (!timesheetOwner) {
      console.error('Timesheet owner not found');
      process.exit(1);
    }
    
    console.log('Found timesheet owner:', {
      id: timesheetOwner.id,
      email: timesheetOwner.email,
      location: timesheetOwner.primary_location?.name,
    });

    console.log('Found timesheet:', {
      id: timesheet.id,
      period_start: timesheet.period_start,
      period_end: timesheet.period_end,
      location_id: timesheet.location_id,
    });

    // Enable submission for this period
    let period = await prisma.timesheetPeriod.findFirst({
      where: {
        period_start: { lte: timesheet.period_start },
        period_end: { gte: timesheet.period_end },
      },
    });

    if (period) {
      period = await prisma.timesheetPeriod.update({
        where: { id: period.id },
        data: {
          submission_enabled: true,
          enabled_at: new Date(),
          enabled_by: timesheetOwner.id,
        },
      });
    } else {
      period = await prisma.timesheetPeriod.create({
        data: {
          period_start: timesheet.period_start,
          period_end: timesheet.period_end,
          submission_enabled: true,
          enabled_at: new Date(),
          enabled_by: timesheetOwner.id,
        },
      });
    }

    console.log('✅ Enabled timesheet submission for period:', {
      id: period.id,
      period_start: period.period_start,
      period_end: period.period_end,
      submission_enabled: period.submission_enabled,
    });

    // Check if there's a workflow template for timesheets at this location
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'timesheet',
        location_id: timesheet.location_id,
        status: 'active',
      },
      include: {
        steps: {
          orderBy: {
            step_order: 'asc',
          },
        },
      },
    });

    if (!template) {
      console.log('⚠️  No workflow template found for timesheets at this location');
      console.log('   Creating a simple workflow template...');

      // Create a simple 2-step workflow template
      const newTemplate = await prisma.workflowTemplate.create({
        data: {
          name: `Timesheet Approval - ${timesheetOwner.primary_location?.name || 'Default'}`,
          resource_type: 'timesheet',
          location_id: timesheet.location_id,
          status: 'active',
          version: 1,
          steps: {
            create: [
              {
                step_order: 1,
                required_permission: 'timesheet.approve',
                allow_decline: true,
                allow_adjust: false,
                approver_strategy: 'permission',
                include_manager: false,
                location_scope: 'same',
              },
              {
                step_order: 2,
                required_permission: 'timesheet.approve',
                allow_decline: true,
                allow_adjust: false,
                approver_strategy: 'permission',
                include_manager: false,
                location_scope: 'same',
              },
            ],
          },
        },
        include: {
          steps: true,
        },
      });

      console.log('✅ Created workflow template:', {
        id: newTemplate.id,
        name: newTemplate.name,
        steps: newTemplate.steps.length,
      });
    } else {
      console.log('✅ Found workflow template:', {
        id: template.id,
        name: template.name,
        steps: template.steps.length,
      });
    }

    console.log('\n✅ Timesheet submission is now enabled!');
    console.log('   You can now submit the timesheet from the detail page.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
