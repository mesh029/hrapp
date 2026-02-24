#!/usr/bin/env tsx
/**
 * Comprehensive test for workflow template creation
 * Tests all scenarios to catch schema/API mismatches
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error: any) {
      results.push({ name, passed: false, error: error.message });
      console.error(`❌ ${name}: ${error.message}`);
    }
  };
}

async function runTests() {
  console.log('🧪 Testing Workflow Template Creation\n');

  // Test 1: Check schema has required fields
  await test('Schema: WorkflowTemplate has staff_type_id field', async () => {
    const schema = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workflow_templates' 
      AND column_name = 'staff_type_id'
    `;
    if (schema.length === 0) {
      throw new Error('staff_type_id column not found in database');
    }
  })();

  await test('Schema: WorkflowTemplate has leave_type_id field', async () => {
    const schema = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workflow_templates' 
      AND column_name = 'leave_type_id'
    `;
    if (schema.length === 0) {
      throw new Error('leave_type_id column not found in database');
    }
  })();

  // Test 2: Get test data
  let testLocation: any;
  let testStaffType: any;
  let testLeaveType: any;

  await test('Get test location', async () => {
    testLocation = await prisma.location.findFirst({
      where: { status: 'active' },
    });
    if (!testLocation) {
      throw new Error('No active location found for testing');
    }
  })();

  await test('Get test staff type', async () => {
    testStaffType = await prisma.staffType.findFirst({
      where: { deleted_at: null },
    });
    if (!testStaffType) {
      throw new Error('No staff type found for testing');
    }
  })();

  await test('Get test leave type', async () => {
    testLeaveType = await prisma.leaveType.findFirst({
      where: { deleted_at: null },
    });
    if (!testLeaveType) {
      throw new Error('No leave type found for testing');
    }
  })();

  // Test 3: Create template without filters
  let template1Id: string | null = null;
  await test('Create template without filters (location only)', async () => {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Test Template No Filters ${Date.now()}`,
        resource_type: 'leave',
        location_id: testLocation.id,
        staff_type_id: null,
        leave_type_id: null,
        version: 1,
        status: 'active',
      },
    });
    template1Id = template.id;
    if (!template.id) {
      throw new Error('Template creation failed');
    }
  })();

  // Test 4: Create template with staff_type only
  let template2Id: string | null = null;
  await test('Create template with staff_type filter', async () => {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Test Template Staff Type ${Date.now()}`,
        resource_type: 'leave',
        location_id: testLocation.id,
        staff_type_id: testStaffType.id,
        leave_type_id: null,
        version: 1,
        status: 'active',
      },
    });
    template2Id = template.id;
    if (!template.id) {
      throw new Error('Template creation failed');
    }
  })();

  // Test 5: Create template with leave_type only
  let template3Id: string | null = null;
  await test('Create template with leave_type filter', async () => {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Test Template Leave Type ${Date.now()}`,
        resource_type: 'leave',
        location_id: testLocation.id,
        staff_type_id: null,
        leave_type_id: testLeaveType.id,
        version: 1,
        status: 'active',
      },
    });
    template3Id = template.id;
    if (!template.id) {
      throw new Error('Template creation failed');
    }
  })();

  // Test 6: Create template with both filters
  let template4Id: string | null = null;
  await test('Create template with both staff_type and leave_type filters', async () => {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Test Template Both Filters ${Date.now()}`,
        resource_type: 'leave',
        location_id: testLocation.id,
        staff_type_id: testStaffType.id,
        leave_type_id: testLeaveType.id,
        version: 1,
        status: 'active',
      },
    });
    template4Id = template.id;
    if (!template.id) {
      throw new Error('Template creation failed');
    }
  })();

  // Test 7: Create timesheet template with staff_type
  let template5Id: string | null = null;
  await test('Create timesheet template with staff_type filter', async () => {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: `Test Timesheet Template ${Date.now()}`,
        resource_type: 'timesheet',
        location_id: testLocation.id,
        staff_type_id: testStaffType.id,
        leave_type_id: null, // Timesheets don't have leave_type
        version: 1,
        status: 'active',
      },
    });
    template5Id = template.id;
    if (!template.id) {
      throw new Error('Template creation failed');
    }
  })();

  // Test 8: Read templates back
  await test('Read template with staff_type relation', async () => {
    if (!template2Id) throw new Error('Template 2 not created');
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: template2Id },
      include: {
        staff_type: true,
        leave_type: true,
      },
    });
    if (!template) {
      throw new Error('Template not found');
    }
    if (template.staff_type_id !== testStaffType.id) {
      throw new Error('Staff type relation not loaded correctly');
    }
  })();

  await test('Read template with leave_type relation', async () => {
    if (!template3Id) throw new Error('Template 3 not created');
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: template3Id },
      include: {
        staff_type: true,
        leave_type: true,
      },
    });
    if (!template) {
      throw new Error('Template not found');
    }
    if (template.leave_type_id !== testLeaveType.id) {
      throw new Error('Leave type relation not loaded correctly');
    }
  })();

  // Test 9: Update template filters
  await test('Update template to add staff_type filter', async () => {
    if (!template1Id) throw new Error('Template 1 not created');
    const updated = await prisma.workflowTemplate.update({
      where: { id: template1Id },
      data: {
        staff_type_id: testStaffType.id,
      },
    });
    if (updated.staff_type_id !== testStaffType.id) {
      throw new Error('Update failed');
    }
  })();

  await test('Update template to remove staff_type filter', async () => {
    if (!template2Id) throw new Error('Template 2 not created');
    const updated = await prisma.workflowTemplate.update({
      where: { id: template2Id },
      data: {
        staff_type_id: null,
      },
    });
    if (updated.staff_type_id !== null) {
      throw new Error('Update to null failed');
    }
  })();

  // Test 10: Find template matching logic
  await test('Find template: location + staff_type + leave_type', async () => {
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'leave',
        location_id: testLocation.id,
        staff_type_id: testStaffType.id,
        leave_type_id: testLeaveType.id,
        status: 'active',
      },
    });
    if (!template || template.id !== template4Id) {
      throw new Error('Template matching failed');
    }
  })();

  await test('Find template: location only (fallback)', async () => {
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'leave',
        location_id: testLocation.id,
        staff_type_id: null,
        leave_type_id: null,
        status: 'active',
      },
    });
    if (!template) {
      throw new Error('Fallback template not found');
    }
  })();

  // Cleanup
  console.log('\n🧹 Cleaning up test templates...');
  const idsToDelete = [template1Id, template2Id, template3Id, template4Id, template5Id].filter(Boolean) as string[];
  if (idsToDelete.length > 0) {
    await prisma.workflowTemplate.deleteMany({
      where: { id: { in: idsToDelete } },
    });
    console.log(`✅ Deleted ${idsToDelete.length} test templates`);
  }

  // Summary
  console.log('\n📊 Test Summary:');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }

  console.log('\n✅ All tests passed!');
}

runTests()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
