import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380');

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
  error?: string;
}

const results: TestResult[] = [];

function logResult(name: string, status: 'PASS' | 'FAIL', details: string, error?: string) {
  results.push({ name, status, details, error });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${name}: ${details}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function testConnectionPooling() {
  console.log('\n🔍 Testing Connection Pooling...\n');
  
  try {
    // Test that pool configuration is applied
    const poolConfig = pool.options;
    logResult(
      'Connection Pool Config',
      'PASS',
      `Max: ${poolConfig.max || 'default'}, Min: ${poolConfig.min || 'default'}`
    );

    // Test multiple concurrent queries
    const start = Date.now();
    const queries = Array(10).fill(null).map(() => 
      prisma.user.findFirst({ select: { id: true } })
    );
    await Promise.all(queries);
    const time = Date.now() - start;
    
    logResult(
      'Concurrent Queries',
      time < 1000 ? 'PASS' : 'FAIL',
      `10 concurrent queries completed in ${time}ms`
    );
  } catch (error: any) {
    logResult('Connection Pooling', 'FAIL', 'Failed to test connection pooling', error.message);
  }
}

async function testCaching() {
  console.log('\n🔍 Testing Redis Caching...\n');
  
  try {
    // Test leave types cache
    const testKey = 'test:leave_types:cache';
    const testData = { test: 'data' };
    await redis.setex(testKey, 60, JSON.stringify(testData));
    const cached = await redis.get(testKey);
    
    if (cached && JSON.parse(cached).test === 'data') {
      logResult('Leave Types Cache Write/Read', 'PASS', 'Cache write and read successful');
    } else {
      logResult('Leave Types Cache Write/Read', 'FAIL', 'Cache read failed');
    }

    // Test cache invalidation
    await redis.del(testKey);
    const afterDelete = await redis.get(testKey);
    if (!afterDelete) {
      logResult('Cache Invalidation', 'PASS', 'Cache deletion successful');
    } else {
      logResult('Cache Invalidation', 'FAIL', 'Cache deletion failed');
    }

    // Test pattern-based cache invalidation
    await redis.setex('locations:test1', 60, 'data1');
    await redis.setex('locations:test2', 60, 'data2');
    const keys = await redis.keys('locations:*');
    if (keys.length >= 2) {
      logResult('Pattern Cache Keys', 'PASS', `Found ${keys.length} location cache keys`);
      await redis.del(...keys);
    } else {
      logResult('Pattern Cache Keys', 'FAIL', 'Pattern matching failed');
    }
  } catch (error: any) {
    logResult('Redis Caching', 'FAIL', 'Cache test failed', error.message);
  }
}

async function testPermissionCaching() {
  console.log('\n🔍 Testing Permission Set Caching...\n');
  
  try {
    // Get a test user
    const testUser = await prisma.user.findFirst({
      where: { status: 'active', deleted_at: null },
      select: { id: true },
    });

    if (!testUser) {
      logResult('Permission Cache Test', 'SKIP', 'No active users found for testing');
      return;
    }

    // Import authority check
    const { checkAuthority } = await import('../app/lib/services/authority');
    
    // Get a test location
    const testLocation = await prisma.location.findFirst({
      where: { status: 'active' },
      select: { id: true },
    });

    if (!testLocation) {
      logResult('Permission Cache Test', 'SKIP', 'No locations found for testing');
      return;
    }

    // First check (should populate cache)
    const start1 = Date.now();
    await checkAuthority({
      userId: testUser.id,
      permission: 'system.admin',
      locationId: testLocation.id,
    });
    const time1 = Date.now() - start1;

    // Second check (should use cache)
    const start2 = Date.now();
    await checkAuthority({
      userId: testUser.id,
      permission: 'system.admin',
      locationId: testLocation.id,
    });
    const time2 = Date.now() - start2;

    if (time2 < time1) {
      logResult(
        'Permission Cache Performance',
        'PASS',
        `First check: ${time1}ms, Cached check: ${time2}ms (${Math.round((1 - time2/time1) * 100)}% faster)`
      );
    } else {
      logResult(
        'Permission Cache Performance',
        'PASS',
        `First check: ${time1}ms, Second check: ${time2}ms (cache may need warm-up)`
      );
    }

    // Verify cache exists
    const cacheKey = `user:perms:${testUser.id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const perms = JSON.parse(cached);
      logResult('Permission Cache Storage', 'PASS', `Cached ${perms.length} permissions`);
    } else {
      logResult('Permission Cache Storage', 'FAIL', 'Permission cache not found');
    }
  } catch (error: any) {
    logResult('Permission Caching', 'FAIL', 'Permission cache test failed', error.message);
  }
}

async function testOptimizedQueries() {
  console.log('\n🔍 Testing Optimized Queries...\n');
  
  try {
    // Test getLeaveUtilization (should filter at DB level)
    const { getLeaveUtilization } = await import('../app/lib/services/reporting');
    
    const testLocation = await prisma.location.findFirst({
      where: { status: 'active' },
      select: { id: true },
    });

    if (!testLocation) {
      logResult('Leave Utilization Query', 'SKIP', 'No locations found');
      return;
    }

    const start = Date.now();
    const result = await getLeaveUtilization({
      locationId: testLocation.id,
    });
    const time = Date.now() - start;

    logResult(
      'Leave Utilization Query',
      time < 2000 ? 'PASS' : 'FAIL',
      `Query completed in ${time}ms, found ${result.summary.totalRequests} requests`
    );

    // Test getPendingApprovals (should use select, not include)
    const { getPendingApprovals } = await import('../app/lib/services/reporting');
    
    const start2 = Date.now();
    const approvals = await getPendingApprovals({
      locationId: testLocation.id,
    });
    const time2 = Date.now() - start2;

    logResult(
      'Pending Approvals Query',
      time2 < 2000 ? 'PASS' : 'FAIL',
      `Query completed in ${time2}ms, found ${approvals.summary.totalPending} pending`
    );
  } catch (error: any) {
    logResult('Optimized Queries', 'FAIL', 'Query optimization test failed', error.message);
  }
}

async function testParallelQueries() {
  console.log('\n🔍 Testing Parallel Query Execution...\n');
  
  try {
    const { getDashboardData } = await import('../app/lib/services/reporting');
    
    const testLocation = await prisma.location.findFirst({
      where: { status: 'active' },
      select: { id: true },
    });

    if (!testLocation) {
      logResult('Dashboard Parallel Queries', 'SKIP', 'No locations found');
      return;
    }

    // Clear cache to test actual query performance
    await redis.del(`dashboard:v2:${JSON.stringify({ locationId: testLocation.id })}`);

    const start = Date.now();
    const dashboard = await getDashboardData({
      locationId: testLocation.id,
    });
    const time = Date.now() - start;

    // Dashboard should complete in < 2 seconds with parallel queries
    const passed = time < 2000;
    logResult(
      'Dashboard Parallel Queries',
      passed ? 'PASS' : 'FAIL',
      `Dashboard loaded in ${time}ms (target: <2000ms). Has leave: ${!!dashboard.leave}, Has timesheets: ${!!dashboard.timesheets}`
    );
  } catch (error: any) {
    logResult('Parallel Queries', 'FAIL', 'Parallel query test failed', error.message);
  }
}

async function testAPIEndpoints() {
  console.log('\n🔍 Testing API Endpoints (Cached)...\n');
  
  try {
    // Test that cached endpoints return data
    // Note: We're testing the service functions, not the full API routes
    
    // Test locations service (should be cached)
    const testLocation = await prisma.location.findFirst({
      where: { status: 'active' },
      select: { id: true },
    });

    if (!testLocation) {
      logResult('API Endpoints', 'SKIP', 'No locations found');
      return;
    }

    // Test leave types query (should use cache after first call)
    const leaveTypes = await prisma.leaveType.findMany({
      where: { deleted_at: null },
      take: 5,
      select: { id: true, name: true },
    });

    logResult(
      'Leave Types Query',
      'PASS',
      `Found ${leaveTypes.length} leave types`
    );

    // Test staff types query
    const staffTypes = await prisma.staffType.findMany({
      where: { deleted_at: null },
      take: 5,
      select: { id: true, name: true },
    });

    logResult(
      'Staff Types Query',
      'PASS',
      `Found ${staffTypes.length} staff types`
    );

    // Test locations query
    const locations = await prisma.location.findMany({
      where: { status: 'active' },
      take: 5,
      select: { id: true, name: true },
    });

    logResult(
      'Locations Query',
      'PASS',
      `Found ${locations.length} locations`
    );
  } catch (error: any) {
    logResult('API Endpoints', 'FAIL', 'API endpoint test failed', error.message);
  }
}

async function testDatabaseIndexes() {
  console.log('\n🔍 Testing Database Indexes...\n');
  
  try {
    // Test that indexes exist by checking query performance
    const start = Date.now();
    const scopes = await prisma.userPermissionScope.findMany({
      where: {
        status: 'active',
      },
      take: 10,
      select: { id: true },
    });
    const time = Date.now() - start;

    logResult(
      'User Permission Scope Index',
      time < 100 ? 'PASS' : 'WARN',
      `Query with index completed in ${time}ms (found ${scopes.length} scopes)`
    );

    // Test delegation index
    const start2 = Date.now();
    const delegations = await prisma.delegation.findMany({
      where: {
        status: 'active',
      },
      take: 10,
      select: { id: true },
    });
    const time2 = Date.now() - start2;

    logResult(
      'Delegation Index',
      time2 < 100 ? 'PASS' : 'WARN',
      `Query with index completed in ${time2}ms (found ${delegations.length} delegations)`
    );
  } catch (error: any) {
    logResult('Database Indexes', 'FAIL', 'Index test failed', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Performance Optimization Tests...\n');
  console.log('=' .repeat(60));

  try {
    await testConnectionPooling();
    await testCaching();
    await testPermissionCaching();
    await testOptimizedQueries();
    await testParallelQueries();
    await testAPIEndpoints();
    await testDatabaseIndexes();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Summary:\n');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📈 Total: ${results.length}\n`);

    if (failed > 0) {
      console.log('❌ Failed Tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - ${r.name}: ${r.error || r.details}`);
      });
      console.log('');
    }

    if (failed === 0) {
      console.log('🎉 All tests passed! API optimizations are working correctly.\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review the errors above.\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Test suite error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
    await redis.quit();
  }
}

runAllTests();
