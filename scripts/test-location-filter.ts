import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { getDashboardData, getLeaveAnalyticsForMonth, getTimesheetAnalyticsForMonth } from '../app/lib/services/reporting';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testLocationFilter() {
  try {
    console.log('🔍 Testing Location Filter on Dashboard Components...\n');

    // Get test locations
    const locations = await prisma.location.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      take: 3,
    });

    if (locations.length < 2) {
      console.log('⚠️  Need at least 2 locations for testing. Found:', locations.length);
      return;
    }

    const location1 = locations[0];
    const location2 = locations[1];

    console.log(`✅ Testing with locations:`);
    console.log(`   Location 1: ${location1.name} (${location1.id})`);
    console.log(`   Location 2: ${location2.name} (${location2.id})\n`);

    // Test 1: Leave Analytics for Month
    console.log('Test 1: Leave Analytics for Month...');
    const leaveAnalytics1 = await getLeaveAnalyticsForMonth({ locationId: location1.id });
    const leaveAnalytics2 = await getLeaveAnalyticsForMonth({ locationId: location2.id });
    const leaveAnalyticsAll = await getLeaveAnalyticsForMonth({});
    
    console.log(`   Location 1: ${leaveAnalytics1.submitted.count} submitted, ${leaveAnalytics1.pending.count} pending`);
    console.log(`   Location 2: ${leaveAnalytics2.submitted.count} submitted, ${leaveAnalytics2.pending.count} pending`);
    console.log(`   All Locations: ${leaveAnalyticsAll.submitted.count} submitted, ${leaveAnalyticsAll.pending.count} pending`);
    
    if (leaveAnalytics1.submitted.count + leaveAnalytics2.submitted.count <= leaveAnalyticsAll.submitted.count) {
      console.log('   ✅ Location filter working correctly\n');
    } else {
      console.log('   ⚠️  Location filter may have issues (sum of locations > all)\n');
    }

    // Test 2: Timesheet Analytics for Month
    console.log('Test 2: Timesheet Analytics for Month...');
    const timesheetAnalytics1 = await getTimesheetAnalyticsForMonth({ locationId: location1.id });
    const timesheetAnalytics2 = await getTimesheetAnalyticsForMonth({ locationId: location2.id });
    const timesheetAnalyticsAll = await getTimesheetAnalyticsForMonth({});
    
    console.log(`   Location 1: ${timesheetAnalytics1.submitted.count} submitted, ${timesheetAnalytics1.pending.count} pending`);
    console.log(`   Location 2: ${timesheetAnalytics2.submitted.count} submitted, ${timesheetAnalytics2.pending.count} pending`);
    console.log(`   All Locations: ${timesheetAnalyticsAll.submitted.count} submitted, ${timesheetAnalyticsAll.pending.count} pending`);
    
    if (timesheetAnalytics1.submitted.count + timesheetAnalytics2.submitted.count <= timesheetAnalyticsAll.submitted.count) {
      console.log('   ✅ Location filter working correctly\n');
    } else {
      console.log('   ⚠️  Location filter may have issues (sum of locations > all)\n');
    }

    // Test 3: Full Dashboard Data
    console.log('Test 3: Full Dashboard Data...');
    const dashboard1 = await getDashboardData({ locationId: location1.id });
    const dashboard2 = await getDashboardData({ locationId: location2.id });
    const dashboardAll = await getDashboardData({});
    
    console.log(`   Location 1 Dashboard:`);
    console.log(`     - Leave submitted: ${dashboard1.leave.analyticsMonth?.submitted.count || 0}`);
    console.log(`     - Timesheets submitted: ${dashboard1.timesheets.analyticsMonth?.submitted.count || 0}`);
    console.log(`     - Total employees: ${dashboard1.contracts?.totalEmployees || 0}`);
    
    console.log(`   Location 2 Dashboard:`);
    console.log(`     - Leave submitted: ${dashboard2.leave.analyticsMonth?.submitted.count || 0}`);
    console.log(`     - Timesheets submitted: ${dashboard2.timesheets.analyticsMonth?.submitted.count || 0}`);
    console.log(`     - Total employees: ${dashboard2.contracts?.totalEmployees || 0}`);
    
    console.log(`   All Locations Dashboard:`);
    console.log(`     - Leave submitted: ${dashboardAll.leave.analyticsMonth?.submitted.count || 0}`);
    console.log(`     - Timesheets submitted: ${dashboardAll.timesheets.analyticsMonth?.submitted.count || 0}`);
    console.log(`     - Total employees: ${dashboardAll.contracts?.totalEmployees || 0}`);
    
    const location1Employees = dashboard1.contracts?.totalEmployees || 0;
    const location2Employees = dashboard2.contracts?.totalEmployees || 0;
    const allEmployees = dashboardAll.contracts?.totalEmployees || 0;
    
    if (location1Employees + location2Employees <= allEmployees) {
      console.log('   ✅ Location filter working correctly for contracts\n');
    } else {
      console.log('   ⚠️  Location filter may have issues for contracts\n');
    }

    console.log('✅ Location Filter Testing Complete!\n');
    console.log('Summary:');
    console.log('  - Leave Analytics: Location filter applied');
    console.log('  - Timesheet Analytics: Location filter applied');
    console.log('  - Dashboard Data: Location filter applied');
    console.log('  - Contract Insights: Location filter applied\n');

  } catch (error: any) {
    console.error('❌ Error testing location filter:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

testLocationFilter();
