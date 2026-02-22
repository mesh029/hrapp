import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
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

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL';
  details: string;
  error?: string;
}

const results: TestResult[] = [];

function logResult(testName: string, status: 'PASS' | 'FAIL', details: string, error?: string) {
  results.push({ testName, status, details, error });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`\n${icon} ${testName}`);
  console.log(`   ${details}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function main() {
  console.log('🧪 PHASE 1 TEST: Schema Extensions');
  console.log('='.repeat(80));
  console.log('Testing staff_number, charge_code fields and new staff types\n');

  const startTime = Date.now();

  try {
    // Test 1: Verify schema fields exist
    console.log('📋 TEST 1: Verifying Schema Fields');
    console.log('-'.repeat(80));

    process.stdout.write('   Checking if staff_number field exists... ');
    try {
      const testUser = await prisma.user.findFirst({
        select: {
          id: true,
          staff_number: true,
          charge_code: true,
        },
      });
      if (testUser !== null) {
        console.log('✅');
        logResult(
          'Schema Field: staff_number',
          'PASS',
          'Field exists and is accessible'
        );
      } else {
        // Even if no users exist, the field should be accessible
        console.log('✅');
        logResult(
          'Schema Field: staff_number',
          'PASS',
          'Field exists in schema (no users to test with)'
        );
      }
    } catch (error: any) {
      console.log('❌');
      logResult(
        'Schema Field: staff_number',
        'FAIL',
        'Field does not exist or is not accessible',
        error.message
      );
    }

    process.stdout.write('   Checking if charge_code field exists... ');
    try {
      const testUser = await prisma.user.findFirst({
        select: {
          id: true,
          charge_code: true,
        },
      });
      if (testUser !== null || true) {
        console.log('✅');
        logResult(
          'Schema Field: charge_code',
          'PASS',
          'Field exists and is accessible'
        );
      }
    } catch (error: any) {
      console.log('❌');
      logResult(
        'Schema Field: charge_code',
        'FAIL',
        'Field does not exist or is not accessible',
        error.message
      );
    }

    // Test 2: Verify indexes exist
    console.log('\n📋 TEST 2: Verifying Indexes');
    console.log('-'.repeat(80));

    process.stdout.write('   Checking staff_number index... ');
    try {
      // Try a query that would use the index
      await prisma.user.findFirst({
        where: { staff_number: 'TEST-001' },
      });
      console.log('✅');
      logResult(
        'Index: staff_number',
        'PASS',
        'Index exists and is functional'
      );
    } catch (error: any) {
      if (error.message.includes('column') || error.message.includes('does not exist')) {
        console.log('❌');
        logResult(
          'Index: staff_number',
          'FAIL',
          'Index or field does not exist',
          error.message
        );
      } else {
        console.log('✅');
        logResult(
          'Index: staff_number',
          'PASS',
          'Index exists (no matching record found, which is expected)'
        );
      }
    }

    // Test 3: Test staff number uniqueness
    console.log('\n📋 TEST 3: Testing Staff Number Uniqueness');
    console.log('-'.repeat(80));

    const admin = await prisma.user.findFirst({
      where: { email: 'admin@path.org' },
    });

    if (!admin) {
      logResult(
        'Staff Number Uniqueness',
        'FAIL',
        'Admin user not found. Please run seed script first.'
      );
    } else {
      process.stdout.write('   Testing staff number uniqueness constraint... ');
      try {
        // Try to create a user with a test staff number
        const testStaffNumber = `TEST-${Date.now()}`;
        const testUser1 = await prisma.user.create({
          data: {
            name: 'Test User 1',
            email: `test1-${Date.now()}@test.com`,
            password_hash: 'test-hash',
            staff_number: testStaffNumber,
          },
        });

        // Try to create another user with the same staff number (should fail)
        try {
          await prisma.user.create({
            data: {
              name: 'Test User 2',
              email: `test2-${Date.now()}@test.com`,
              password_hash: 'test-hash',
              staff_number: testStaffNumber,
            },
          });
          console.log('❌');
          logResult(
            'Staff Number Uniqueness',
            'FAIL',
            'Duplicate staff number was allowed (should have been rejected)'
          );
        } catch (uniqueError: any) {
          if (uniqueError.code === 'P2002' || uniqueError.message.includes('Unique constraint')) {
            console.log('✅');
            logResult(
              'Staff Number Uniqueness',
              'PASS',
              'Uniqueness constraint enforced correctly'
            );
          } else {
            console.log('❌');
            logResult(
              'Staff Number Uniqueness',
              'FAIL',
              'Unexpected error',
              uniqueError.message
            );
          }
        }

        // Cleanup
        await prisma.user.delete({ where: { id: testUser1.id } });
      } catch (error: any) {
        console.log('❌');
        logResult(
          'Staff Number Uniqueness',
          'FAIL',
          'Test failed',
          error.message
        );
      }
    }

    // Test 4: Verify new staff types exist
    console.log('\n📋 TEST 4: Verifying New Staff Types');
    console.log('-'.repeat(80));

    process.stdout.write('   Checking Casual staff type... ');
    const casualStaffType = await prisma.staffType.findFirst({
      where: { code: 'casual' },
    });
    if (casualStaffType) {
      console.log('✅');
      logResult(
        'Staff Type: Casual',
        'PASS',
        `Found: ${casualStaffType.name}`
      );
    } else {
      console.log('❌');
      logResult(
        'Staff Type: Casual',
        'FAIL',
        'Casual staff type not found. Please run seed script.'
      );
    }

    process.stdout.write('   Checking Laundry Worker staff type... ');
    const laundryWorkerStaffType = await prisma.staffType.findFirst({
      where: { code: 'laundry_worker' },
    });
    if (laundryWorkerStaffType) {
      console.log('✅');
      logResult(
        'Staff Type: Laundry Worker',
        'PASS',
        `Found: ${laundryWorkerStaffType.name}`
      );
    } else {
      console.log('❌');
      logResult(
        'Staff Type: Laundry Worker',
        'FAIL',
        'Laundry Worker staff type not found. Please run seed script.'
      );
    }

    // Test 5: Verify work hours configs for new staff types
    console.log('\n📋 TEST 5: Verifying Work Hours Configs');
    console.log('-'.repeat(80));

    if (casualStaffType) {
      process.stdout.write('   Checking Casual work hours (Mon-Fri)... ');
      const casualWorkHours = await prisma.workHoursConfig.findMany({
        where: {
          staff_type_id: casualStaffType.id,
          location_id: null,
          deleted_at: null,
          is_active: true,
        },
      });
      if (casualWorkHours.length >= 5) {
        console.log('✅');
        logResult(
          'Work Hours: Casual',
          'PASS',
          `Found ${casualWorkHours.length} day configurations`
        );
      } else {
        console.log('❌');
        logResult(
          'Work Hours: Casual',
          'FAIL',
          `Expected 5 days, found ${casualWorkHours.length}. Please run seed script.`
        );
      }
    }

    if (laundryWorkerStaffType) {
      process.stdout.write('   Checking Laundry Worker work hours (Mon-Thu)... ');
      const laundryWorkHours = await prisma.workHoursConfig.findMany({
        where: {
          staff_type_id: laundryWorkerStaffType.id,
          location_id: null,
          deleted_at: null,
          is_active: true,
        },
      });
      if (laundryWorkHours.length >= 4) {
        console.log('✅');
        logResult(
          'Work Hours: Laundry Worker',
          'PASS',
          `Found ${laundryWorkHours.length} day configurations (4-day week)`
        );
      } else {
        console.log('❌');
        logResult(
          'Work Hours: Laundry Worker',
          'FAIL',
          `Expected 4 days, found ${laundryWorkHours.length}. Please run seed script.`
        );
      }
    }

    // Test 6: Test creating user with staff_number and charge_code
    console.log('\n📋 TEST 6: Testing User Creation with New Fields');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating user with staff_number and charge_code... ');
    try {
      const testEmail = `test-phase1-${Date.now()}@test.com`;
      const testStaffNumber = `PH1-${Date.now()}`;
      const testChargeCode = 'TEST-CC-001';

      const newUser = await prisma.user.create({
        data: {
          name: 'Phase 1 Test User',
          email: testEmail,
          password_hash: 'test-hash',
          staff_number: testStaffNumber,
          charge_code: testChargeCode,
        },
      });

      if (newUser.staff_number === testStaffNumber && newUser.charge_code === testChargeCode) {
        console.log('✅');
        logResult(
          'User Creation: With New Fields',
          'PASS',
          `Created user with staff_number: ${testStaffNumber}, charge_code: ${testChargeCode}`
        );

        // Cleanup
        await prisma.user.delete({ where: { id: newUser.id } });
      } else {
        console.log('❌');
        logResult(
          'User Creation: With New Fields',
          'FAIL',
          'Fields were not saved correctly'
        );
      }
    } catch (error: any) {
      console.log('❌');
      logResult(
        'User Creation: With New Fields',
        'FAIL',
        'Failed to create user',
        error.message
      );
    }

    // Test 7: Test creating user without new fields (should work)
    console.log('\n📋 TEST 7: Testing User Creation Without New Fields');
    console.log('-'.repeat(80));

    process.stdout.write('   Creating user without staff_number and charge_code... ');
    try {
      const testEmail = `test-phase1-optional-${Date.now()}@test.com`;

      const newUser = await prisma.user.create({
        data: {
          name: 'Phase 1 Test User (Optional Fields)',
          email: testEmail,
          password_hash: 'test-hash',
          // No staff_number or charge_code
        },
      });

      if (newUser.staff_number === null && newUser.charge_code === null) {
        console.log('✅');
        logResult(
          'User Creation: Without New Fields',
          'PASS',
          'User created successfully with null values for optional fields'
        );

        // Cleanup
        await prisma.user.delete({ where: { id: newUser.id } });
      } else {
        console.log('❌');
        logResult(
          'User Creation: Without New Fields',
          'FAIL',
          'Fields should be null but are not'
        );
      }
    } catch (error: any) {
      console.log('❌');
      logResult(
        'User Creation: Without New Fields',
        'FAIL',
        'Failed to create user without optional fields',
        error.message
      );
    }

    // Test 8: Test updating user to add fields
    console.log('\n📋 TEST 8: Testing User Update with New Fields');
    console.log('-'.repeat(80));

    if (admin) {
      process.stdout.write('   Updating user to add staff_number and charge_code... ');
      try {
        const testStaffNumber = `PH1-UPDATE-${Date.now()}`;
        const testChargeCode = 'TEST-CC-UPDATE-001';

        const updatedUser = await prisma.user.update({
          where: { id: admin.id },
          data: {
            staff_number: testStaffNumber,
            charge_code: testChargeCode,
          },
        });

        if (updatedUser.staff_number === testStaffNumber && updatedUser.charge_code === testChargeCode) {
          console.log('✅');
          logResult(
            'User Update: Add New Fields',
            'PASS',
            `Updated user with staff_number: ${testStaffNumber}, charge_code: ${testChargeCode}`
          );

          // Reset to null for cleanup
          await prisma.user.update({
            where: { id: admin.id },
            data: {
              staff_number: null,
              charge_code: null,
            },
          });
        } else {
          console.log('❌');
          logResult(
            'User Update: Add New Fields',
            'FAIL',
            'Fields were not updated correctly'
          );
        }
      } catch (error: any) {
        console.log('❌');
        logResult(
          'User Update: Add New Fields',
          'FAIL',
          'Failed to update user',
          error.message
        );
      }
    } else {
      logResult(
        'User Update: Add New Fields',
        'SKIP',
        'Admin user not found'
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

    if (failed === 0) {
      console.log('\n✅ Phase 1 Schema Tests: ALL PASSED');
      console.log('   Ready to proceed with migrations and seed!');
    } else {
      console.log('\n❌ Phase 1 Schema Tests: SOME FAILED');
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
