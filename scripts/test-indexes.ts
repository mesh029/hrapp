import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testIndexes() {
  try {
    console.log('🔍 Testing performance indexes...\n');

    const expectedIndexes = [
      'user_permission_scopes_user_permission_active_time_idx',
      'delegations_delegate_permission_active_time_idx',
      'workflow_instances_resource_status_step_idx',
      'leave_requests_user_date_range_status_idx',
      'timesheet_entries_date_range_timesheet_idx',
    ];

    const indexList = expectedIndexes.map(idx => `'${idx}'`).join(', ');
    const result = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
       AND indexname IN (${indexList})
       ORDER BY indexname;`
    );

    const foundIndexes = result.map(r => r.indexname);
    const missingIndexes = expectedIndexes.filter(idx => !foundIndexes.includes(idx));

    console.log('✅ Found indexes:');
    foundIndexes.forEach(idx => console.log(`   - ${idx}`));

    if (missingIndexes.length > 0) {
      console.log('\n❌ Missing indexes:');
      missingIndexes.forEach(idx => console.log(`   - ${idx}`));
      process.exit(1);
    }

    console.log(`\n✅ All ${expectedIndexes.length} indexes created successfully!`);
    console.log('✅ Category 1 (Database Indexes) - TEST PASSED\n');

  } catch (error: any) {
    console.error('❌ Error testing indexes:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

testIndexes();
